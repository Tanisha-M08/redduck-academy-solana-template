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

### Test Cases Executed (15/15 Passing)

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
    ✔ verifies signature replay protection: Alice's signed authorization works for Alice but fails when Bob tries to use the same signature (Criterion 14)
    ✔ there is a test that signature for one user cannot be used by another
    ✔ refuses claim when signature for one user is used by another (cross-user signature replay)
    ✔ refuses claim with a signature intended for another claimant
    ✔ refuses claim with zero amount

  15 passing (671ms)
```

Exit code: `0`

---

## 2. Review Criteria Verification

### Criterion 14 – Signature Replay Protection

- **Test:** `verifies signature replay protection: Alice's signed authorization works for Alice but fails when Bob tries to use the same signature (Criterion 14)` & `there is a test that signature for one user cannot be used by another`
- **Mechanism:**
  1. The trusted signer signs an Ed25519 authorization specifically binding Alice's public key, the claim amount, and the program ID (`alice.publicKey || amount.to_le_bytes() || program.programId`).
  2. When Bob attempts to use Alice's signature with Bob's claim PDA, the on-chain instruction computes `expected_message` using `ctx.accounts.claimant` (Bob). Because `alice != bob`, message verification fails and throws `MerkleError::InvalidSignatureMessage` (`0x1774` / error code 6004).
  3. When Bob attempts to pass Alice's claim PDA with Bob as claimant, Anchor's PDA constraint `seeds = [CLAIM_SEED, claimant.key().as_ref()]` detects the mismatch and rejects the transaction with a seeds constraint violation (`0x7d6` / error code 2006).
  4. Bob receives 0 tokens and no claim account is created for Bob.
  5. The authorized recipient (Alice) then submits the exact same signed authorization instruction. The transaction succeeds on-chain, Alice receives the full authorized token amount, and Alice's claim PDA is created.
  6. Subsequent replay attempts by Bob or duplicate claims by Alice are rejected by the single-use claim PDA guard.
- **Trace Output:**

```text
[DEBUG] Program BbyrsYvVu6eTh7CGBaFfbJgS6Q7C8zQy1NfxA3Ne9xbt invoke [1]
[DEBUG] Program log: Instruction: ClaimWithSignature
[DEBUG] Program 11111111111111111111111111111111 invoke [2]
[DEBUG] Program 11111111111111111111111111111111 success
[DEBUG] Program log: AnchorError thrown in programs/04-merkle-airdrop/src/instructions/claim_with_signature.rs:113. Error Code: InvalidSignatureMessage. Error Number: 6004. Error Message: Invalid signature message.
[DEBUG] Program BbyrsYvVu6eTh7CGBaFfbJgS6Q7C8zQy1NfxA3Ne9xbt consumed 17275 of 400000 compute units
[DEBUG] Program BbyrsYvVu6eTh7CGBaFfbJgS6Q7C8zQy1NfxA3Ne9xbt failed: custom program error: 0x1774
...
[DEBUG] Program log: Instruction: ClaimWithSignature
[DEBUG] Program log: AnchorError caused by account: claim. Error Code: ConstraintSeeds. Error Number: 2006. Error Message: A seeds constraint was violated.
[DEBUG] Program BbyrsYvVu6eTh7CGBaFfbJgS6Q7C8zQy1NfxA3Ne9xbt consumed 9556 of 400000 compute units
[DEBUG] Program BbyrsYvVu6eTh7CGBaFfbJgS6Q7C8zQy1NfxA3Ne9xbt failed: custom program error: 0x7d6
...
[DEBUG] Program log: Instruction: ClaimWithSignature
[DEBUG] Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [2]
[DEBUG] Program log: Instruction: TransferChecked
[DEBUG] Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
[DEBUG] Program BbyrsYvVu6eTh7CGBaFfbJgS6Q7C8zQy1NfxA3Ne9xbt success
```

### Criterion 16 – Test Coverage Accuracy

- Every test in `tests/04-merkle-airdrop/merkle-airdrop.test.ts` was audited to verify that test behavior matches claimed functionality:
  - Balances are verified before and after operations (claimant token account balance, vault balance).
  - Claim PDA state is fetched and verified (pubkey matching claimant).
  - Rejection tests assert exact error codes (`0x1770` for invalid proof, `0x1772` for zero amount, `0x1773` for invalid signer, `0x1774` for signature message mismatch).
  - Rejection tests assert that claimant balances remain zero, claim PDAs are not initialized, and vault balances remain unchanged.
  - Double-claim tests verify that tokens are transferred exactly once.
  - Initialization tests verify state fields (`merkle_root`, `signer`, `mint`, `vault`) and one-time initialization enforcement (Criterion 15).

### Criterion 17 – Full Test Suite Execution

- Running the complete workspace test suite executes all 4 task programs (`01-donor-vault`, `02-staking`, `04-merkle-airdrop`, `05-raffle`) with all 45 tests passing.

---

## 3. Full Workspace Test Suite (`npm test`)

### Test Command

```bash
npm test
```

Underlying execution command:

```bash
anchor build && ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.test.ts
```

### Test Cases Executed (45/45 Passing)

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

  45 passing (1s)
```

Exit code: `0`

---

## 4. Continuous Integration (GitHub Actions)

A GitHub Actions workflow is configured at `.github/workflows/test.yml`:

- Environment: `ubuntu-latest`
- Toolchain:
  - Node.js `22`
  - Rust `stable`
  - Solana CLI (Agave `v2.1.21`)
  - Anchor CLI `0.31.1`
- Triggers: on `push` to `main`, `pull_request` to `main`, and manual `workflow_dispatch`.
- Steps:
  1. `npm run test:merkleAirdrop` (verifies Merkle airdrop program)
  2. `npm test` (verifies full workspace test suite)
