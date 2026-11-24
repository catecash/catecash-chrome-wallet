use rand::SeedableRng;
use rand_chacha::ChaCha20Rng;
use secp256k1::{PublicKey, SecretKey};
use serde::{Deserialize, Serialize};
use zcash_primitives::transaction::builder::{BuildConfig, Builder, BundlePadding};
use zcash_primitives::transaction::fees::{FeeRule as _, transparent::InputSize, zip317};
use zcash_protocol::consensus::{BlockHeight, BranchId, NetworkType, NetworkUpgrade, Parameters};
use zcash_protocol::value::Zatoshis;
use zcash_transparent::address::TransparentAddress;
use zcash_transparent::builder::TransparentSigningSet;
use zcash_transparent::bundle::{OutPoint, TxOut};

#[derive(Clone, Copy)]
enum CateNetwork {
    Devnet,
    Testnet,
    Mainnet,
}
impl CateNetwork {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "devnet" => Ok(Self::Devnet),
            "testnet" => Ok(Self::Testnet),
            "mainnet" => Ok(Self::Mainnet),
            _ => Err("Unknown Catecash network".into()),
        }
    }
    fn prefix(self) -> [u8; 2] {
        match self {
            Self::Devnet => zcash_protocol::constants::catecash_devnet::B58_PUBKEY_ADDRESS_PREFIX,
            Self::Testnet => zcash_protocol::constants::catecash_testnet::B58_PUBKEY_ADDRESS_PREFIX,
            Self::Mainnet => zcash_protocol::constants::catecash_mainnet::B58_PUBKEY_ADDRESS_PREFIX,
        }
    }
    fn label(self) -> &'static str {
        match self {
            Self::Devnet => "devnet",
            Self::Testnet => "testnet",
            Self::Mainnet => "mainnet",
        }
    }
}
impl Parameters for CateNetwork {
    fn network_type(&self) -> NetworkType {
        match self {
            Self::Devnet => NetworkType::CatecashDevnet,
            Self::Testnet => NetworkType::CatecashTestnet,
            Self::Mainnet => NetworkType::CatecashMainnet,
        }
    }
    fn activation_height(&self, _: NetworkUpgrade) -> Option<BlockHeight> {
        Some(BlockHeight::from_u32(1))
    }
    fn branch_id_override(&self, height: BlockHeight) -> Option<BranchId> {
        (height >= BlockHeight::from_u32(1)).then_some(match self {
            Self::Devnet => BranchId::Catecash,
            Self::Testnet => BranchId::CatecashTestnet,
            Self::Mainnet => BranchId::CatecashMainnet,
        })
    }
}

const MAX_INPUTS: usize = 20;
const MIN_CHANGE: u64 = 1_000;
const COINBASE_MATURITY: u32 = 240;
const MIN_CONFIRMATIONS: u32 = 10;

#[derive(Deserialize)]
pub struct SpendRequest {
    pub network: String,
    pub secret_hex: String,
    pub destination: String,
    pub amount: String,
    pub tip_height: u32,
    pub entropy_hex: String,
    pub utxos: Vec<Utxo>,
}

#[derive(Deserialize)]
pub struct Utxo {
    pub txid: String,
    pub index: u32,
    pub value: String,
    pub script_hex: String,
    pub height: u32,
    pub coinbase: bool,
}

#[derive(Serialize)]
pub struct SpendResult {
    pub network: String,
    pub raw_hex: String,
    pub fee: String,
    pub amount: String,
    pub change: String,
    pub source_address: String,
    pub destination: String,
    pub expiry_height: u32,
    pub input_count: usize,
}

fn decode_key(hex_key: &str) -> Result<SecretKey, String> {
    let bytes: [u8; 32] = hex::decode(hex_key)
        .map_err(|_| "invalid key encoding")?
        .try_into()
        .map_err(|_| "key must be 32 bytes")?;
    SecretKey::from_secret_bytes(bytes).map_err(|_| "invalid private key".into())
}

fn decode_address(encoded: &str, network: CateNetwork) -> Result<TransparentAddress, String> {
    let bytes = bs58::decode(encoded)
        .with_check(None)
        .into_vec()
        .map_err(|_| "invalid Catecash address")?;
    if bytes.len() != 22 || bytes[..2] != network.prefix() {
        return Err("destination must be a P2PKH address on the selected network".into());
    }
    let hash: [u8; 20] = bytes[2..].try_into().map_err(|_| "invalid address hash")?;
    Ok(TransparentAddress::PublicKeyHash(hash))
}

