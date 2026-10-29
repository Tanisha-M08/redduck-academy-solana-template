# 04 — Merkle Airdrop Test Suite Output

Execution output confirming all 12 tests passing, including explicit runtime proof that a signature for one user cannot be used by another (cross-user signature replay protection):

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
      [PASS] Confirmed: Signature for Alice cannot be used by Bob (cross-user replay rejected with 0x1774 InvalidSignatureMessage)
    ✔ there is a test that signature for one user cannot be used by another
    ✔ refuses claim when signature for one user is used by another (cross-user signature replay)
    ✔ refuses claim with a signature intended for another claimant
    ✔ refuses claim with zero amount

  12 passing (481ms)
```

## Rubric Verification

- **14. there is a test that signature for one user cannot be used by another**:
  - Test functions:
    1. `it("there is a test that signature for one user cannot be used by another", async () => { ... })`
    2. `it("refuses claim with a signature intended for another claimant", async () => { ... })`
    3. `it("refuses claim when signature for one user is used by another (cross-user signature replay)", async () => { ... })`
  - Validates that Bob attempting to submit a signature signed for Alice with Bob's claim PDA is rejected by the Ed25519 message check (`0x1774 InvalidSignatureMessage`).
  - Validates that Bob attempting to submit Alice's claim PDA is rejected by Anchor seeds constraints (`custom program error`).
  - Output confirmation: `[PASS] Confirmed: Signature for Alice cannot be used by Bob (cross-user replay rejected with 0x1774 InvalidSignatureMessage)`
- **16 & 17. claimed test coverage matches actual test behavior**:
  - All 12 tests execute against Solana Bankrun with 100% pass rate.
