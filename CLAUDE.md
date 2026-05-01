# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Three independent subprojects under one repo, each with its own toolchain:

- `contracts/` — Foundry / Solidity 0.8.26 (Uniswap v4 hook + insurance fund)
- `agents/`    — Node 22 + TypeScript (3-node consensus + on-chain submitter)
- `frontend/`  — Next.js 16 + wagmi/viem + p5.js dashboard

Top-level `Makefile` is the canonical entry point. Always run language-native commands from inside each subdirectory — running `forge test` from the repo root will fail.

## Common commands

```bash
make install           # installs agents + frontend npm deps
make test              # cd contracts && forge test -v   (19 tests)
make build-contracts   # cd contracts && forge build
make deploy            # forge script script/Deploy.s.sol --rpc-url unichain_sepolia --broadcast --verify
make agents            # concurrently runs agent-0/1/2 on :4000/:4001/:4002
make frontend          # next dev on :3001
make up / make down    # docker compose all-in-one
```

Run a single Forge test: `cd contracts && forge test --match-test <name> -vvv`
Run a single agent only: `cd agents && NODE_ID=1 PORT=4001 npx tsx src/agent.ts`
Frontend lint: `cd frontend && npm run lint`

The `unichain_sepolia` RPC alias in `contracts/foundry.toml` resolves from `$UNICHAIN_SEPOLIA_RPC` — must be set before `make deploy`.

## High-level architecture

End-to-end flow:

```
PoolMetrics → 0G Sealed Inference (TEE) → 3-node gossip + 2-of-3 consensus
   → KeeperHub submitter → NeuralHook.submitConsensusResult()
   → beforeSwap returns currentFee | OVERRIDE_FEE_FLAG on every swap
```

The architecture only works because four cross-file invariants are preserved. **Breaking any one of them silently breaks the system without compile errors.**

### Invariant 1 — ILRisk enum must match across the boundary

`agents/src/types.ts` (`IL_RISK_INDEX`) and `contracts/src/NeuralHook.sol` (`RISK_LOW/MEDIUM/HIGH/CRITICAL`) define the same risk enum on each side. They must agree on **both** order *and* numeric value (LOW=0, MEDIUM=1, HIGH=2, CRITICAL=3). Same applies to fee tiers (`FEE_BY_RISK` ↔ `FEE_LOW/MEDIUM/HIGH/CRITICAL`).

### Invariant 2 — Oracle signature schema must match exactly

The off-chain signer (`agents/src/og-inference.ts` and `agents/src/keeperhub.ts`) packs the message with `ethers.solidityPackedKeccak256` using:

```
['bytes32','uint8','uint256','uint24','bool','uint8','uint256','uint256','address']
[resultHash, ilRisk, predictedILBps, recommendedFee, rebalanceSignal, yieldScore, timestamp, chainId, hookAddress]
```

`NeuralHook.submitConsensusResult` reproduces this with `keccak256(abi.encodePacked(...))` in the same order, then applies the EIP-191 `\x19Ethereum Signed Message:\n32` prefix. Any reordering, type widening, or missing field → `InvalidSignature` revert.

### Invariant 3 — Hook address must encode permission flag bits

Uniswap v4 reads the hook's permissions from the **lowest 14 bits of its address**. `contracts/src/HookMiner.sol` brute-forces a CREATE2 salt until the resulting address has those bits set to `FLAGS` (BEFORE_SWAP | AFTER_SWAP | BEFORE_ADD_LIQ | AFTER_ADD_LIQ | BEFORE_REMOVE_LIQ | AFTER_REMOVE_LIQ).

**Critical:** `forge script --broadcast` deploys CREATE2 calls through Nick's factory `0x4e59b44847b379578588920cA78FbF26c0B4956C`, **not** the deployer EOA. `Deploy.s.sol` mines against `NICK_FACTORY` and submits the deploy as `factory.call(salt ++ initcode)`. Mining against the deployer address — like a textbook example might — produces an address that does not match the actual deployment, and the pool init silently uses a hook with the wrong flag bits.

### Invariant 4 — Submission timing vs. MAX_STALENESS

