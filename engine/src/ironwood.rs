use incrementalmerkletree::frontier::CommitmentTree;
use orchard::keys::{FullViewingKey, Scope, SpendingKey};
use orchard::tree::MerkleHashOrchard;
use rand::SeedableRng;
use rand_chacha::ChaCha20Rng;
use serde::{Deserialize, Serialize};
use zcash_address::{ToAddress, ZcashAddress, unified::{self, Container as _, Encoding as _}};
use zcash_primitives::merkle_tree::read_commitment_tree;
use zcash_primitives::transaction::builder::{BuildConfig, Builder, BundlePadding};
use zcash_primitives::transaction::fees::{FeeRule as _, transparent::InputSize, zip317};
use zcash_protocol::consensus::{BlockHeight, NetworkConstants as _, Parameters};
use zcash_protocol::memo::MemoBytes;
use zcash_transparent::address::TransparentAddress;
use zcash_transparent::builder::TransparentSigningSet;
use zcash_transparent::bundle::{OutPoint, TxOut};
use zip32::AccountId;
use crate::ironwood_scan::ScannedNote;

use crate::{CateNetwork, NoSaplingProver, Utxo, decode_key, encode_address, zat};

const COINBASE_MATURITY: u32 = 240;
const IRONWOOD_ACTIONS: usize = 2;
const MAX_TREE_STATE_HEX: usize = 8192;

#[derive(Deserialize)]
pub struct ShieldRequest {
    pub network: String,
    pub secret_hex: String,
    pub shield_seed_hex: String,
    pub tip_height: u32,
    pub tree_height: u32,
    pub tree_state_hex: String,
    pub entropy_hex: String,
    pub utxo: Utxo,
    pub destination: Option<String>,
}

#[derive(Deserialize)]
pub struct AddressRequest {
    pub network: String,
    pub shield_seed_hex: String,
}

#[derive(Deserialize)]
pub struct ShieldedSpendRequest {
    pub network: String,
    pub shield_seed_hex: String,
    pub destination: String,
    pub amount: String,
    pub tip_height: u32,
    pub tree_state_hex: String,
    pub note: ScannedNote,
    pub entropy_hex: String,
}

#[derive(Serialize)]
pub struct ShieldedSpendResult {
    pub raw_hex: String,
    pub amount: String,
    pub fee: String,
    pub change: String,
    pub destination: String,
    pub expiry_height: u32,
}

enum SendDestination {
    Transparent(TransparentAddress),
    Ironwood(orchard::Address),
}

fn decode_send_destination(encoded: &str, network: CateNetwork) -> Result<SendDestination, String> {
    if let Ok(address) = crate::decode_address(encoded, network) {
        return Ok(SendDestination::Transparent(address));
    }
    let (address_network, revision, unified) = unified::Address::decode(encoded)
        .map_err(|_| "invalid Catecash recipient address")?;
    if address_network != network.network_type() || revision != unified::Revision::R2 {
        return Err("recipient must be an Ironwood address on the selected network".into());
    }
    for receiver in unified.items() {
        if let unified::Receiver::Orchard(bytes) = receiver {
            let address = Option::<orchard::Address>::from(orchard::Address::from_raw_address_bytes(&bytes))
                .ok_or("invalid Ironwood receiver")?;
            return Ok(SendDestination::Ironwood(address));
        }
    }
    Err("recipient has no Ironwood receiver".into())
}

#[derive(Serialize)]
pub struct ShieldResult {
    pub raw_hex: String,
    pub source_address: String,
    pub shielded_address: String,
    pub amount: String,
    pub fee: String,
    pub expiry_height: u32,
}

pub(crate) fn account(seed_hex: &str, network: CateNetwork) -> Result<(SpendingKey, orchard::Address), String> {
    let seed: [u8; 32] = hex::decode(seed_hex)
        .map_err(|_| "invalid shield seed encoding")?
        .try_into()
        .map_err(|_| "shield seed must be 32 bytes")?;
    let key = SpendingKey::from_zip32_seed(&seed, network.network_type().coin_type(), AccountId::ZERO)
        .map_err(|_| "cannot derive Ironwood account")?;
    let receiver = FullViewingKey::from(&key).address_at(0u32, Scope::External);
    Ok((key, receiver))
}

fn encode_shielded(receiver: orchard::Address, network: CateNetwork) -> Result<String, String> {
    let unified = unified::Address::try_from_items(
        unified::Revision::R2,
        vec![unified::Uitem::Data(unified::Receiver::Orchard(receiver.to_raw_address_bytes()))],
    )
    .map_err(|_| "cannot encode Ironwood address")?;
    Ok(ZcashAddress::from_unified(network.network_type(), unified).to_string())
}

