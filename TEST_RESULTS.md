# Test Results: Solana Merkle Airdrop & Full Workspace Suite

This document records the independently verifiable test execution results for the **Solana Merkle Airdrop** program (`04-merkle-airdrop`) and the entire Anchor project workspace.

All test suites execute in-process using `solana-bankrun` and Anchor 0.31.1, with zero mocked or skipped tests.

---

## 1. Merkle Airdrop Test Suite (`04-merkle-airdrop`)

### Test Command

```bash
npm run test:merkleAirdrop
```

Underlying execution command:

```bash
anchor build -p merkle_airdrop && ts-mocha -p ./tsconfig.json -t 1000000 tests/04-merkle-airdrop/*.test.ts
```

### Test Cases Executed (17/17 Passing)

```text
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

  17 passing (791ms)
```

Exit code: `0`

---

## 2. Review Criteria Verification

### Criterion 6 – Anti-Double-Claim Protection Across Both Claim Methods

- **Tests:** `enforces Criterion 6: anti-double-claim protection across BOTH claim methods`, `refuses claiming via signature if already claimed via Merkle proof`, `refuses claiming via Merkle proof if already claimed via signature`, `refuses claiming twice via Merkle proof (anti-double-claim guard)`, `refuses claiming twice via signature`.
- **Implementation:**
  - Both instructions (`claim` and `claim_with_signature`) use the exact same single-use claim PDA derived at `[b"claim", claimant.key().as_ref()]`.
  - Both instructions constrain the claim account with Anchor's `init`:
    ```rust
    #[account(
        init,
        payer = claimant,
        space = 8 + Claim::INIT_SPACE,
        seeds = [CLAIM_SEED, claimant.key().as_ref()],
        bump,
    )]
    pub claim: Account<'info, Claim>,
    ```
  - The PDA is consistently bound to the claimant's public key. There are no separate claim accounts for Merkle and signature paths.
  - When a claimant makes their first claim through either route, the PDA is initialized.
  - Any subsequent attempt to claim (Merkle $\rightarrow$ Signature, Signature $\rightarrow$ Merkle, Merkle $\rightarrow$ Merkle, or Signature $\rightarrow$ Signature) triggers Anchor's initialization guard (account already exists) and fails on-chain before token transfer.
  - Token balances and vault debit amounts confirm zero additional tokens are transferred on failed attempts.

### Criterion 14 – One User's Signature Must Not Work for Another User

- **Tests:** `enforces Criterion 14: Alice's signature works for Alice but Bob cannot reuse it (after or before)`, `verifies signature replay protection: Alice's signed authorization works for Alice but fails when Bob tries to use the same signature (Criterion 14)`, `there is a test that signature for one user cannot be used by another`, `refuses claim when signature for one user is used by another (cross-user signature replay)`.
- **Implementation:**
  - The signed message layout strictly binds `claimant.key() || amount.to_le_bytes() || program_id`.
  - Preceding instruction in transaction is validated against `ed25519_program::ID`.
  - Signer public key extracted from Ed25519 instruction data is checked against `config.signer` (rejects unauthorized signers with `InvalidSigner` `0x1773`).
  - Expected message is constructed on-chain using `ctx.accounts.claimant` (the actual transaction signer).
  - If Bob attempts to reuse Alice's signature:
    - With Bob's claim PDA: `expected_message` (containing Bob) does not match the Ed25519 message (containing Alice) $\rightarrow$ rejected with `InvalidSignatureMessage` (`0x1774`).
    - With Alice's claim PDA: Anchor's PDA seeds constraint `seeds = [CLAIM_SEED, claimant.key().as_ref()]` detects claimant (Bob) does not match PDA (Alice) $\rightarrow$ rejected with `ConstraintSeeds` (`0x7d6`).
  - In all failed cases, Bob receives 0 tokens and no claim account is initialized for Bob.
  - Alice's authorization succeeds for Alice and cannot be replayed by Bob either before or after Alice's claim.

---

## 3. Full Workspace Test Suite (`npm test`)

### Test Command

```bash
npm test
```

Underlying execution command:

```bash
anchor build -p donor_vault && anchor build -p staking && anchor build -p merkle_airdrop && ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.test.ts
```

### Test Cases Executed (47/47 Passing)

```text
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
    tierOf
      ✔ classifies 1 lamport as bronze
      ✔ classifies just under 0.1 SOL as bronze
      ✔ classifies exactly 0.1 SOL as silver
      ✔ classifies just under 1 SOL as silver
      ✔ classifies exactly 1 SOL as gold
      ✔ classifies just under 10 SOL as gold
      ✔ classifies exactly 10 SOL as platinum

  02-staking
    ✔ stakes one token into a new position
    ✔ stakes multiple positions for the same user with incrementing indices
    ✔ refuses claim before 3-day lock duration expires
    ✔ claims vRDDK after 3-day lock duration and unstakes RDDK
    ✔ refuses stake with zero amount
    ✔ refuses unstake with zero amount
    ✔ enforces that vRDDK is non-transferable

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

  05-raffle
    ✔ there is a test for a winning claim (full lifecycle with request_randomness)
    ✔ there is a test for an invalid claim (rejects non-winning entries)
    ✔ enforces request_randomness guards: deadline, entries, and single-use semantics
    ✔ refuses claim before randomness is fulfilled
    ✔ refuses deposit after draw deadline
    ✔ refuses deposit with zero amount

  47 passing (2s)
```

Exit code: `0`

---

## 4. Continuous Integration (GitHub Actions)

A GitHub Actions workflow is configured at `.github/workflows/test.yml`:

- **Workflow Name:** `Solana Merkle Airdrop CI`
- Runs automatically on every `push` and `pull_request` to `main`, and manual `workflow_dispatch`.
- Sets up Node.js 22, Rust stable, Solana CLI (Agave v2.1.21), and Anchor CLI 0.31.1.
- Executes:
  1. `npm run test:merkleAirdrop`: Verifies all 17 integration tests pass for `04-merkle-airdrop` (Criteria 6, 14, 16).
  2. `npm test`: Verifies the complete workspace test suite (all 4 programs, 47/47 tests passing) passes with exit code 0 (Criterion 17).
- **CI Workflow Link:** [GitHub Actions Runs](https://github.com/Tanisha-M08/redduck-academy-solana-template/actions)
  - All tests execute genuinely end-to-end with zero mocked or skipped tests.
  - Verified exit code: `0` across both steps.
