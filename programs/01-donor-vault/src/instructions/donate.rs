use anchor_lang::prelude::*;
use anchor_lang::solana_program;

use crate::constants::{DONATION_SEED, DONOR_SEED, MAX_MESSAGE_LEN, VAULT_SEED};
use crate::error::DonorVaultError;
use crate::state::{Donation, DonorRecord, Vault};

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        payer = donor,
        space = 8 + DonorRecord::INIT_SPACE,
        seeds = [DONOR_SEED, donor.key().as_ref()],
        bump,
    )]
    pub donor_record: Account<'info, DonorRecord>,

    #[account(
        init,
        payer = donor,
        space = 8 + Donation::INIT_SPACE,
        seeds = [DONATION_SEED, donor.key().as_ref(), &donor_record.donation_count.to_le_bytes()],
        bump,
    )]
    pub donation: Account<'info, Donation>,

    pub system_program: Program<'info, System>,
}

pub fn donate(ctx: Context<Donate>, amount: u64, message: String) -> Result<()> {
    require!(amount > 0, DonorVaultError::ZeroDonation);
    require!(message.len() <= MAX_MESSAGE_LEN, DonorVaultError::MessageTooLong);

    let vault = &mut ctx.accounts.vault;
    let donor_record = &mut ctx.accounts.donor_record;
    let donation = &mut ctx.accounts.donation;

    // First donation by this donor increments unique_donor_count
    if donor_record.donation_count == 0 {
        vault.unique_donor_count = vault
            .unique_donor_count
            .checked_add(1)
            .ok_or(DonorVaultError::MathOverflow)?;
    }

    // Transfer SOL from donor to vault
    let transfer_ix = solana_program::system_instruction::transfer(
        &ctx.accounts.donor.key(),
        &vault.key(),
        amount,
    );
    solana_program::program::invoke(
        &transfer_ix,
        &[
            ctx.accounts.donor.to_account_info(),
            vault.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // Update donor record
    donor_record.total = donor_record
        .total
        .checked_add(amount)
        .ok_or(DonorVaultError::MathOverflow)?;
    donor_record.donation_count = donor_record
        .donation_count
        .checked_add(1)
        .ok_or(DonorVaultError::MathOverflow)?;

    // Fill donation
    donation.amount = amount;
    donation.message = message;
    donation.timestamp = Clock::get()?.unix_timestamp;

    Ok(())
}