pub fn shielded_address(seed_hex: &str, network_name: &str) -> Result<String, String> {
    let network = CateNetwork::parse(network_name)?;
    let (_, receiver) = account(seed_hex, network)?;
    encode_shielded(receiver, network)
}

pub fn build_shield(request: ShieldRequest) -> Result<ShieldResult, String> {
    let network = CateNetwork::parse(&request.network)?;
    if request.tip_height == 0 || request.tip_height == u32::MAX || request.tree_height != request.tip_height {
        return Err("inconsistent Ironwood tree height".into());
    }
    if !request.utxo.coinbase || request.utxo.height > request.tip_height ||
        request.tip_height - request.utxo.height + 1 < COINBASE_MATURITY {
        return Err("mining reward has not matured".into());
    }
    if request.tree_state_hex.len() > MAX_TREE_STATE_HEX {
        return Err("Ironwood tree state is too large".into());
    }
    let tree_bytes = hex::decode(&request.tree_state_hex).map_err(|_| "invalid Ironwood tree state")?;
    let mut tree_reader = tree_bytes.as_slice();
    let tree: CommitmentTree<MerkleHashOrchard, 32> =
        read_commitment_tree(&mut tree_reader).map_err(|_| "invalid Ironwood tree")?;
    if !tree_reader.is_empty() {
        return Err("trailing Ironwood tree data".into());
    }
    let anchor = orchard::Anchor::from(tree.root());
    let (_, own_receiver) = account(&request.shield_seed_hex, network)?;
    let receiver = match request.destination.as_deref() {
        Some(encoded) => match decode_send_destination(encoded, network)? {
            SendDestination::Ironwood(address) => address,
            SendDestination::Transparent(_) => return Err("mined rewards must shield to an Ironwood address".into()),
        },
        None => own_receiver,
    };
    let shielded_address = encode_shielded(receiver, network)?;
    let secret = decode_key(&request.secret_hex)?;
    let source = TransparentAddress::from_pubkey(&secp256k1::PublicKey::from_secret_key(&secret));
    let source_address = encode_address(&source, network)?;
    let source_script: zcash_transparent::address::Script = source.script().into();
    let script = hex::decode(&request.utxo.script_hex).map_err(|_| "invalid UTXO script")?;
    if script != source_script.0.0 {
        return Err("mining reward does not belong to this wallet".into());
    }
    let mut txid: [u8; 32] = hex::decode(&request.utxo.txid)
        .map_err(|_| "invalid UTXO txid")?
        .try_into()
        .map_err(|_| "UTXO txid must be 32 bytes")?;
    txid.reverse();
    let value: u64 = request.utxo.value.parse().map_err(|_| "invalid UTXO amount")?;
    let target_height = request.tip_height + 1;
    let target = BlockHeight::from_u32(target_height);
    let fee = zip317::FeeRule::standard()
        .fee_required(
            &network,
            target,
            [InputSize::STANDARD_P2PKH],
            std::iter::empty::<usize>(),
            0,
            0,
            0,
            IRONWOOD_ACTIONS,
        )
        .map_err(|_| "shield fee calculation failed")?
        .into_u64();
    let amount = value.checked_sub(fee).ok_or("mining reward does not cover shield fee")?;
    let entropy: [u8; 32] = hex::decode(&request.entropy_hex)
        .map_err(|_| "invalid entropy encoding")?
        .try_into()
        .map_err(|_| "entropy must be 32 bytes")?;
    let mut signing_set = TransparentSigningSet::new();
    let pubkey = signing_set.add_key(secret);
    let mut builder = Builder::new(
        network,
        target,
        BuildConfig::Standard {
            sapling_anchor: None,
            orchard_anchor: None,
            ironwood_anchor: Some(anchor),
            orchard_padding: BundlePadding::DEFAULT,
            ironwood_padding: BundlePadding::DEFAULT,
        },
    )
    .with_expiry_height(BlockHeight::from_u32(target_height.saturating_add(120)));
    builder
        .add_transparent_p2pkh_input(
            pubkey,
            OutPoint::new(txid, request.utxo.index),
            TxOut::new(zat(value)?, source_script),
        )
        .map_err(|_| "invalid mining reward input")?;
    builder
        .add_ironwood_output::<std::convert::Infallible>(None, receiver, zat(amount)?, MemoBytes::empty())
        .map_err(|_| "invalid shielded output")?;
    let prover = NoSaplingProver;
    let built = builder
        .build(
            &signing_set,
            &[],
            &[],
            ChaCha20Rng::from_seed(entropy),
            &prover,
            &prover,
            &zip317::FeeRule::standard(),
        )
        .map_err(|error| format!("shield transaction build failed: {error:?}"))?;
    let mut raw = Vec::new();
    built.transaction().write(&mut raw).map_err(|_| "shield transaction serialization failed")?;
    Ok(ShieldResult {
        raw_hex: hex::encode(raw),
        source_address,
        shielded_address,
        amount: amount.to_string(),
        fee: fee.to_string(),
        expiry_height: target_height.saturating_add(120),
    })
}

