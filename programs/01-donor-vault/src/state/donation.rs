use crate::constants::MAX_MESSAGE_LEN;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Donation {
    pub amount: u64,
    #[max_len(MAX_MESSAGE_LEN)]
    pub message: String,
    pub timestamp: i64,
}