fn encode_address(address: &TransparentAddress, network: CateNetwork) -> Result<String, String> {
    let TransparentAddress::PublicKeyHash(hash) = address else {
        return Err("source key is not P2PKH".into());
    };
    let mut payload = Vec::with_capacity(22);
    payload.extend_from_slice(&network.prefix());
    payload.extend_from_slice(hash);
    Ok(bs58::encode(payload).with_check().into_string())
}

fn zat(value: u64) -> Result<Zatoshis, String> {
    Zatoshis::from_u64(value).map_err(|_| "amount exceeds Catecash money range".into())
}

fn fee_for(inputs: usize, target: BlockHeight, network: CateNetwork) -> Result<u64, String> {
    // Both outputs are P2PKH. The 34-byte size includes the 8-byte amount
    // and CompactSize-prefixed script, matching the upstream builder.
    zip317::FeeRule::standard()
        .fee_required(
            &network,
            target,
            std::iter::repeat_n(InputSize::STANDARD_P2PKH, inputs),
            [34usize, 34usize],
            0,
            0,
            0,
            0,
        )
        .map(|fee| fee.into_u64())
        .map_err(|_| "fee calculation failed".into())
}

pub fn build_send(request: SpendRequest) -> Result<SpendResult, String> {
    if request.tip_height == 0 || request.tip_height == u32::MAX {
        return Err("invalid chain height".into());
    }
    let network = CateNetwork::parse(&request.network)?;
    let target_height = request.tip_height + 1;
    let target = BlockHeight::from_u32(target_height);
    let expiry_height = target_height.saturating_add(120);
    let amount: u64 = request
        .amount
        .parse()
        .map_err(|_| "invalid atomic amount")?;
    if amount == 0 {
        return Err("amount must be positive".into());
    }
    zat(amount)?;
    let entropy: [u8; 32] = hex::decode(&request.entropy_hex)
        .map_err(|_| "invalid entropy encoding")?
        .try_into()
        .map_err(|_| "entropy must be 32 bytes")?;
    let secret = decode_key(&request.secret_hex)?;
    let public = PublicKey::from_secret_key(&secret);
    let source = TransparentAddress::from_pubkey(&public);
    let source_address = encode_address(&source, network)?;
    let destination = decode_address(&request.destination, network)?;
    let source_script: zcash_transparent::address::Script = source.script().into();
    if request.utxos.is_empty() || request.utxos.len() > MAX_INPUTS {
        return Err("expected 1 to 20 UTXOs".into());
    }
    let mut coins = Vec::with_capacity(request.utxos.len());
    let mut seen = std::collections::HashSet::new();
    for utxo in request.utxos {
        if utxo.height > request.tip_height
            || request.tip_height - utxo.height + 1
                < if utxo.coinbase {
                    COINBASE_MATURITY
                } else {
                    MIN_CONFIRMATIONS
                }
        {
            return Err("UTXO has too few confirmations".into());
        }
        let script = hex::decode(&utxo.script_hex).map_err(|_| "invalid UTXO script")?;
        if script != source_script.0.0 {
            return Err("UTXO script does not match the wallet key".into());
        }
        let mut txid: [u8; 32] = hex::decode(&utxo.txid)
            .map_err(|_| "invalid UTXO txid")?
            .try_into()
            .map_err(|_| "UTXO txid must be 32 bytes")?;
        txid.reverse(); // Zebra RPC displays txids in the reverse of OutPoint byte order.
        if !seen.insert((txid, utxo.index)) {
            return Err("duplicate UTXO".into());
        }
        let value: u64 = utxo.value.parse().map_err(|_| "invalid UTXO amount")?;
        if value == 0 {
            return Err("zero-value UTXO".into());
        }
        zat(value)?;
        coins.push((OutPoint::new(txid, utxo.index), value));
    }
    coins.sort_by(|a, b| b.1.cmp(&a.1));
    let mut selected = Vec::new();
    let mut total = 0u64;
    let (fee, change) = loop {
        let Some(coin) = coins.get(selected.len()).cloned() else {
            return Err("insufficient confirmed CATE".into());
        };
        total = total.checked_add(coin.1).ok_or("UTXO sum overflow")?;
        selected.push(coin);
        let fee = fee_for(selected.len(), target, network)?;
        let required = amount.checked_add(fee).ok_or("amount plus fee overflow")?;
        if total
            >= required
                .checked_add(MIN_CHANGE)
                .ok_or("amount plus change overflow")?
        {
            break (fee, total - required);
        }
        if total == required {
            break (fee, 0);
        }
    };
    let mut signing_set = TransparentSigningSet::new();
    let pubkey = signing_set.add_key(secret);
    let mut builder = Builder::new(
        network,
        target,
        BuildConfig::Standard {
            sapling_anchor: None,
            orchard_anchor: None,
            ironwood_anchor: None,
            orchard_padding: BundlePadding::DEFAULT,
            ironwood_padding: BundlePadding::DEFAULT,
        },
    )
    .with_expiry_height(BlockHeight::from_u32(expiry_height));
    for (outpoint, value) in &selected {
        builder
            .add_transparent_p2pkh_input(
                pubkey,
                outpoint.clone(),
                TxOut::new(zat(*value)?, source_script.clone()),
            )
            .map_err(|e| format!("invalid UTXO: {e:?}"))?;
    }
    builder
        .add_transparent_output(&destination, zat(amount)?)
        .map_err(|e| format!("invalid recipient output: {e:?}"))?;
    if change > 0 {
        builder
            .add_transparent_output(&source, zat(change)?)
            .map_err(|e| format!("invalid change output: {e:?}"))?;
    }
    let prover = NoSaplingProver;
    let result = builder
        .build(
            &signing_set,
            &[],
            &[],
            ChaCha20Rng::from_seed(entropy),
            &prover,
            &prover,
            &zip317::FeeRule::standard(),
        )
        .map_err(|e| format!("transaction build failed: {e:?}"))?;
    let mut raw = Vec::new();
    result
        .transaction()
        .write(&mut raw)
        .map_err(|_| "transaction serialization failed")?;
    Ok(SpendResult {
        network: network.label().into(),
        raw_hex: hex::encode(raw),
        fee: fee.to_string(),
        amount: amount.to_string(),
        change: change.to_string(),
        source_address,
        destination: request.destination,
        expiry_height,
        input_count: selected.len(),
    })
}

