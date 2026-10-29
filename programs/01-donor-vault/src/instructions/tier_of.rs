use anchor_lang::prelude::*;

use crate::constants::DONOR_SEED;
use crate::state::{DonorRecord, Tier};

#[derive(Accounts)]
pub struct TierOf<'info> {
    /// CHECK: The donor's public key (used to derive donor_record PDA)
    pub donor: AccountInfo<'info>,

    /// CHECK: The donor record PDA
    #[account(
        seeds = [DONOR_SEED, donor.key().as_ref()],
        bump,
    )]
    pub donor_record: AccountInfo<'info>,
}

pub fn tier_of(ctx: Context<TierOf>) -> Result<Tier> {
    if ctx.accounts.donor_record.data_is_empty() {
        return Ok(Tier::None);
    }
    let mut data: &[u8] = &ctx.accounts.donor_record.try_borrow_data()?;
    let record = DonorRecord::try_deserialize(&mut data)?;
    Ok(Tier::from_total(record.total))
}
