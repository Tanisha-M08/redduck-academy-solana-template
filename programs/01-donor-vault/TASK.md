# 01 — Donor Tiers Vault

A charity vault, and the first task in the template. Anyone sends funds with a
short message; the program sorts each donor into a loyalty **tier** by their
cumulative contribution, and keeps their whole donation history as fetchable
accounts.

Like every task here it ships as a **starter** — you write the program. Because
it's first, this brief is fuller than the later ones, and the **entire test
suite is already written**: your job is to make `npm run test:donorVault` green.

## Design note

The habit this task drills: **you don't grow one account to hold an unbounded
list — you give each item its own account.** A donation is its own PDA, seeded
by the donor and a zero-based index (the donor's current `donation_count`), and
account sizes come from `#[derive(InitSpace)]` — never hand-counted. Funds move
as explicit lamport transfers into the vault PDA (`1 SOL` = 1,000,000,000
lamports). The only on-chain getter is `tier_of`, which *computes* a value;
anything stored is read by fetching the account, not through a getter.

## What you're given

- `src/lib.rs` — the three instructions: `initialize`, `donate`, `tier_of`.
- `src/constants.rs` — the PDA seeds and `MAX_MESSAGE_LEN`.
- `src/state/tier.rs` — the `Tier` variants (order is the on-chain encoding);
  you write the classification.
- `tests/01-donor-vault/` — the complete bankrun suite. **This is the precise
  spec** — read it for the exact account names, fields, seeds, and behaviour.

## What you implement

- The state accounts — `Vault`, `DonorRecord`, `Donation` (their fields).
- The errors — `DonorVaultError`.
- The three instructions — account contexts + logic.
- `Tier::from_total` — the tier classification.

## Flow

1. **`initialize()`** — create the singleton `vault` PDA that receives donations
   and tracks the unique donor count.
2. **`donate(amount, message)`** — move `amount` lamports into the vault, store
   the donation in its own PDA at the donor's next index, and add to their
   running total. Reject a zero amount and an over-long message. The **first**
   donation from an address bumps the unique donor count; repeats don't.
3. **`tier_of(donor)`** — return the donor's tier, computed from their total.
   It's the only getter — everything else the client reads by fetching accounts.

## Tiers

Strict boundaries on the cumulative total (the `Tier` order is the encoding):

| Tier     | Cumulative total          |
| -------- | ------------------------- |
| None     | `total == 0`              |
| Bronze   | `0 < total < 0.1 SOL`     |
| Silver   | `0.1 SOL ≤ total < 1 SOL` |
| Gold     | `1 SOL ≤ total < 10 SOL`  |
| Platinum | `10 SOL ≤ total`          |

Edges: `0` → None, `1` lamport → Bronze, exactly `0.1 SOL` → Silver, exactly
`10 SOL` → Platinum.

## Accounts / PDAs

| PDA            | Seeds                            | Holds                                   |
| -------------- | -------------------------------- | --------------------------------------- |
| `vault`        | `[b"vault"]`                     | unique donor count; receives lamports   |
| `donor_record` | `[b"donor", donor]`              | one donor's total + donation count      |
| `donation`     | `[b"donation", donor, index_le]` | a single donation (`index` is `u64` LE) |

## No getters for stored data

There's no point in an on-chain instruction that just hands back stored bytes —
the client fetches the account directly:

| You want…                | Fetch…                                          |
| ------------------------ | ----------------------------------------------- |
| total donated by an addr | `DonorRecord.total`                             |
| number of donations      | `DonorRecord.donation_count`                    |
| a single donation        | the `Donation` PDA at `[b"donation", donor, i]` |
| unique donor count       | `Vault.unique_donor_count`                      |

## Run it

```bash
npm run test:donorVault
```