`NeuralHook.MAX_STALENESS = 60` (seconds). The contract reverts with `StaleInference` if `block.timestamp > timestamp + 60` at execution time. This means the *signed* timestamp must be within 60s of the block that mines the tx — not 60s of when the agent submitted. On networks that mine slowly (Unichain Sepolia under contention can take 60–120s+), every tx that takes longer to mine than this window reverts.

Two mitigations are in place in `agents/src/keeperhub.ts`:
- The submitter **re-signs with a fresh timestamp at submission time** using `ORACLE_PRIVATE_KEY` (so the signed timestamp is as close as possible to mining).
- Submissions use `maxFeePerGas: 100 gwei` to land within the staleness window.

If staleness reverts persist, raise the constant in `NeuralHook.sol` and redeploy — there's no setter.

## Agent runtime model (workarounds worth knowing)

Three TS processes form a gossip cluster. Each runs `runInference` every 30s, broadcasts its `Vote` to the other two, and tries to form a 2-of-3 consensus locally.

Two non-obvious choices in the current code:

- **Only `NODE_ID === '0'` submits to chain** (`agents/src/agent.ts`). All three agents currently share one wallet via `PRIVATE_KEY`, so concurrent submissions collide on nonce. This is a demo-time workaround; the real fix is per-agent wallets.
- **Consensus signer = lex-smallest agentId**, not fastest (`agents/src/consensus.ts`). The original "fastest signer" rule was racy — different agents could pick different signers during gossip windows. Lex-smallest is deterministic across nodes given the same vote set.

Audit-log retrieval: `GET http://localhost:4000/audit-log` (and `/status`, `/history`). Force a high-volatility cycle: `POST /trigger-volatility`.

## Frontend gotcha — Next.js 16

`frontend/AGENTS.md` flags this:

> This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.

Heed it. Don't assume App Router conventions or React Server Component behavior from older Next versions. The dashboard polls agents at `NEXT_PUBLIC_AGENT_0/1/2`; if agents are down, components fall back to simulated data automatically (don't add error boundaries that break this fallback).

## Environment variables (cross-cutting)

Set in repo-root `.env` (sourced by Forge + agents) and in `frontend/.env.local` for the dashboard. Full reference is in `DEVNET_SETUP.md`. The non-obvious ones:

- `ORACLE_PRIVATE_KEY` — must correspond to `trustedOracle` set at hook deploy time. The deploy script uses `ORACLE_ADDRESS` for the constructor; mismatched keys → every `submitConsensusResult` reverts with `InvalidSignature`.
- `DEPLOYER_ADDRESS` — kept for reference but not used for HookMiner anymore (we mine against Nick's factory; see Invariant 3).
- `NEXT_PUBLIC_HOOK_ADDRESS` / `NEXT_PUBLIC_FUND_ADDRESS` — must be copied to the frontend env after every deploy; otherwise `isDeployed()` returns false and the dashboard shows a blank state.

## Testing notes

- Solidity tests live in `contracts/test/`; the suite includes `NeuralHook.t.sol` and `ILInsuranceFund.t.sol`. Run via `make test` (forces `-v`).
- `via_ir = true` in `foundry.toml` — local builds are slower but match production codegen.
- There is **no agent test suite**. The closest thing is `agents/scripts/test-submit.ts`, a one-shot script that signs and submits a result against a live deployment for manual verification.

## Deploy flow (full sequence)

1. `cd contracts && forge build`
2. Set `.env`: `PRIVATE_KEY`, `ORACLE_ADDRESS`, `ORACLE_PRIVATE_KEY`, `UNICHAIN_SEPOLIA_RPC`
3. `make deploy` — prints `HOOK_ADDRESS=…` and `FUND_ADDRESS=…`
4. Copy printed addresses into `.env` (both `HOOK_ADDRESS` *and* `NEXT_PUBLIC_HOOK_ADDRESS`)
5. Send ≥0.01 ETH to `FUND_ADDRESS` (the deploy script seeds 0.01 by default; top up for live demos)
6. `make agents` then `make frontend`

If steps 2–4 are wrong, the symptom is always the same: agents log inference, consensus forms, tx submits, tx reverts on-chain. Check `submitConsensusResult` revert reason via `cast` or block explorer before debugging the agents.
