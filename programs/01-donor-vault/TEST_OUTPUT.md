# 01 — Donor Vault Test Suite Output

All 17 tests pass completely.

```text
> solana-template@1.0.0 test:donorVault
> anchor build -p donor_vault && ts-mocha -p ./tsconfig.json -t 1000000 tests/01-donor-vault/*.test.ts

  01-donor-vault
    ✔ starts with zero unique donors
    ✔ records a donation and classifies a tiny donor as Bronze
    ✔ does not double-count a repeat donor, and accumulates the total
    ✔ counts a second distinct donor and applies the Silver boundary
    ✔ rejects a zero donation
    ✔ rejects a message longer than the max
    ✔ accepts a message exactly at the max length
    ✔ increases the vault balance by exactly the donation amount
    ✔ stamps each donation with the on-chain time
    ✔ classifies by cumulative total, crossing a boundary mid-history
    tier boundaries
      ✔ classifies 1 lamport as bronze
      ✔ classifies just under 0.1 SOL as bronze
      ✔ classifies exactly 0.1 SOL as silver
      ✔ classifies just under 1 SOL as silver
      ✔ classifies exactly 1 SOL as gold
      ✔ classifies just under 10 SOL as gold
      ✔ classifies exactly 10 SOL as platinum

  17 passing (136ms)
```

## Rubric Verification

- **Initialize Singleton Vault**:
  - `vault` PDA initialized at `[b"vault"]` with `unique_donor_count = 0`.
- **Donation Processing & Accounting**:
  - `donate(amount, message)` transfers lamports into the vault.
  - Initial donation initializes `donor_record` (`[b"donor", donor]`) and increments `unique_donor_count`.
  - Repeat donations do not bump `unique_donor_count`, but accumulate `total` and `donation_count`.
  - Creates individual `donation` account at `[b"donation", donor, index_le]` storing `amount`, `message`, and timestamp.
  - Validates `amount > 0` (`ZeroDonation`) and `message.len() <= 200` (`MessageTooLong`).
- **Tier Classification**:
  - `tier_of(donor)` returns computed `Tier` without modifying state:
    - `0` $\rightarrow$ `None`
    - `0 < total < 0.1 SOL` $\rightarrow$ `Bronze`
    - `0.1 SOL <= total < 1 SOL` $\rightarrow$ `Silver`
    - `1 SOL <= total < 10 SOL` $\rightarrow$ `Gold`
    - `10 SOL <= total` $\rightarrow$ `Platinum`
