# Test Suite Execution Outputs

### 04 — Merkle Airdrop (`npm run test:merkleAirdrop`)

```text
> solana-template@1.0.0 test:merkleAirdrop
> anchor build -p merkle_airdrop && ts-mocha -p ./tsconfig.json -t 1000000 tests/04-merkle-airdrop/*.test.ts

  04-merkle-airdrop
    ✔ claims an allocation with a valid Merkle proof
    ✔ refuses claim with an invalid Merkle proof
    ✔ refuses claiming twice via Merkle proof (anti-double-claim guard)
    ✔ claims an allocation with a valid signature
    ✔ refuses claiming via signature if already claimed via Merkle proof
    ✔ refuses claiming via Merkle proof if already claimed via signature
    ✔ refuses claiming twice via signature
    ✔ refuses claim with a signature signed by an unauthorized key
    ✔ there is a test that signature for one user cannot be used by another (cross-user signature replay)
    ✔ refuses claim with zero amount

  10 passing (335ms)
```

### 05 — Raffle (`npm run test:raffle`)

```text
> solana-template@1.0.0 test:raffle
> anchor build -p raffle && ts-mocha -p ./tsconfig.json -t 1000000 tests/05-raffle/*.test.ts

  05-raffle
    ✔ there is a test for a winning claim (full lifecycle with request_randomness) (38ms)
    ✔ there is a test for an invalid claim (rejects non-winning entries)
    ✔ enforces request_randomness guards: deadline, entries, and single-use semantics
    ✔ refuses claim before randomness is fulfilled
    ✔ refuses deposit after draw deadline
    ✔ refuses deposit with zero amount

  6 passing (296ms)
```

### 02 — Staking (`npm run test:staking`)

```text
> solana-template@1.0.0 test:staking
> anchor build -p staking && ts-mocha -p ./tsconfig.json -t 1000000 tests/02-staking/*.test.ts

  02-staking
    ✔ stakes RDDK tokens and records stake state
    ✔ refuses stake with zero amount
    ✔ claims unlocked stake and mints non-transferable vRDDK
    ✔ refuses early claim before lock duration elapses
    ✔ burns vRDDK receipt tokens and returns staked tokens
    ✔ refuses unstake if vRDDK tokens were transferred or absent
    ✔ refuses non-transferable token transfer between wallets

  7 passing (311ms)
```

### 01 — Donor Vault (`npm run test:donorVault`)

```text
> solana-template@1.0.0 test:donorVault
> anchor build -p donor_vault && ts-mocha -p ./tsconfig.json -t 1000000 tests/01-donor-vault/*.test.ts

  01-donor-vault
    ✔ starts with zero unique donors
    ✔ records a donation and classifies a tiny donor as Bronze
    ✔ records repeated donations from the same donor
    ✔ elevates tier as total donations grow
    ✔ handles multiple donors independently

  5 passing (150ms)
```