pub fn build_shielded_send(request: ShieldedSpendRequest) -> Result<ShieldedSpendResult, String> {
    let network = CateNetwork::parse(&request.network)?;
    let destination = decode_send_destination(&request.destination, network)?;
    let amount: u64 = request.amount.parse().map_err(|_| "invalid send amount")?;
    if amount == 0 { return Err("send amount must be positive".into()); }
    if request.note.received_height == 0 || request.note.received_height > request.tip_height ||
        request.tip_height - request.note.received_height + 1 < 10 {
        return Err("Ironwood note needs ten confirmations".into());
    }
    let (spending_key, receiver) = account(&request.shield_seed_hex, network)?;
    let fvk = FullViewingKey::from(&spending_key);
    let tx_bytes = hex::decode(&request.note.transaction_hex).map_err(|_| "invalid saved note transaction")?;
    let branch = zcash_protocol::consensus::BranchId::for_height(&network, BlockHeight::from_u32(request.note.received_height));
    let tx = zcash_primitives::transaction::Transaction::read(tx_bytes.as_slice(), branch)
        .map_err(|_| "invalid saved note transaction")?;
    let action = tx.ironwood_bundle().and_then(|bundle| bundle.actions().iter().nth(request.note.action_index))
        .ok_or("saved Ironwood note is missing")?;
    let ivk = fvk.to_ivk(Scope::External).prepare();
    let (note, _, _) = zcash_note_encryption::try_note_decryption(
        &orchard::note_encryption::IronwoodDomain::for_action(action), &ivk, action)
        .ok_or("saved Ironwood note is not owned by this wallet")?;
    if note.value().inner().to_string() != request.note.value ||
        hex::encode(note.nullifier(&fvk).to_bytes()) != request.note.nullifier_hex {
        return Err("saved Ironwood note does not match wallet scan".into());
    }
    let witness_bytes = hex::decode(&request.note.witness_hex).map_err(|_| "invalid saved note witness")?;
    let mut witness_reader = witness_bytes.as_slice();
    let witness: incrementalmerkletree::witness::IncrementalWitness<MerkleHashOrchard, 32> =
        zcash_primitives::merkle_tree::read_incremental_witness(&mut witness_reader)
            .map_err(|_| "invalid saved note witness")?;
    if !witness_reader.is_empty() { return Err("trailing note witness data".into()); }
    let tree_bytes = hex::decode(&request.tree_state_hex).map_err(|_| "invalid current Ironwood tree")?;
    let mut tree_reader = tree_bytes.as_slice();
    let tree: CommitmentTree<MerkleHashOrchard, 32> =
        read_commitment_tree(&mut tree_reader).map_err(|_| "invalid current Ironwood tree")?;
    if !tree_reader.is_empty() || witness.root() != tree.root() {
        return Err("note witness is not at the current Ironwood anchor".into());
    }
    let merkle_path = witness.path().ok_or("missing Ironwood note path")?;
    let path: orchard::tree::MerklePath = merkle_path.into();
    if path.root(action.cmx().clone()) != orchard::Anchor::from(tree.root()) {
        return Err("Ironwood note path does not prove this note".into())
    }
    let target_height = request.tip_height.checked_add(1).ok_or("invalid chain height")?;
    let fee = zip317::FeeRule::standard().fee_required(
        &network, BlockHeight::from_u32(target_height),
        std::iter::empty::<InputSize>(),
        if matches!(destination, SendDestination::Transparent(_)) { vec![34usize] } else { vec![] },
        0, 0, 0, IRONWOOD_ACTIONS,
    ).map_err(|_| "shielded fee calculation failed")?.into_u64();
    let change = note.value().inner().checked_sub(amount).and_then(|left| left.checked_sub(fee))
        .ok_or("insufficient shielded CATE")?;
    if change < 1_000 { return Err("shielded change is too small".into()) }
    let entropy: [u8; 32] = hex::decode(&request.entropy_hex)
        .map_err(|_| "invalid entropy encoding")?.try_into().map_err(|_| "entropy must be 32 bytes")?;
    let anchor = orchard::Anchor::from(tree.root());
    let mut builder = Builder::new(network, BlockHeight::from_u32(target_height), BuildConfig::Standard {
        sapling_anchor: None, orchard_anchor: None, ironwood_anchor: Some(anchor),
        orchard_padding: BundlePadding::DEFAULT, ironwood_padding: BundlePadding::DEFAULT,
    }).with_expiry_height(BlockHeight::from_u32(target_height.saturating_add(120)));
    builder.add_ironwood_spend::<std::convert::Infallible>(fvk, note, path)
        .map_err(|_| "cannot add Ironwood note spend")?;
    match destination {
        SendDestination::Transparent(address) => builder.add_transparent_output(&address, zat(amount)?)
            .map_err(|_| "invalid transparent recipient")?,
        SendDestination::Ironwood(address) => builder.add_ironwood_output::<std::convert::Infallible>(
            None, address, zat(amount)?, MemoBytes::empty())
            .map_err(|_| "invalid Ironwood recipient")?,
    }
    builder.add_ironwood_output::<std::convert::Infallible>(None, receiver, zat(change)?, MemoBytes::empty())
        .map_err(|_| "cannot add Ironwood change")?;
    let prover = NoSaplingProver;
    let built = builder.build(&TransparentSigningSet::new(), &[], &[orchard::keys::SpendAuthorizingKey::from(&spending_key)],
        ChaCha20Rng::from_seed(entropy), &prover, &prover, &zip317::FeeRule::standard())
        .map_err(|error| format!("shielded transaction build failed: {error:?}"))?;
    let mut raw = Vec::new();
    built.transaction().write(&mut raw).map_err(|_| "cannot serialize shielded transaction")?;
    Ok(ShieldedSpendResult { raw_hex: hex::encode(raw), amount: amount.to_string(), fee: fee.to_string(),
        change: change.to_string(), destination: request.destination,
        expiry_height: target_height.saturating_add(120) })
}

