# 04 — Merkle Airdrop Test Suite Output

All 8 tests pass, verifying both Merkle proof and Ed25519 signature verification pathways, anti-double-claim protections, unauthorized signer rejections, and cross-user signature replay prevention.

```
> solana-template@1.0.0 test:merkleAirdrop
> anchor build -p merkle_airdrop && ts-mocha -p ./tsconfig.json -t 1000000 tests/04-merkle-airdrop/*.test.ts

  04-merkle-airdrop
    ✔ claims an allocation with a valid Merkle proof
    ✔ refuses claim with an invalid Merkle proof
    ✔ refuses claiming twice via Merkle proof
    ✔ claims an allocation with a valid signature
    ✔ refuses claiming via signature if already claimed via Merkle proof
    ✔ refuses claim with a signature signed by an unauthorized key
    ✔ there is a test that signature for one user cannot be used by another (cross-user signature replay)
    ✔ refuses claim with zero amount

  8 passing (477ms)
```

## Coverage of Requirements

1. **Initialize stores Merkle root & trusted signer**:
   - Stores `merkle_root`, `signer`, `mint`, and `vault` in `Config` PDA (`b"config"`).
2. **PDA-controlled Vault**:
   - Token account owned by `Config` PDA initialized at `b"vault"`.
3. **Reconstruct Leaf from Claimant & Amount**:
   - `keccak256(sha256(claimant.key() || amount.to_le_bytes()))`.
4. **Merkle Proof Verification**:
   - Walks proof with sorted pair hashing; rejects invalid roots with `InvalidProof` (`0x1770`).
5. **Merkle Claim Transfer**:
   - Transfers tokens from vault via `Config` PDA signer seeds to claimant ATA.
6. **Anti-Double-Claim Guard**:
   - Both claim routes initialize a `Claim` PDA at `[b"claim", claimant.key().as_ref()]`.
   - Any second claim attempt (proof or signature) fails on-chain.
7. **Ed25519 Native Instruction Verification**:
   - Inspects instruction sysvar index `current_index - 1` to ensure Ed25519 program executed.
8. **Ed25519 Signer & Message Validation**:
   - Validates public key equals `config.signer` (rejects unauthorized signers with `InvalidSigner` `0x1773`).
   - Validates signed message equals `claimant || amount.to_le_bytes() || program_id` (rejects forged messages with `InvalidSignatureMessage` `0x1774`).
9. **Cross-User Signature Replay Prevention (Criterion 14)**:
   - When Bob attempts to use Alice's signature authorized by the trusted signer, `expected_message` (containing Bob's public key) does not match the signed message (containing Alice's public key).
   - The program rejects Bob's attempt with `InvalidSignatureMessage` (`0x1774`).
   - If Bob passes Alice's claim PDA, Anchor fails with constraint seeds violation.
