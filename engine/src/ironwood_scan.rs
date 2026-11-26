use incrementalmerkletree::frontier::CommitmentTree;
use incrementalmerkletree::witness::IncrementalWitness;
use orchard::keys::{FullViewingKey, Scope};
use orchard::note_encryption::IronwoodDomain;
use orchard::tree::MerkleHashOrchard;
use serde::{Deserialize, Serialize};
use zcash_note_encryption::try_note_decryption;
use zcash_primitives::block::Block;
use zcash_primitives::merkle_tree::{
    read_commitment_tree, read_incremental_witness, write_incremental_witness,
};

use crate::{CateNetwork, ironwood};

#[derive(Clone, Deserialize, Serialize)]
pub struct ScannedNote {
    pub transaction_hex: String,
    pub action_index: usize,
    pub witness_hex: String,
    pub nullifier_hex: String,
    pub value: String,
    pub received_height: u32,
}

#[derive(Deserialize)]
pub struct ScanRequest {
    pub network: String,
    pub shield_seed_hex: String,
    pub previous_height: u32,
    pub previous_hash: String,
    pub previous_tree_hex: String,
    pub notes: Vec<ScannedNote>,
    pub block_hex: String,
    pub block_hash: String,
    pub expected_tree_hex: String,
}

#[derive(Serialize)]
pub struct ScanResult {
    pub height: u32,
    pub hash: String,
    pub tree_hex: String,
    pub notes: Vec<ScannedNote>,
    pub balance: String,
}

pub fn scan_block(request: ScanRequest) -> Result<ScanResult, String> {
    let network = CateNetwork::parse(&request.network)?;
    if request.notes.len() > 256 || request.block_hex.len() > 8_000_000 {
        return Err("Ironwood scan input is too large".into());
    }
    let (spending_key, _) = ironwood::account(&request.shield_seed_hex, network)?;
    let fvk = FullViewingKey::from(&spending_key);
    let ivk = fvk.to_ivk(Scope::External).prepare();
    let tree_bytes = hex::decode(&request.previous_tree_hex).map_err(|_| "invalid prior tree")?;
    let mut tree_reader = tree_bytes.as_slice();
    let mut tree: CommitmentTree<MerkleHashOrchard, 32> =
        read_commitment_tree(&mut tree_reader).map_err(|_| "invalid prior Ironwood tree")?;
    if !tree_reader.is_empty() { return Err("trailing prior tree data".into()); }
    let block_bytes = hex::decode(&request.block_hex).map_err(|_| "invalid block hex")?;
    let mut block_reader = block_bytes.as_slice();
    let block = Block::read(&mut block_reader, &network).map_err(|_| "invalid Catecash block")?;
    if !block_reader.is_empty() || block.claimed_height() != (request.previous_height + 1).into() ||
        !block.header().hash().to_string().eq_ignore_ascii_case(&request.block_hash) ||
        !block.header().prev_block.to_string().eq_ignore_ascii_case(&request.previous_hash) {
        return Err("Ironwood scan block is not the expected chain successor".into());
    }
    let mut notes = request.notes;
    for tx in block.vtx().iter() {
        let Some(bundle) = tx.ironwood_bundle() else { continue };
        let mut tx_bytes = Vec::new();
        tx.write(&mut tx_bytes).map_err(|_| "cannot serialize scanned transaction")?;
        let tx_hex = hex::encode(tx_bytes);
        for (action_index, action) in bundle.actions().iter().enumerate() {
            let nullifier_hex = hex::encode(action.nullifier().to_bytes());
            notes.retain(|note| note.nullifier_hex != nullifier_hex);
            let leaf = MerkleHashOrchard::from_cmx(action.cmx());
            tree.append(leaf).map_err(|_| "Ironwood commitment tree is full")?;
            for note in &mut notes {
                let witness_bytes = hex::decode(&note.witness_hex).map_err(|_| "invalid note witness")?;
                let mut witness_reader = witness_bytes.as_slice();
                let mut witness: IncrementalWitness<MerkleHashOrchard, 32> =
                    read_incremental_witness(&mut witness_reader).map_err(|_| "invalid note witness")?;
                if !witness_reader.is_empty() { return Err("trailing note witness data".into()); }
                witness.append(leaf).map_err(|_| "note witness tree is full")?;
                let mut updated = Vec::new();
                write_incremental_witness(&witness, &mut updated).map_err(|_| "cannot store note witness")?;
                note.witness_hex = hex::encode(updated);
            }
            if let Some((note, _, _)) = try_note_decryption(&IronwoodDomain::for_action(action), &ivk, action) {
                if note.value().inner() == 0 { continue; }
                let witness = IncrementalWitness::from_tree(tree.clone()).ok_or("cannot witness note")?;
                let mut witness_bytes = Vec::new();
                write_incremental_witness(&witness, &mut witness_bytes).map_err(|_| "cannot store new witness")?;
                notes.push(ScannedNote {
                    transaction_hex: tx_hex.clone(), action_index,
                    witness_hex: hex::encode(witness_bytes),
                    nullifier_hex: hex::encode(note.nullifier(&fvk).to_bytes()),
                    value: note.value().inner().to_string(),
                    received_height: request.previous_height + 1,
                });
            }
        }
    }
    let expected_bytes = hex::decode(&request.expected_tree_hex).map_err(|_| "invalid expected tree")?;
    let mut expected_reader = expected_bytes.as_slice();
    let expected: CommitmentTree<MerkleHashOrchard, 32> =
        read_commitment_tree(&mut expected_reader).map_err(|_| "invalid expected Ironwood tree")?;
    // The node may serialize unused parent slots, while local appends keep a shorter
    // frontier. Both represent the same tree when their size and root agree.
    if !expected_reader.is_empty() || expected.size() != tree.size() || expected.root() != tree.root() {
        return Err("Ironwood commitments disagree with node tree state".into());
    }
    let balance = notes.iter().try_fold(0u64, |sum, note| {
        let value: u64 = note.value.parse().map_err(|_| "invalid note amount")?;
        sum.checked_add(value).ok_or("Ironwood note total overflow")
    })?;
    Ok(ScanResult { height: request.previous_height + 1, hash: request.block_hash,
        tree_hex: request.expected_tree_hex, notes, balance: balance.to_string() })
}