#[cfg(test)]
mod tests {
    use super::*;
    use zcash_primitives::merkle_tree::write_commitment_tree;
    use zcash_protocol::consensus::BranchId;

    #[test]
    fn derives_mainnet_ironwood_address() {
        let address = shielded_address(&"02".repeat(32), "mainnet")
            .expect("a fixed seed derives a mainnet Ironwood address");
        assert!(address.starts_with("cate"), "{address}");
        assert!(matches!(decode_send_destination(&address, CateNetwork::Mainnet),
            Ok(SendDestination::Ironwood(_))));
        assert!(decode_send_destination(&address, CateNetwork::Testnet).is_err());
    }

    #[test]
    fn browser_engine_builds_an_internal_ironwood_sweep() {
        let secret_hex = "01".repeat(32);
        let secret = decode_key(&secret_hex).expect("fixed secret is a valid secp256k1 key");
        let source = TransparentAddress::from_pubkey(&secp256k1::PublicKey::from_secret_key(&secret));
        let source_script: zcash_transparent::address::Script = source.script().into();
        let mut tree_state = Vec::new();
        write_commitment_tree(&CommitmentTree::<MerkleHashOrchard, 32>::empty(), &mut tree_state)
            .expect("an empty tree serializes into a Vec");
        let shield = build_shield(ShieldRequest {
            network: "mainnet".into(),
            secret_hex,
            shield_seed_hex: "02".repeat(32),
            tip_height: 241,
            tree_height: 241,
            tree_state_hex: hex::encode(tree_state),
            entropy_hex: "03".repeat(32),
            utxo: Utxo {
                txid: "04".repeat(32),
                index: 0,
                value: "100000000000".into(),
                script_hex: hex::encode(source_script.0.0),
                height: 1,
                coinbase: true,
            },
            destination: None,
        })
        .expect("a mature mining reward builds a shield-only transaction");
        assert!(shield.shielded_address.starts_with("cate"));
        let raw = hex::decode(shield.raw_hex).expect("builder output is hex");
        let transaction = zcash_primitives::transaction::Transaction::read(
            raw.as_slice(),
            BranchId::CatecashMainnet,
        )
        .expect("builder output is a transaction");
        assert!(transaction.transparent_bundle().is_some_and(|bundle| bundle.vout.is_empty()));
        assert!(transaction.ironwood_bundle().is_some());
    }

