# Installation Guide

This project is an **Anchor + Rust Solana program template** with TypeScript tests
(`ts-mocha` + `solana-bankrun`). To build and test it locally you need the following
toolchain:

| Tool         | Version used by this repo | Why                                  |
| ------------ | ------------------------- | ------------------------------------ |
| Rust + Cargo | latest stable             | Compiles the on-chain programs       |
| Solana CLI   | `stable` (Agave)          | Build, deploy, local validator, keys |
| Anchor CLI   | `0.31.1`                  | Framework used by the programs       |
| Node.js      | LTS (≥ 20, 22 recommended) | Runs the TypeScript test suite      |
| npm          | bundled with Node.js      | Installs JS dependencies             |

> The required versions come from `Anchor.toml` (`anchor_version = "0.31.1"`) and
> `package.json`.

---

## Quick install (recommended)

The Solana Foundation provides a single script that installs **Rust, Solana CLI,
Anchor CLI, and Node.js** (npm ships with Node) in one shot. This is the easiest path on
macOS, Linux, and WSL.

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
```

After it finishes, restart your terminal (or `source` your shell profile) and verify
everything is on your `PATH`:

```bash
rustc --version && solana --version && anchor --version && node --version && npm --version
```

> ⚠️ This installs the **latest** Anchor. This repo pins **0.31.1** — after installing,
> switch to it (see [Pin Anchor 0.31.1](#pin-anchor-0311-this-repo)).

If the quick installer fails, follow the manual steps below.

---

## Platform prerequisites

### macOS

Install the Xcode command line tools (provides a C compiler, `git`, etc.):

```bash
xcode-select --install
```

Homebrew is handy for Node/npm but not required.

### Windows

Anchor/Solana development is **not supported natively** on Windows. You must use
**WSL (Windows Subsystem for Linux)**. In an elevated PowerShell:

```powershell
wsl --install
```

Then open Ubuntu and follow the **Linux** instructions below inside WSL.

### Linux

**Debian / Ubuntu / Mint:**

```bash
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libudev-dev llvm libclang-dev protobuf-compiler libssl-dev
```

**Fedora / RHEL:**

```bash
sudo dnf upgrade --refresh
sudo dnf group install c-development development-tools
sudo dnf install pkg-config openssl-devel
```

---

## Manual installation (step by step)

### 1. Rust + Cargo

Install via [rustup](https://rustup.rs):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

Reload your shell so `cargo` is on the `PATH`:

```bash
source "$HOME/.cargo/env"
rustc --version
cargo --version
```

### 2. Solana CLI (Agave)

Install the stable release:

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

The installer prints a line to add Solana to your `PATH` — add it to your shell profile
(`~/.zshrc` on macOS, `~/.bashrc` on Linux). It looks like:

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

Restart your terminal, then verify:

```bash
solana --version
```

> You can pin an exact version by replacing `stable` with a release tag, e.g.
> `https://release.anza.xyz/v4.0.0/install`.

Generate a local wallet keypair (used by `Anchor.toml`'s provider at
`~/.config/solana/id.json`):

```bash
solana-keygen new
```

### 3. Anchor CLI (via AVM)

Anchor is installed through **AVM**, the Anchor Version Manager. Rust/Cargo (step 1) must
be installed first.

```bash
cargo install --git https://github.com/solana-foundation/anchor avm --force
avm --version
```

#### Pin Anchor 0.31.1 (this repo)

```bash
avm install 0.31.1
avm use 0.31.1
anchor --version   # -> anchor-cli 0.31.1
```

### 4. Node.js + npm

Install Node.js (LTS ≥ 20); **npm ships with it**, nothing extra to install. Using
[nvm](https://github.com/nvm-sh/nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# restart your shell, then:
nvm install --lts
node --version
npm --version
```

---

## Verify everything

```bash
rustc --version
cargo --version
solana --version
anchor --version   # should be 0.31.1
node --version
npm --version
```

---

## Build & test this project

From the repository root:

```bash
# Install JS dependencies
npm install

# Build the on-chain programs
anchor build

# Run the full test suite
npm test

# Or run a single program's tests, e.g.:
npm run test:donorVault
```

Tests use `solana-bankrun`, so they run in-process and **do not require a running local
validator**.

> The repo ships an `.npmrc` with `legacy-peer-deps=true`, so `npm install` works
> out of the box. It's needed because `anchor-bankrun@0.5.0` still declares its peer as
> `@coral-xyz/anchor@^0.30` (which excludes 0.31) even though it works fine with 0.31.1.

---

## Troubleshooting

- **`anchor: command not found`** — make sure `~/.cargo/bin` (AVM/Cargo binaries) is on
  your `PATH`, then run `avm use 0.31.1`.
- **Wrong Anchor version** — run `avm list` to see installed versions and `avm use 0.31.1`.
- **Linker / `cc` errors on Linux/WSL** — install the platform prerequisites above
  (`build-essential`, `pkg-config`, `libssl-dev`, etc.).
- **`solana` not found after install** — you skipped adding the `export PATH=...` line to
  your shell profile; add it and restart the terminal.
- **`npm error ERESOLVE` mentioning `anchor-bankrun` / `@coral-xyz/anchor`** — the
  `.npmrc` (`legacy-peer-deps=true`) normally prevents this. If you removed it, either
  restore it or run `npm install --legacy-peer-deps`. The conflict is a stale peer range,
  not a real incompatibility.

## References

- Solana installation guide: <https://solana.com/docs/intro/installation>
- Agave (Solana CLI) install: <https://docs.anza.xyz/cli/install>
- Anchor installation: <https://www.anchor-lang.com/docs/installation>
