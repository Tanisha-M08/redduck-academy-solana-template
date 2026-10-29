# 04 — Merkle Airdrop Solution & Test Results

## Program Design

1. **Config & Single-Use Initialization (Criterion 01, 15)**:
   - PDA `[b"config"]` is initialized once using Anchor `init`, storing `merkle_root`, `signer`, `mint`, and `vault`.
   - Cannot be re-initialized.
2. **PDA Vault (Criterion 02)**:
   - Vault is a TokenAccount owned by the program `Config` PDA at `[b"vault"]`.
3. **Merkle Proof Verification (Criterion 03, 04, 05)**:
   - Reconstructs leaf from `keccak256(sha256(claimant.key() || amount.to_le_bytes()))`.
   - Walks proof with sorted pairs and verifies root matches `config.merkle_root`.
   - Pays verified amount to claimant's ATA using `Config` PDA seeds.
4. **Anti-Double-Claim Guard (Criterion 06, 15)**:
   - Both claim routes (`claim` and `claim_with_signature`) use standard Anchor `init` for the `Claim` PDA at `[b"claim", claimant.key().as_ref()]`.
   - No `init_if_needed` is used. This enforces the required single-use account initialization guard: any second claim attempt fails on-chain because the account already exists.
5. **Ed25519 Signature Verification & Message Validation (Criterion 07, 08, 09, 14)**:
   - Inspects the preceding instruction in the transaction (`current_index - 1`) from the instructions sysvar.
   - Verifies the program ID is `ed25519_program::ID`.
   - Verifies the signer matches `config.signer` (unauthorized keys rejected with `InvalidSigner` `0x1773`).
   - Verifies the signed message bytes match `claimant.key() || amount.to_le_bytes() || program_id`.
   - Prevents cross-user signature replay: Bob cannot submit Alice's signature authorized by the trusted signer, because the reconstructed message containing Bob's public key fails to match Alice's signed message, rejecting with `InvalidSignatureMessage` (`0x1774`).

---

## Test Execution Evidence (12/12 Passing)

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
