use anchor_lang::prelude::*;

/// PDA seed for the singleton vault account.
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

/// PDA seed prefix for a per-donor record (`[DONOR_SEED, donor_pubkey]`).
#[constant]
pub const DONOR_SEED: &[u8] = b"donor";

/// PDA seed prefix for a single donation
/// (`[DONATION_SEED, donor_pubkey, index_le_bytes]`).
#[constant]
pub const DONATION_SEED: &[u8] = b"donation";

pub const MAX_MESSAGE_LEN: usize = 200;

