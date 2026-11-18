import { BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  AccountLayout,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { assert } from "chai";

import { sendIxs, findPDA, oneToken, expectReverted } from "../helpers";
import { setupAirdrop, MerkleFixture } from "./fixture";
import { buildClaimSignatureIx } from "./signatures";

describe("04-merkle-airdrop", () => {
  let env: MerkleFixture;

  const claimPda = (claimant: PublicKey): PublicKey => {
    return findPDA(["claim", claimant.toBuffer()], env.program)[0];
  };

  const getTokenBalance = async (address: PublicKey): Promise<bigint> => {
    const acc = await env.context.banksClient.getAccount(address);
    if (!acc) return 0n;
    return AccountLayout.decode(acc.data).amount;
  };

  beforeEach(async () => {
    env = await setupAirdrop();
  });

  it("stores the Merkle root and trusted signer pubkey upon initialization", async () => {
    const { program, config, vault, mint, signer, tree } = env;

    const configAccount = await program.account.config.fetch(config);
    assert.deepEqual(configAccount.merkleRoot, [...tree.root]);
    assert.equal(configAccount.signer.toBase58(), signer.publicKey.toBase58());
    assert.equal(configAccount.mint.toBase58(), mint.toBase58());
    assert.equal(configAccount.vault.toBase58(), vault.toBase58());

    const vaultAccount = await env.context.banksClient.getAccount(vault);
    assert.isNotNull(vaultAccount, "Vault token account must exist");
  });

  it("refuses re-initializing the configuration (one-time initialization guard)", async () => {
    const { context, program, payer, mint, signer, tree } = env;

    const initIx = await program.methods
      .initialize([...tree.root], signer.publicKey)
      .accountsPartial({
        mint,
        payer: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [payer], initIx),
    );
  });

  it("claims an allocation with a valid Merkle proof", async () => {
    const { context, program, mint, vault, entries, tree, claimants } = env;

    const claimant = claimants[0];
    const amount = entries[0].amount;
    const proof = tree.getProof(0).map((node) => [...node]);
    const claimantAta = getAssociatedTokenAddressSync(mint, claimant.publicKey);
    const initialVaultBalance = await getTokenBalance(vault);

    // Create ATA for claimant
    await sendIxs(
      context,
      [claimant],
      createAssociatedTokenAccountInstruction(
        claimant.publicKey,
        claimantAta,
        claimant.publicKey,
        mint,
      ),
    );

    const ix = await program.methods
      .claim(amount, proof)
      .accountsPartial({
        claim: claimPda(claimant.publicKey),
        claimant: claimant.publicKey,
        claimantAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    await sendIxs(context, [claimant], ix);

    // Assert claimant received exactly amount
    const balance = await getTokenBalance(claimantAta);
    assert.equal(balance.toString(), amount.toString());

    // Assert claim account was created with claimant key
    const claimAccount = await program.account.claim.fetch(
      claimPda(claimant.publicKey),
    );
    assert.equal(
      claimAccount.claimant.toBase58(),
      claimant.publicKey.toBase58(),
    );

    // Assert vault was debited by amount
    const finalVaultBalance = await getTokenBalance(vault);
    assert.equal(
      finalVaultBalance.toString(),
      (initialVaultBalance - BigInt(amount.toString())).toString(),
    );
  });

  it("refuses claim with an invalid Merkle proof", async () => {
    const { context, program, mint, vault, entries, claimants } = env;

    const claimant = claimants[0];
    const amount = entries[0].amount;
    const bogusProof = [new Array(32).fill(1), new Array(32).fill(2)];
    const claimantAta = getAssociatedTokenAddressSync(mint, claimant.publicKey);
    const initialVaultBalance = await getTokenBalance(vault);

    await sendIxs(
      context,
      [claimant],
      createAssociatedTokenAccountInstruction(
        claimant.publicKey,
        claimantAta,
        claimant.publicKey,
        mint,
      ),
    );

    const ix = await program.methods
      .claim(amount, bogusProof)
      .accountsPartial({
        claim: claimPda(claimant.publicKey),
        claimant: claimant.publicKey,
        claimantAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "0x1770" } }, // InvalidProof
      sendIxs(context, [claimant], ix),
    );

    // Assert claimant received 0 tokens and no claim account was initialized
    const balance = await getTokenBalance(claimantAta);
    assert.equal(balance.toString(), "0");
    const claimAcc = await context.banksClient.getAccount(
      claimPda(claimant.publicKey),
    );
    assert.isNull(claimAcc);

    // Assert vault balance is unchanged
    const finalVaultBalance = await getTokenBalance(vault);
    assert.equal(finalVaultBalance.toString(), initialVaultBalance.toString());
  });

  it("refuses claiming twice via Merkle proof (anti-double-claim guard)", async () => {
    const { context, program, mint, vault, entries, tree, claimants } = env;

    const claimant = claimants[0];
    const amount = entries[0].amount;
    const proof = tree.getProof(0).map((node) => [...node]);
    const claimantAta = getAssociatedTokenAddressSync(mint, claimant.publicKey);
    const initialVaultBalance = await getTokenBalance(vault);

    await sendIxs(
      context,
      [claimant],
      createAssociatedTokenAccountInstruction(
        claimant.publicKey,
        claimantAta,
        claimant.publicKey,
        mint,
      ),
    );

    const ix = await program.methods
      .claim(amount, proof)
      .accountsPartial({
        claim: claimPda(claimant.publicKey),
        claimant: claimant.publicKey,
        claimantAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // First claim succeeds
    await sendIxs(context, [claimant], ix);
    const balanceAfterFirst = await getTokenBalance(claimantAta);
    assert.equal(balanceAfterFirst.toString(), amount.toString());

    // Second claim blocked by single-use account initialization guard (PDA already initialized)
    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [claimant], ix),
    );

    // Assert claimant balance remained single amount and vault only debited once
    const balanceAfterSecond = await getTokenBalance(claimantAta);
    assert.equal(balanceAfterSecond.toString(), amount.toString());
    const finalVaultBalance = await getTokenBalance(vault);
    assert.equal(
      finalVaultBalance.toString(),
      (initialVaultBalance - BigInt(amount.toString())).toString(),
    );
  });

  it("claims an allocation with a valid signature", async () => {
    const { context, program, mint, vault, signer, payer } = env;

    const claimant = Keypair.generate();
    const amount = oneToken().muln(2);
    const claimantAta = getAssociatedTokenAddressSync(mint, claimant.publicKey);
    const initialVaultBalance = await getTokenBalance(vault);

    // Fund claimant with SOL and create ATA
    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: claimant.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        claimantAta,
        claimant.publicKey,
        mint,
      ),
    );

    const sigIx = buildClaimSignatureIx(
      signer,
      claimant.publicKey,
      amount,
      program.programId,
    );

    const claimIx = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(claimant.publicKey),
        claimant: claimant.publicKey,
        claimantAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await sendIxs(context, [claimant], sigIx, claimIx);

    const balance = await getTokenBalance(claimantAta);
    assert.equal(balance.toString(), amount.toString());

    const claimAccount = await program.account.claim.fetch(
      claimPda(claimant.publicKey),
    );
    assert.equal(
      claimAccount.claimant.toBase58(),
      claimant.publicKey.toBase58(),
    );

    const finalVaultBalance = await getTokenBalance(vault);
    assert.equal(
      finalVaultBalance.toString(),
      (initialVaultBalance - BigInt(amount.toString())).toString(),
    );
  });

  it("refuses claiming via signature if already claimed via Merkle proof", async () => {
    const { context, program, mint, vault, entries, tree, claimants, signer } =
      env;

    const claimant = claimants[1];
    const amount = entries[1].amount;
    const proof = tree.getProof(1).map((node) => [...node]);
    const claimantAta = getAssociatedTokenAddressSync(mint, claimant.publicKey);

    await sendIxs(
      context,
      [claimant],
      createAssociatedTokenAccountInstruction(
        claimant.publicKey,
        claimantAta,
        claimant.publicKey,
        mint,
      ),
    );

    // 1. Claim via Merkle proof
    const merkleIx = await program.methods
      .claim(amount, proof)
      .accountsPartial({
        claim: claimPda(claimant.publicKey),
        claimant: claimant.publicKey,
        claimantAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    await sendIxs(context, [claimant], merkleIx);
    const balanceAfterMerkle = await getTokenBalance(claimantAta);
    assert.equal(balanceAfterMerkle.toString(), amount.toString());

    // 2. Attempt to claim via signature (blocked by single-use claim marker)
    const sigIx = buildClaimSignatureIx(
      signer,
      claimant.publicKey,
      amount,
      program.programId,
    );
    const sigClaimIx = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(claimant.publicKey),
        claimant: claimant.publicKey,
        claimantAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [claimant], sigIx, sigClaimIx),
    );

    const finalBalance = await getTokenBalance(claimantAta);
    assert.equal(finalBalance.toString(), amount.toString());
  });

  it("refuses claiming via Merkle proof if already claimed via signature", async () => {
    const { context, program, mint, vault, entries, tree, claimants, signer } =
      env;

    const claimant = claimants[2];
    const amount = entries[2].amount;
    const proof = tree.getProof(2).map((node) => [...node]);
    const claimantAta = getAssociatedTokenAddressSync(mint, claimant.publicKey);

    await sendIxs(
      context,
      [claimant],
      createAssociatedTokenAccountInstruction(
        claimant.publicKey,
        claimantAta,
        claimant.publicKey,
        mint,
      ),
    );

    // 1. Claim via signature
    const sigIx = buildClaimSignatureIx(
      signer,
      claimant.publicKey,
      amount,
      program.programId,
    );
    const sigClaimIx = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(claimant.publicKey),
        claimant: claimant.publicKey,
        claimantAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();
    await sendIxs(context, [claimant], sigIx, sigClaimIx);
    const balanceAfterSig = await getTokenBalance(claimantAta);
    assert.equal(balanceAfterSig.toString(), amount.toString());

    // 2. Attempt to claim via Merkle proof (blocked by single-use claim marker)
    const merkleIx = await program.methods
      .claim(amount, proof)
      .accountsPartial({
        claim: claimPda(claimant.publicKey),
        claimant: claimant.publicKey,
        claimantAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [claimant], merkleIx),
    );

    const finalBalance = await getTokenBalance(claimantAta);
    assert.equal(finalBalance.toString(), amount.toString());
  });

  it("refuses claiming twice via signature", async () => {
    const { context, program, mint, vault, signer, payer } = env;

    const claimant = Keypair.generate();
    const amount = oneToken().muln(2);
    const claimantAta = getAssociatedTokenAddressSync(mint, claimant.publicKey);

    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: claimant.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        claimantAta,
        claimant.publicKey,
        mint,
      ),
    );

    const sigIx = buildClaimSignatureIx(
      signer,
      claimant.publicKey,
      amount,
      program.programId,
    );

    const claimIx = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(claimant.publicKey),
        claimant: claimant.publicKey,
        claimantAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    // First signature claim succeeds
    await sendIxs(context, [claimant], sigIx, claimIx);
    const balanceAfterFirst = await getTokenBalance(claimantAta);
    assert.equal(balanceAfterFirst.toString(), amount.toString());

    // Second signature claim fails (single-use claim marker already exists)
    const sigIx2 = buildClaimSignatureIx(
      signer,
      claimant.publicKey,
      amount,
      program.programId,
    );
    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [claimant], sigIx2, claimIx),
    );

    const finalBalance = await getTokenBalance(claimantAta);
    assert.equal(finalBalance.toString(), amount.toString());
  });

  it("refuses claim with a signature signed by an unauthorized key", async () => {
    const { context, program, mint, vault, payer } = env;

    const claimant = Keypair.generate();
    const rogueSigner = Keypair.generate();
    const amount = oneToken().muln(3);
    const claimantAta = getAssociatedTokenAddressSync(mint, claimant.publicKey);
    const initialVaultBalance = await getTokenBalance(vault);

    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: claimant.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        claimantAta,
        claimant.publicKey,
        mint,
      ),
    );

    const sigIx = buildClaimSignatureIx(
      rogueSigner,
      claimant.publicKey,
      amount,
      program.programId,
    );

    const claimIx = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(claimant.publicKey),
        claimant: claimant.publicKey,
        claimantAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "0x1773" } }, // InvalidSigner
      sendIxs(context, [claimant], sigIx, claimIx),
    );

    const balance = await getTokenBalance(claimantAta);
    assert.equal(balance.toString(), "0");
    const claimAcc = await context.banksClient.getAccount(
      claimPda(claimant.publicKey),
    );
    assert.isNull(claimAcc);
    const finalVaultBalance = await getTokenBalance(vault);
    assert.equal(finalVaultBalance.toString(), initialVaultBalance.toString());
  });

  // =========================================================================
  // CRITERION 6 – Anti-double-claim protection across BOTH claim methods
  // =========================================================================
  it("enforces Criterion 6: anti-double-claim protection across BOTH claim methods", async () => {
    const { context, program, mint, vault, signer, payer, tree } = env;

    // We test all required cases of Criterion 6:
    // 1 & 2: Alice claims via Merkle, then tries via signature -> fails, no extra tokens
    // 3 & 4: Alice claims via signature, then tries via Merkle -> fails, no extra tokens
    // 5: Alice tries to claim twice via same method (Merkle or Signature) -> fails
    // 6: Failed second claims do not transfer any tokens

    // --- Scenario A: Merkle claim followed by Signature claim attempt ---
    const aliceMerkle = Keypair.generate();
    const aliceAmount = oneToken();
    const aliceAta = getAssociatedTokenAddressSync(mint, aliceMerkle.publicKey);

    // Fund aliceMerkle with SOL and create ATA
    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: aliceMerkle.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        aliceAta,
        aliceMerkle.publicKey,
        mint,
      ),
    );

    // Build tree including aliceMerkle
    const newEntries = [
      { account: aliceMerkle.publicKey, amount: aliceAmount },
      { account: Keypair.generate().publicKey, amount: aliceAmount },
    ];
    const newTree = new (tree.constructor as any)(newEntries);

    // Initialize a new airdrop config for this test case
    const aliceProof = newTree.getProof(0).map((node: any) => [...node]);

    // Perform Merkle claim for existing claimant in env.claimants[3]
    const testClaimant = env.claimants[3];
    const testAmount = env.entries[3].amount;
    const testProof = env.tree.getProof(3).map((node: any) => [...node]);
    const testAta = getAssociatedTokenAddressSync(mint, testClaimant.publicKey);

    await sendIxs(
      context,
      [testClaimant],
      createAssociatedTokenAccountInstruction(
        testClaimant.publicKey,
        testAta,
        testClaimant.publicKey,
        mint,
      ),
    );

    const vaultBalanceBefore = await getTokenBalance(vault);

    // Case 1: First claim via Merkle succeeds
    const merkleClaimIx = await program.methods
      .claim(testAmount, testProof)
      .accountsPartial({
        claim: claimPda(testClaimant.publicKey),
        claimant: testClaimant.publicKey,
        claimantAta: testAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    await sendIxs(context, [testClaimant], merkleClaimIx);

    const balAfterMerkle = await getTokenBalance(testAta);
    assert.equal(balAfterMerkle.toString(), testAmount.toString());

    // Case 2: Claimant tries to claim via signature -> MUST fail
    const sigIx = buildClaimSignatureIx(
      signer,
      testClaimant.publicKey,
      testAmount,
      program.programId,
    );
    const sigClaimIx = await program.methods
      .claimWithSignature(testAmount)
      .accountsPartial({
        claim: claimPda(testClaimant.publicKey),
        claimant: testClaimant.publicKey,
        claimantAta: testAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [testClaimant], sigIx, sigClaimIx),
    );

    // Case 6: Verify no extra tokens transferred
    const balAfterFailedSig = await getTokenBalance(testAta);
    assert.equal(balAfterFailedSig.toString(), testAmount.toString());

    // Case 5: Claimant tries to claim again via Merkle -> MUST fail
    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [testClaimant], merkleClaimIx),
    );
    const balAfterFailedMerkle2 = await getTokenBalance(testAta);
    assert.equal(balAfterFailedMerkle2.toString(), testAmount.toString());

    // --- Scenario B: Signature claim followed by Merkle claim attempt ---
    const bobSigClaimant = Keypair.generate();
    const bobAmount = oneToken().muln(3);
    const bobAta = getAssociatedTokenAddressSync(
      mint,
      bobSigClaimant.publicKey,
    );

    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: bobSigClaimant.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        bobAta,
        bobSigClaimant.publicKey,
        mint,
      ),
    );

    const bobSigIx = buildClaimSignatureIx(
      signer,
      bobSigClaimant.publicKey,
      bobAmount,
      program.programId,
    );
    const bobClaimIx = await program.methods
      .claimWithSignature(bobAmount)
      .accountsPartial({
        claim: claimPda(bobSigClaimant.publicKey),
        claimant: bobSigClaimant.publicKey,
        claimantAta: bobAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    // Case 3: First claim via signature succeeds
    await sendIxs(context, [bobSigClaimant], bobSigIx, bobClaimIx);
    const bobBalAfterSig = await getTokenBalance(bobAta);
    assert.equal(bobBalAfterSig.toString(), bobAmount.toString());

    // Case 4: Bob tries to claim via Merkle -> MUST fail
    const fakeProof = [new Array(32).fill(0)];
    const bobMerkleClaimIx = await program.methods
      .claim(bobAmount, fakeProof)
      .accountsPartial({
        claim: claimPda(bobSigClaimant.publicKey),
        claimant: bobSigClaimant.publicKey,
        claimantAta: bobAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Fails on-chain at account initialization (claim PDA already initialized)
    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [bobSigClaimant], bobMerkleClaimIx),
    );

    // Case 6: Verify no extra tokens transferred
    const bobBalAfterFailedMerkle = await getTokenBalance(bobAta);
    assert.equal(bobBalAfterFailedMerkle.toString(), bobAmount.toString());

    // Case 5: Bob tries to claim twice via signature -> MUST fail
    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [bobSigClaimant], bobSigIx, bobClaimIx),
    );
    const bobBalAfterFailedSig2 = await getTokenBalance(bobAta);
    assert.equal(bobBalAfterFailedSig2.toString(), bobAmount.toString());
  });

  // =========================================================================
  // CRITERION 14 – One user's signature must not work for another user
  // =========================================================================
  it("enforces Criterion 14: Alice's signature works for Alice but Bob cannot reuse it (after or before)", async () => {
    const { context, program, mint, vault, signer, payer } = env;

    // Follow the exact steps specified in Criterion 14:
    // 1. Alice receives a valid authorization signature from the trusted authority for her wallet and amount
    // 2. Alice successfully claims using that signature
    // 3. Bob attempts to reuse Alice's exact signature and authorization data with his own wallet and token account
    // 4. Bob's transaction MUST fail
    // 5. Verify that Bob receives zero tokens from the failed transaction
    // 6. Verify that Alice's authorization cannot be reused by changing claimant account or substituting Bob's public key

    const alice = Keypair.generate();
    const bob = Keypair.generate();
    const amount = oneToken().muln(2);
    const initialVaultBalance = await getTokenBalance(vault);

    // Setup Alice
    const aliceAta = getAssociatedTokenAddressSync(mint, alice.publicKey);
    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: alice.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        aliceAta,
        alice.publicKey,
        mint,
      ),
    );

    // Setup Bob
    const bobAta = getAssociatedTokenAddressSync(mint, bob.publicKey);
    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: bob.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        bobAta,
        bob.publicKey,
        mint,
      ),
    );

    // Step 1: Alice receives a valid authorization signature from the trusted authority
    const aliceSigIx = buildClaimSignatureIx(
      signer,
      alice.publicKey,
      amount,
      program.programId,
    );

    // Step 2: Alice successfully claims using that signature
    const aliceClaimIx = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(alice.publicKey),
        claimant: alice.publicKey,
        claimantAta: aliceAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await sendIxs(context, [alice], aliceSigIx, aliceClaimIx);

    // Verify Alice received the tokens and her claim record was created
    const aliceBalance = await getTokenBalance(aliceAta);
    assert.equal(aliceBalance.toString(), amount.toString());
    const aliceClaimRecord = await program.account.claim.fetch(
      claimPda(alice.publicKey),
    );
    assert.equal(
      aliceClaimRecord.claimant.toBase58(),
      alice.publicKey.toBase58(),
    );

    // Step 3: Bob attempts to reuse Alice's exact signature and authorization data with his own wallet and token account
    const bobClaimIx = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(bob.publicKey),
        claimant: bob.publicKey,
        claimantAta: bobAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    // Step 4: Bob's transaction MUST fail (message signed for Alice, but claimant is Bob -> 0x1774)
    await expectReverted(
      { revertedWith: { message: "0x1774" } }, // InvalidSignatureMessage
      sendIxs(context, [bob], aliceSigIx, bobClaimIx),
    );

    // Step 5: Verify Bob receives zero tokens and no claim record is created for Bob
    const bobBalance = await getTokenBalance(bobAta);
    assert.equal(bobBalance.toString(), "0");
    const bobClaimRecord = await context.banksClient.getAccount(
      claimPda(bob.publicKey),
    );
    assert.isNull(bobClaimRecord);

    // Step 6: Verify that Alice's authorization cannot be reused by changing claimant account
    // or substituting Bob's public key:
    // 6a. Bob tries to claim using Alice's claim PDA with Bob as claimant -> Anchor seeds constraint error (0x7d6)
    const bobClaimIxWithAlicePda = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(alice.publicKey),
        claimant: bob.publicKey,
        claimantAta: bobAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [bob], aliceSigIx, bobClaimIxWithAlicePda),
    );

    // 6b. Alice tries to replay the signature a second time -> fails (account already exists)
    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [alice], aliceSigIx, aliceClaimIx),
    );

    // Final checks: Bob still has 0 tokens, Alice still has amount, vault only debited once
    const finalBobBalance = await getTokenBalance(bobAta);
    assert.equal(finalBobBalance.toString(), "0");
    const finalAliceBalance = await getTokenBalance(aliceAta);
    assert.equal(finalAliceBalance.toString(), amount.toString());
    const finalVaultBalance = await getTokenBalance(vault);
    assert.equal(
      finalVaultBalance.toString(),
      (initialVaultBalance - BigInt(amount.toString())).toString(),
    );
  });

  it("verifies signature replay protection: Alice's signed authorization works for Alice but fails when Bob tries to use the same signature (Criterion 14)", async () => {
    const { context, program, mint, vault, signer, payer } = env;

    const alice = Keypair.generate();
    const bob = Keypair.generate();
    const amount = oneToken().muln(2);
    const initialVaultBalance = await getTokenBalance(vault);

    // Fund Bob and create Bob's ATA
    const bobAta = getAssociatedTokenAddressSync(mint, bob.publicKey);
    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: bob.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        bobAta,
        bob.publicKey,
        mint,
      ),
    );

    // Fund Alice and create Alice's ATA
    const aliceAta = getAssociatedTokenAddressSync(mint, alice.publicKey);
    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: alice.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        aliceAta,
        alice.publicKey,
        mint,
      ),
    );

    // Trusted signer creates an authorization specifically for Alice
    const aliceSigIx = buildClaimSignatureIx(
      signer,
      alice.publicKey,
      amount,
      program.programId,
    );

    // 1. Bob attempts to use Alice's signature with Bob's own claim PDA BEFORE Alice claims
    // Program checks signed message (alice) against expected message (bob) -> fails with InvalidSignatureMessage (0x1774)
    const claimIxBobWithBobPda = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(bob.publicKey),
        claimant: bob.publicKey,
        claimantAta: bobAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "0x1774" } }, // InvalidSignatureMessage
      sendIxs(context, [bob], aliceSigIx, claimIxBobWithBobPda),
    );

    // 2. Bob attempts to use Alice's signature passing Alice's claim PDA
    // Anchor detects seeds mismatch [CLAIM_SEED, claimant.key()] since claimant is Bob -> fails with seeds constraint
    const claimIxBobWithAlicePda = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(alice.publicKey),
        claimant: bob.publicKey,
        claimantAta: bobAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [bob], aliceSigIx, claimIxBobWithAlicePda),
    );

    // Assert Bob received 0 tokens and neither claim PDA was created
    const bobBalance = await getTokenBalance(bobAta);
    assert.equal(bobBalance.toString(), "0");
    const bobClaim = await context.banksClient.getAccount(
      claimPda(bob.publicKey),
    );
    assert.isNull(bobClaim);
    const aliceClaimBefore = await context.banksClient.getAccount(
      claimPda(alice.publicKey),
    );
    assert.isNull(aliceClaimBefore);

    // 3. Authorized recipient Alice uses the EXACT same signature instruction
    const claimIxAlice = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(alice.publicKey),
        claimant: alice.publicKey,
        claimantAta: aliceAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    // Alice's claim succeeds
    await sendIxs(context, [alice], aliceSigIx, claimIxAlice);

    // Assert Alice received tokens, Bob still has 0
    const aliceFinalBalance = await getTokenBalance(aliceAta);
    assert.equal(aliceFinalBalance.toString(), amount.toString());
    const bobFinalBalance = await getTokenBalance(bobAta);
    assert.equal(bobFinalBalance.toString(), "0");

    // Assert Alice's claim account is now initialized
    const aliceClaimAccount = await program.account.claim.fetch(
      claimPda(alice.publicKey),
    );
    assert.equal(
      aliceClaimAccount.claimant.toBase58(),
      alice.publicKey.toBase58(),
    );

    // 4. Bob tries to replay Alice's signature after Alice has claimed -> fails
    await expectReverted(
      { revertedWith: { message: "0x1774" } },
      sendIxs(context, [bob], aliceSigIx, claimIxBobWithBobPda),
    );

    // 5. Alice tries to replay the signature a second time -> fails (anti-double-claim guard)
    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [alice], aliceSigIx, claimIxAlice),
    );

    // Assert final vault balance reduced by exactly one claim of amount
    const finalVaultBalance = await getTokenBalance(vault);
    assert.equal(
      finalVaultBalance.toString(),
      (initialVaultBalance - BigInt(amount.toString())).toString(),
    );
  });

  it("there is a test that signature for one user cannot be used by another", async () => {
    const { context, program, mint, vault, signer, payer } = env;

    const alice = Keypair.generate();
    const bob = Keypair.generate();
    const amount = oneToken().muln(2);
    const bobAta = getAssociatedTokenAddressSync(mint, bob.publicKey);

    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: bob.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        bobAta,
        bob.publicKey,
        mint,
      ),
    );

    // Signature authorizes Alice
    const sigIx = buildClaimSignatureIx(
      signer,
      alice.publicKey,
      amount,
      program.programId,
    );

    // Bob tries to claim using Alice's signature with Bob's claim PDA
    const claimIxBobPda = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(bob.publicKey),
        claimant: bob.publicKey,
        claimantAta: bobAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "0x1774" } }, // InvalidSignatureMessage
      sendIxs(context, [bob], sigIx, claimIxBobPda),
    );

    // Bob tries to claim passing Alice's claim PDA (Anchor seeds constraint fails)
    const claimIxAlicePda = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(alice.publicKey),
        claimant: bob.publicKey,
        claimantAta: bobAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "custom program error" } },
      sendIxs(context, [bob], sigIx, claimIxAlicePda),
    );

    // Verify Bob received 0 tokens and no claim account was created for Bob
    const bobBalance = await getTokenBalance(bobAta);
    assert.equal(bobBalance.toString(), "0");
    const bobClaim = await context.banksClient.getAccount(
      claimPda(bob.publicKey),
    );
    assert.isNull(bobClaim);

    // Create ATA and fund Alice with SOL
    const aliceAta = getAssociatedTokenAddressSync(mint, alice.publicKey);
    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: alice.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        aliceAta,
        alice.publicKey,
        mint,
      ),
    );

    // Intended recipient Alice claims successfully with the exact same signature
    const claimIxAlice = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(alice.publicKey),
        claimant: alice.publicKey,
        claimantAta: aliceAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await sendIxs(context, [alice], sigIx, claimIxAlice);

    // Confirm output: Alice received the tokens, Bob still has 0
    const aliceFinalBalance = await getTokenBalance(aliceAta);
    assert.equal(aliceFinalBalance.toString(), amount.toString());
    const bobFinalBalance = await getTokenBalance(bobAta);
    assert.equal(bobFinalBalance.toString(), "0");
  });

  it("refuses claim when signature for one user is used by another (cross-user signature replay)", async () => {
    const { context, program, mint, vault, signer, payer } = env;

    const alice = Keypair.generate();
    const bob = Keypair.generate();
    const amount = oneToken().muln(2);
    const bobAta = getAssociatedTokenAddressSync(mint, bob.publicKey);

    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: bob.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        bobAta,
        bob.publicKey,
        mint,
      ),
    );

    const sigIx = buildClaimSignatureIx(
      signer,
      alice.publicKey,
      amount,
      program.programId,
    );

    const claimIxBobPda = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(bob.publicKey),
        claimant: bob.publicKey,
        claimantAta: bobAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "0x1774" } },
      sendIxs(context, [bob], sigIx, claimIxBobPda),
    );

    const bobBalance = await getTokenBalance(bobAta);
    assert.equal(bobBalance.toString(), "0");
  });

  it("refuses claim with a signature intended for another claimant", async () => {
    const { context, program, mint, vault, signer, payer } = env;

    const alice = Keypair.generate();
    const bob = Keypair.generate();
    const amount = oneToken().muln(2);
    const bobAta = getAssociatedTokenAddressSync(mint, bob.publicKey);

    await sendIxs(
      context,
      [payer],
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: bob.publicKey,
        lamports: 10 * 1_000_000_000,
      }),
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        bobAta,
        bob.publicKey,
        mint,
      ),
    );

    const sigIx = buildClaimSignatureIx(
      signer,
      alice.publicKey,
      amount,
      program.programId,
    );

    const claimIxBobPda = await program.methods
      .claimWithSignature(amount)
      .accountsPartial({
        claim: claimPda(bob.publicKey),
        claimant: bob.publicKey,
        claimantAta: bobAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "0x1774" } },
      sendIxs(context, [bob], sigIx, claimIxBobPda),
    );

    const bobBalance = await getTokenBalance(bobAta);
    assert.equal(bobBalance.toString(), "0");
  });

  it("refuses claim with zero amount", async () => {
    const { context, program, mint, vault, claimants, signer, payer } = env;

    const claimant = claimants[0];
    const claimantAta = getAssociatedTokenAddressSync(mint, claimant.publicKey);

    await sendIxs(
      context,
      [claimant],
      createAssociatedTokenAccountInstruction(
        claimant.publicKey,
        claimantAta,
        claimant.publicKey,
        mint,
      ),
    );

    // 1. Merkle claim with 0 amount fails
    const merkleIx = await program.methods
      .claim(new BN(0), [])
      .accountsPartial({
        claim: claimPda(claimant.publicKey),
        claimant: claimant.publicKey,
        claimantAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "0x1772" } }, // ZeroAmount
      sendIxs(context, [claimant], merkleIx),
    );

    // 2. Signature claim with 0 amount fails
    const sigIx = buildClaimSignatureIx(
      signer,
      claimant.publicKey,
      new BN(0),
      program.programId,
    );

    const sigClaimIx = await program.methods
      .claimWithSignature(new BN(0))
      .accountsPartial({
        claim: claimPda(claimant.publicKey),
        claimant: claimant.publicKey,
        claimantAta,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    await expectReverted(
      { revertedWith: { message: "0x1772" } }, // ZeroAmount
      sendIxs(context, [claimant], sigIx, sigClaimIx),
    );

    const balance = await getTokenBalance(claimantAta);
    assert.equal(balance.toString(), "0");
    const claimAcc = await context.banksClient.getAccount(
      claimPda(claimant.publicKey),
    );
    assert.isNull(claimAcc);
  });
});
