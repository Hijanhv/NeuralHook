# NeuralHook

> "The first Uniswap v4 hook that makes LPs whole. AI predicts impermanent loss before it happens, surges fees to pre-compensate, auto-triggers rebalancing, and builds an on-chain IL insurance fund. All proven by cryptography. No trust required."

AI-powered impermanent loss protection for Uniswap v4 liquidity providers.

Built for **ETHGlobal Open Agents 2026** using Uniswap v4, 0G Sealed Inference, Gensyn AXL, and KeeperHub MCP.

---

## Architecture

```
Pool events → 0G TEE inference → Gensyn 3-node consensus → KeeperHub MCP → NeuralHook.sol
```

| Layer | Technology | Role |
|---|---|---|
| Smart Contracts | Uniswap v4 · Solidity 0.8.26 | Dynamic fee hook + ETH insurance fund |
| AI Inference | 0G Sealed Inference · TEE | ECDSA-signed IL risk classification |
| Consensus | Gensyn AXL · 3 nodes | 2-of-3 Byzantine-fault-tolerant agreement |
| Execution | KeeperHub MCP · ethers.js | Gas simulation, retry, on-chain submission |

---

## Quickstart

### Requirements

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 22+
- An Unichain Sepolia RPC endpoint and funded wallet

### 1. Install

```bash
make install
```

### 2. Run contracts tests

```bash
make test
# 19/19 passing
```

### 3. Deploy to Unichain Sepolia

```bash
cp .env.example .env
# fill in PRIVATE_KEY, ORACLE_ADDRESS, DEPLOYER_ADDRESS
make deploy
```

### 4. Start agents

```bash
# copy deployed HOOK_ADDRESS into .env, then:
make agents
# starts 3 nodes on :4000 :4001 :4002
```

### 5. Start frontend

```bash
make frontend
# http://localhost:3001
```

### Docker (all-in-one)

```bash
cp .env.example .env  # fill in vars
make up
```

---

## Contract addresses (Unichain Sepolia)

| Contract | Address |
|---|---|
| PoolManager | `0x00B036B58a818B1BC34d502D3fE730Db729e62AC` |
| NeuralHook | TBD after deploy |
| ILInsuranceFund | TBD after deploy |

---

## How it works

**NeuralHook.sol** registers four Uniswap v4 callbacks. On every swap, `beforeSwap` returns the oracle-recommended fee OR'd with `OVERRIDE_FEE_FLAG`, atomically setting the pool fee. Every fee change requires a valid ECDSA signature from the trusted oracle — no signature, no fee change.

**0G Sealed Inference** runs the IL risk model inside a TEE. The enclave signs its output with the same message structure that `NeuralHook.sol` verifies on-chain, making the attestation and the contract check a single cryptographic primitive.

**Gensyn AXL** connects three independent TypeScript agents via HTTP gossip. Votes are collected and a 2-of-3 threshold declares consensus. If all three disagree, the highest risk class wins (conservative by design). The fastest agreeing agent submits on-chain.

**KeeperHub** pre-flight simulates gas, submits the consensus signature, retries with 1s/2s/4s backoff, and writes every execution to an immutable audit log.

---

## Sponsors

- **Uniswap** — v4 hooks + dynamic fees
- **0G Network** — Sealed Inference (TEE AI)
- **Gensyn** — AXL agent communication
- **KeeperHub** — MCP execution layer
- **Unichain** — L2 deployment target
>>>>>>> ef93129 (Complete NeuralHook — contracts, agents, frontend, docs)
