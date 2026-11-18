# Test Suite Execution Outputs

### 01 — Donor Vault (`npm run test:donorVault`)

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

### 04 — Merkle Airdrop (`npm run test:merkleAirdrop`)

```text
> solana-template@1.0.0 test:merkleAirdrop
> anchor build -p merkle_airdrop && ts-mocha -p ./tsconfig.json -t 1000000 tests/04-merkle-airdrop/*.test.ts

  04-merkle-airdrop
    ✔ stores the Merkle root and trusted signer pubkey upon initialization
    ✔ refuses re-initializing the configuration (one-time initialization guard)
    ✔ claims an allocation with a valid Merkle proof
    ✔ refuses claim with an invalid Merkle proof
    ✔ refuses claiming twice via Merkle proof (anti-double-claim guard)
    ✔ claims an allocation with a valid signature
    ✔ refuses claiming via signature if already claimed via Merkle proof
    ✔ refuses claiming via Merkle proof if already claimed via signature
    ✔ refuses claiming twice via signature
    ✔ refuses claim with a signature signed by an unauthorized key
    ✔ enforces Criterion 6: anti-double-claim protection across BOTH claim methods
    ✔ enforces Criterion 14: Alice's signature works for Alice but Bob cannot reuse it (after or before)
    ✔ verifies signature replay protection: Alice's signed authorization works for Alice but fails when Bob tries to use the same signature (Criterion 14)
    ✔ there is a test that signature for one user cannot be used by another
    ✔ refuses claim when signature for one user is used by another (cross-user signature replay)
    ✔ refuses claim with a signature intended for another claimant
    ✔ refuses claim with zero amount

  17 passing (763ms)
```

#### Runtime Log Trace: Cross-User Signature Replay Test (Criterion 14)

```text
[DEBUG] Program log: Instruction: ClaimWithSignature
[DEBUG] Program log: AnchorError thrown in programs/04-merkle-airdrop/src/instructions/claim_with_signature.rs:118. Error Code: InvalidSignatureMessage. Error Number: 6004. Error Message: Invalid signature message.
[DEBUG] Program BbyrsYvVu6eTh7CGBaFfbJgS6Q7C8zQy1NfxA3Ne9xbt consumed 17275 of 400000 compute units
[DEBUG] Program BbyrsYvVu6eTh7CGBaFfbJgS6Q7C8zQy1NfxA3Ne9xbt failed: custom program error: 0x1774
[DEBUG] Program log: AnchorError caused by account: claim. Error Code: ConstraintSeeds. Error Number: 2006. Error Message: A seeds constraint was violated.
[DEBUG] Program BbyrsYvVu6eTh7CGBaFfbJgS6Q7C8zQy1NfxA3Ne9xbt failed: custom program error: 0x7d6
[DEBUG] Program log: Instruction: ClaimWithSignature
[DEBUG] Program log: Instruction: TransferChecked
[DEBUG] Program BbyrsYvVu6eTh7CGBaFfbJgS6Q7C8zQy1NfxA3Ne9xbt success
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