struct NoSaplingProver;
impl sapling_crypto::prover::SpendProver for NoSaplingProver {
    type Proof = ();
    fn prepare_circuit(
        _: sapling_crypto::ProofGenerationKey,
        _: sapling_crypto::Diversifier,
        _: sapling_crypto::Rseed,
        _: sapling_crypto::value::NoteValue,
        _: jubjub::Fr,
        _: sapling_crypto::value::ValueCommitTrapdoor,
        _: jubjub::Fq,
        _: sapling_crypto::MerklePath,
    ) -> Option<sapling_crypto::circuit::Spend> {
        panic!("Sapling spends are unavailable")
    }
    fn create_proof<R: rand::Rng>(&self, _: sapling_crypto::circuit::Spend, _: &mut R) {
        panic!("Sapling spends are unavailable")
    }
    fn encode_proof(_: Self::Proof) -> sapling_crypto::bundle::GrothProofBytes {
        panic!("Sapling spends are unavailable")
    }
}
impl sapling_crypto::prover::OutputProver for NoSaplingProver {
    type Proof = ();
    fn prepare_circuit(
        _: &sapling_crypto::keys::EphemeralSecretKey,
        _: sapling_crypto::PaymentAddress,
        _: jubjub::Fr,
        _: sapling_crypto::value::NoteValue,
        _: sapling_crypto::value::ValueCommitTrapdoor,
    ) -> sapling_crypto::circuit::Output {
        panic!("Sapling outputs are unavailable")
    }
    fn create_proof<R: rand::Rng>(&self, _: sapling_crypto::circuit::Output, _: &mut R) {
        panic!("Sapling outputs are unavailable")
    }
    fn encode_proof(_: Self::Proof) -> sapling_crypto::bundle::GrothProofBytes {
        panic!("Sapling outputs are unavailable")
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn alloc(size: usize) -> *mut u8 {
    if size == 0 || size > 100_000 {
        return std::ptr::null_mut();
    }
    let bytes = vec![0u8; size].into_boxed_slice();
    Box::into_raw(bytes).cast::<u8>()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn dealloc(pointer: *mut u8, size: usize) {
    if pointer.is_null() || size == 0 {
        return;
    }
    let slice = std::ptr::slice_from_raw_parts_mut(pointer, size);
    unsafe {
        std::ptr::write_bytes(pointer, 0, size);
        drop(Box::from_raw(slice));
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn sign_json(pointer: *mut u8, size: usize) -> *mut u8 {
    if pointer.is_null() || size == 0 || size > 100_000 {
        return std::ptr::null_mut();
    }
    let input = unsafe { std::slice::from_raw_parts(pointer, size) };
    let response = match serde_json::from_slice::<SpendRequest>(input) {
        Ok(request) => match build_send(request) {
            Ok(result) => serde_json::json!({ "ok": result }),
            Err(error) => serde_json::json!({ "error": error }),
        },
        Err(_) => serde_json::json!({ "error": "invalid signer request" }),
    };
    let output = response.to_string().into_bytes();
    let len = output.len() as u32;
    let mut framed = Vec::with_capacity(output.len() + 4);
    framed.extend_from_slice(&len.to_le_bytes());
    framed.extend_from_slice(&output);
    Box::into_raw(framed.into_boxed_slice()).cast::<u8>()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn signs_transparent_devnet_send() {
        let secret = decode_key(&format!("{:0>64}", "1")).unwrap();
        let source = TransparentAddress::from_pubkey(&PublicKey::from_secret_key(&secret));
        let addr = encode_address(&source, CateNetwork::Devnet).unwrap();
        let script: zcash_transparent::address::Script = source.script().into();
        let request = SpendRequest {
            network: "devnet".into(),
            secret_hex: format!("{:0>64}", "1"),
            destination: addr.clone(),
            amount: "500000".into(),
            tip_height: 300,
            entropy_hex: "01".repeat(32),
            utxos: vec![Utxo {
                txid: "02".repeat(32),
                index: 0,
                value: "1000000".into(),
                script_hex: hex::encode(script.0.0),
                height: 1,
                coinbase: true,
            }],
        };
        let result = build_send(request).unwrap();
        assert_eq!(result.fee, "10000");
        assert_eq!(result.change, "490000");
        assert_eq!(result.source_address, addr);
        let raw = hex::decode(&result.raw_hex).unwrap();
        let tx = zcash_primitives::transaction::Transaction::read(
            raw.as_slice(),
            zcash_protocol::consensus::BranchId::Catecash,
        )
        .unwrap();
        let outputs = &tx.transparent_bundle().unwrap().vout;
        assert_eq!(outputs.len(), 2);
        assert_eq!(outputs[0].value().into_u64(), 500_000);
        assert_eq!(outputs[1].value().into_u64(), 490_000);
    }

    #[test]
    fn signs_transparent_mainnet_send_with_mainnet_branch() {
        let secret_hex = format!("{:0>64}", "1");
        let secret = decode_key(&secret_hex).unwrap();
        let source = TransparentAddress::from_pubkey(&PublicKey::from_secret_key(&secret));
        let addr = encode_address(&source, CateNetwork::Mainnet).unwrap();
        assert!(addr.starts_with("Ca"));
        let script: zcash_transparent::address::Script = source.script().into();
        let request = SpendRequest {
            network: "mainnet".into(),
            secret_hex,
            destination: addr.clone(),
            amount: "10000000".into(),
            tip_height: 300,
            entropy_hex: "02".repeat(32),
            utxos: vec![Utxo {
                txid: "03".repeat(32),
                index: 0,
                value: "20000000".into(),
                script_hex: hex::encode(script.0.0),
                height: 1,
                coinbase: true,
            }],
        };
        let result = build_send(request).unwrap();
        assert_eq!(result.network, "mainnet");
        assert_eq!(result.source_address, addr);
        assert_eq!(result.amount, "10000000");
        let raw = hex::decode(&result.raw_hex).unwrap();
        let tx = zcash_primitives::transaction::Transaction::read(
            raw.as_slice(),
            zcash_protocol::consensus::BranchId::CatecashMainnet,
        )
        .unwrap();
        let outputs = &tx.transparent_bundle().unwrap().vout;
        assert_eq!(outputs[0].value().into_u64(), 10_000_000);
    }
}
