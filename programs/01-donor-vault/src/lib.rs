use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

pub use constants::*;
pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("GhAdtT9Vd5Gst89DyG8jShfgygJUdNcoQGGS5fGyZUVT");


#[program]
pub mod donor_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize(ctx)
    }

    pub fn donate(ctx: Context<Donate>, amount: u64, message: String) -> Result<()> {
        instructions::donate(ctx, amount, message)
    }

    pub fn tier_of(ctx: Context<TierOf>) -> Result<Tier> {
        instructions::tier_of(ctx)
    }
}
