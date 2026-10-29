use anchor_lang::prelude::*;

#[error_code]
pub enum DonorVaultError {
    #[msg("Donation amount must be greater than zero")]
    ZeroDonation,
    #[msg("Donation message exceeds maximum length")]
    MessageTooLong,
    #[msg("Math overflow")]
    MathOverflow,
}
