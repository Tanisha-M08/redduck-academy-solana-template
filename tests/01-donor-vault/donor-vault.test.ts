import { Program, BN } from "@coral-xyz/anchor";
import { ProgramTestContext } from "solana-bankrun";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { assert } from "chai";

import { DonorVault } from "../../target/types/donor_vault";
import idl from "../../target/idl/donor_vault.json";
import {
  initBankrun,
  processTransaction,
  simulateReturnData,
  expectReverted,
  numToHex,
  findPDA,
  getTime,
  toBN,
  sol,
} from "../helpers";

describe("01-donor-vault", () => {
  let context: ProgramTestContext;
  let program: Program<DonorVault>;
  let accounts: Keypair[];
  let payer: Keypair;

  let vault: PublicKey;

  const donorRecord = (donor: PublicKey) =>
    findPDA(["donor", donor], program)[0];

  const donationPda = (donor: PublicKey, index: number) =>
    findPDA(
      ["donation", donor, toBN(index).toArrayLike(Buffer, "le", 8)],
      program,
    )[0];

  // Build the donate instruction and run it through the bank.
  const donate = async (
    donor: Keypair,
    index: number,
    amount: BN,
    message: string,
  ) => {
    const ix = await program.methods
      .donate(amount, message)
      .accountsPartial({
        donation: donationPda(donor.publicKey, index),
        donor: donor.publicKey,
      })
      .instruction();
    await processTransaction(context, new Transaction().add(ix), [donor]);
  };

  // The Tier enum's variants, in declaration order — a fieldless enum's return
  // data is a single byte holding the variant index.
  const TIERS = ["none", "bronze", "silver", "gold", "platinum"] as const;

  // tier_of is the only on-chain getter (a computed value). `.view()` can't be
  // used (bankrun rejects its unsigned tx), so we simulate a signed tx and read
  // the program's return data ourselves.
  const tierOf = async (donor: PublicKey) => {
    const ix = await program.methods.tierOf().accounts({ donor }).instruction();
    const data = await simulateReturnData(context, [payer], [ix]);
    return TIERS[data[0]];
  };

  before(async () => {
    ({ context, program, accounts } = await initBankrun(idl as DonorVault));
    payer = context.payer;

    vault = findPDA(["vault"], program)[0];

    const ix = await program.methods
      .initialize()
      .accounts({
        payer: payer.publicKey,
      })
      .instruction();
    await processTransaction(context, new Transaction().add(ix), [payer]);
  });

  it("starts with zero unique donors", async () => {
    const v = await program.account.vault.fetch(vault);
    assert.equal(v.uniqueDonorCount.toNumber(), 0);
  });

  it("records a donation and classifies a tiny donor as Bronze", async () => {
    await donate(payer, 0, toBN(1), "first gift");

    assert.equal(await tierOf(payer.publicKey), "bronze");

    const rec = await program.account.donorRecord.fetch(
      donorRecord(payer.publicKey),
    );
    assert.equal(rec.total.toNumber(), 1);
    assert.equal(rec.donationCount.toNumber(), 1);

    const donation = await program.account.donation.fetch(
      donationPda(payer.publicKey, 0),
    );
    assert.equal(donation.amount.toNumber(), 1);
    assert.equal(donation.message, "first gift");

    const v = await program.account.vault.fetch(vault);
    assert.equal(v.uniqueDonorCount.toNumber(), 1);
  });

  it("does not double-count a repeat donor, and accumulates the total", async () => {
    await donate(payer, 1, toBN(9), "second gift");

    const rec = await program.account.donorRecord.fetch(
      donorRecord(payer.publicKey),
    );
    assert.equal(rec.donationCount.toNumber(), 2);
    assert.equal(rec.total.toNumber(), 10);

    // Each donation kept its own account.
    const second = await program.account.donation.fetch(
      donationPda(payer.publicKey, 1),
    );
    assert.equal(second.message, "second gift");

    const v = await program.account.vault.fetch(vault);
    assert.equal(
      v.uniqueDonorCount.toNumber(),
      1,
      "repeat donor must not bump the count",
    );
  });

  it("counts a second distinct donor and applies the Silver boundary", async () => {
    const donor = accounts[0];

    // Exactly 0.1 SOL is the first amount that counts as Silver (not Bronze).
    await donate(donor, 0, sol(0.1), "to silver");

    assert.equal(await tierOf(donor.publicKey), "silver");

    const v = await program.account.vault.fetch(vault);
    assert.equal(v.uniqueDonorCount.toNumber(), 2);
  });

  it("rejects a zero donation", async () =>
    // 0x1770 = 6000 = ZeroDonation (the first Anchor custom error). The bankrun
    // error carries the code, not the name.
    expectReverted(
      { revertedWith: { message: numToHex(6000) } },
      donate(payer, 2, toBN(0), "nothing"),
    ));

  it("rejects a message longer than the max", async () =>
    // 0x1771 = 6001 = MessageTooLong.
    expectReverted(
      { revertedWith: { message: numToHex(6001) } },
      donate(accounts[1], 0, sol(0.01), "x".repeat(201)),
    ));

  it("accepts a message exactly at the max length", async () => {
    const donor = accounts[2];
    const message = "x".repeat(200);
    await donate(donor, 0, sol(0.01), message);

    const d = await program.account.donation.fetch(
      donationPda(donor.publicKey, 0),
    );
    assert.equal(d.message, message);
  });

  it("increases the vault balance by exactly the donation amount", async () => {
    const donor = accounts[3];
    const before = await context.banksClient.getBalance(vault);

    await donate(donor, 0, sol(2), "for the vault");

    const after = await context.banksClient.getBalance(vault);
    assert.equal((after - before).toString(), sol(2).toString());
  });

  it("stamps each donation with the on-chain time", async () => {
    const donor = accounts[4];
    await donate(donor, 0, sol(0.01), "stamped");

    const d = await program.account.donation.fetch(
      donationPda(donor.publicKey, 0),
    );
    const onchainTime = await getTime(context);
    assert.equal(d.timestamp.toString(), onchainTime.toString());
  });

  it("classifies by cumulative total, crossing a boundary mid-history", async () => {
    const donor = accounts[5];

    await donate(donor, 0, sol(0.05), "half");
    assert.equal(await tierOf(donor.publicKey), "bronze");

    await donate(donor, 1, sol(0.05), "the other half");
    assert.equal(await tierOf(donor.publicKey), "silver"); // 0.05 + 0.05 = 0.1 SOL

    const rec = await program.account.donorRecord.fetch(
      donorRecord(donor.publicKey),
    );
    assert.equal(rec.donationCount.toNumber(), 2);
    assert.equal(rec.total.toString(), sol(0.1).toString());
  });

  // Every strict tier boundary, each on a fresh single-donation donor.
  describe("tier boundaries", () => {
    const cases: Array<[string, BN, (typeof TIERS)[number]]> = [
      ["1 lamport", toBN(1), "bronze"],
      ["just under 0.1 SOL", sol(0.1).subn(1), "bronze"],
      ["exactly 0.1 SOL", sol(0.1), "silver"],
      ["just under 1 SOL", sol(1).subn(1), "silver"],
      ["exactly 1 SOL", sol(1), "gold"],
      ["just under 10 SOL", sol(10).subn(1), "gold"],
      ["exactly 10 SOL", sol(10), "platinum"],
    ];

    cases.forEach(([label, amount, expected], i) => {
      it(`classifies ${label} as ${expected}`, async () => {
        const donor = accounts[20 + i];
        await donate(donor, 0, amount, "boundary");
        assert.equal(await tierOf(donor.publicKey), expected);
      });
    });
  });
});