    #[test]
    fn browser_engine_spends_a_scanned_ironwood_note() {
        use zcash_primitives::block::{BlockHash, BlockHeaderData};
        use crate::ironwood_scan::{ScanRequest, scan_block};
        let secret_hex = "01".repeat(32);
        let shield_seed_hex = "02".repeat(32);
        let secret = decode_key(&secret_hex).unwrap();
        let source = TransparentAddress::from_pubkey(&secp256k1::PublicKey::from_secret_key(&secret));
        let source_script: zcash_transparent::address::Script = source.script().into();
        let source_address = encode_address(&source, CateNetwork::Mainnet).unwrap();
        let empty = CommitmentTree::<MerkleHashOrchard, 32>::empty();
        let mut empty_bytes = Vec::new();
        write_commitment_tree(&empty, &mut empty_bytes).unwrap();
        let shield = build_shield(ShieldRequest {
            network: "mainnet".into(), secret_hex, shield_seed_hex: shield_seed_hex.clone(),
            tip_height: 241, tree_height: 241, tree_state_hex: hex::encode(empty_bytes),
            entropy_hex: "03".repeat(32),
            utxo: Utxo { txid: "04".repeat(32), index: 0,
                value: "100000000000".into(), script_hex: hex::encode(source_script.0.0),
                height: 1, coinbase: true }, destination: None,
        }).unwrap();
        let raw = hex::decode(&shield.raw_hex).unwrap();
        let transaction = zcash_primitives::transaction::Transaction::read(
            raw.as_slice(), BranchId::CatecashMainnet).unwrap();
        let mut tree = empty;
        for action in transaction.ironwood_bundle().unwrap().actions().iter() {
            tree.append(MerkleHashOrchard::from_cmx(action.cmx())).unwrap();
        }
        let mut tree_bytes = Vec::new();
        write_commitment_tree(&tree, &mut tree_bytes).unwrap();
        let mut coinbase_builder = Builder::new(CateNetwork::Mainnet, BlockHeight::from_u32(242),
            BuildConfig::Coinbase { miner_data: None });
        coinbase_builder.add_transparent_output(&source, zat(1_000).unwrap()).unwrap();
        let prover = NoSaplingProver;
        let coinbase = coinbase_builder.build(&TransparentSigningSet::new(), &[], &[],
            ChaCha20Rng::from_seed([9; 32]), &prover, &prover, &zip317::FeeRule::standard())
            .unwrap().transaction().clone();
        let parent = BlockHash([11; 32]);
        let header = BlockHeaderData { version: 4, prev_block: parent,
            merkle_root: [0; 32], final_sapling_root: [0; 32], time: 0, bits: 0,
            nonce: [0; 32], solution: Vec::new() }.freeze().unwrap();
        let mut block_bytes = Vec::new();
        header.write(&mut block_bytes).unwrap();
        block_bytes.push(2); // CompactSize transaction count.
        coinbase.write(&mut block_bytes).unwrap();
        transaction.write(&mut block_bytes).unwrap();
        let scanned = scan_block(ScanRequest { network: "mainnet".into(), shield_seed_hex: shield_seed_hex.clone(),
            previous_height: 241, previous_hash: parent.to_string(), previous_tree_hex: "000000".into(),
            notes: vec![], block_hex: hex::encode(block_bytes), block_hash: header.hash().to_string(),
            expected_tree_hex: hex::encode(&tree_bytes) }).expect("browser scan finds the shield note");
        assert_eq!(scanned.notes.len(), 1);
        assert_eq!(scanned.balance, shield.amount);
        let sent = build_shielded_send(ShieldedSpendRequest {
            network: "mainnet".into(), shield_seed_hex, destination: source_address,
            amount: "20000000000".into(), tip_height: 251,
            tree_state_hex: hex::encode(tree_bytes), entropy_hex: "05".repeat(32),
            note: scanned.notes[0].clone(),
        }).expect("spend proof signs");
        let spend = zcash_primitives::transaction::Transaction::read(
            hex::decode(sent.raw_hex).unwrap().as_slice(), BranchId::CatecashMainnet).unwrap();
        assert_eq!(spend.transparent_bundle().unwrap().vout[0].value().into_u64(), 20_000_000_000);
        assert!(spend.ironwood_bundle().is_some());
    }
}
