impl Tier {
    pub fn from_total(total: u64) -> Self {
        if total == 0 {
            Self::None
        } else if total < 100_000_000 {
            Self::Bronze
        } else if total < 1_000_000_000 {
            Self::Silver
        } else if total < 10_000_000_000 {
            Self::Gold
        } else {
            Self::Platinum
        }
    }
}
