# 04 — Merkle Airdrop

An Anchor program on Solana providing an airdrop with two independent ways to claim:

1. **Merkle Proof Path**: Prove inclusion in the off-chain Merkle tree and claim allocated tokens.
2. **Signature Path**: Present an Ed25519 signature from a designated trusted signer binding the recipient, amount, and program deployment.

Both paths share an on-chain `Claim` PDA per claimant, ensuring each claimant can claim exactly once regardless of the claim method.

---

## Architecture & Verification

- **Merkle Tree**: Leaves constructed via `keccak256(sha256(claimant || amount.to_le_bytes()))`, walked with sorted-pair hashing against `config.merkle_root`.
- **Ed25519 Signature Verification**: Native Solana instruction introspected via `instructions` sysvar (`current_index - 1`). Signed message must match `claimant || amount.to_le_bytes() || program_id`, signed by `config.signer`.
- **Cross-User Replay Protection (Criterion 14)**: Signatures bind the claimant's public key. A signature generated for Alice cannot be claimed by Bob (rejected with `0x1774` `InvalidSignatureMessage` or `0x7d6` `ConstraintSeeds`).
- **Anti-Double-Claim Guard**: Claim PDAs `[b"claim", claimant.key().as_ref()]` enforce strict single-use claim semantics.

---

## Test Execution

```bash
npm run test:merkleAirdrop
```

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
