# 🧠 NeuralHook

**AI-powered impermanent loss protection for Uniswap v4 LPs — live on Unichain Sepolia.**

NeuralHook is a Uniswap v4 hook that uses a three-node AI agent network to predict impermanent loss risk before it happens. When risk rises, the pool fee surges automatically to compensate LPs. Every fee change is cryptographically signed by the inference layer and verified atomically on-chain — the AI cannot hallucinate a fee.

---

## 🚀 Contracts

| Contract                     | Address                                      | Network          |
| ---------------------------- | -------------------------------------------- | ---------------- |
| **NeuralHook**               | `0x6DCb771F0A8A61F2679989453af9549C9ceA89c0` | Unichain Sepolia |
| **ILInsuranceFund**          | `0x4D575ac6C3df76C7E22EB59715F0a9e839f16811` | Unichain Sepolia |
| **PoolManager (Uniswap v4)** | `0x00B036B58a818B1BC34d502D3fE730Db729e62AC` | Unichain Sepolia |

**Pool:** ETH / USDC · DYNAMIC_FEE_FLAG · tickSpacing 60
**Chain ID:** 1301
**Explorer:** https://sepolia.uniscan.xyz

---

## 🏗️ Architecture

```text id="46hi28"
Pool State (sqrtPriceX96)
        ↓
0G Inference (TEE)
        ↓
Gensyn AXL Consensus (3-of-3 gossip → 2-of-3 threshold)
        ↓
KeeperHub (eth_call simulation → broadcast)
        ↓
NeuralHook.sol (ECDSA.recover → fee override)
```

Four layers — remove any one and the system stops working.

---

## ⚙️ How It Works

## 1️⃣ Smart Contracts

`NeuralHook.sol` registers four Uniswap v4 hook callbacks:

* `beforeSwap`
* `afterSwap`
* `beforeAddLiquidity`
* `afterRemoveLiquidity`

Dynamic fees are enabled via:

`DYNAMIC_FEE_FLAG (0x800000)`

On every swap, `beforeSwap` reads `currentFee` (set by the last oracle submission) and overrides the pool fee atomically.

No governance tx. No delay.

On every `submitConsensusResult` call, the contract:

1. Checks `block.timestamp <= timestamp + MAX_STALENESS (600s)`
2. Calls `ECDSA.recover(ethSignedHash, signature)`
   Reverts if signer ≠ `trustedOracle`
3. Updates:

   * `currentFee`
   * `currentRisk`
   * `lastUpdateTimestamp`
4. Emits `InferenceUpdated`

🛡️ `ILInsuranceFund.sol` holds ETH reserves.

LPs whose IL exceeds **20 bps** can claim.
Each claim is capped at **10% of reserves**.

Pool state is read live via `StateLibrary.extsload` — the same pattern used by the Uniswap v4 periphery.

---

## 2️⃣ AI Inference (0G Sealed Inference)

Each agent runs a **30-second inference loop**:

* Reads live `sqrtPriceX96` from PoolManager via `extsload`
* Computes:

  * rolling 30-period volatility σ
  * tick proximity
  * 5-period momentum
* Calls 0G Sealed Inference (TEE) or local heuristic fallback
* Outputs:

```text id="0pp6ao"
ILRisk
recommendedFee
rebalanceSignal
yieldScore
```

Signs result:

```solidity id="op48w3"
solidityPackedKeccak256([
  resultHash,
  ilRisk,
  predictedILBps,
  recommendedFee,
  rebalanceSignal,
  yieldScore,
  timestamp,
  chainId,
  hookAddress
])
```

The signature is produced inside the TEE before the result leaves the model.

`ECDSA.recover` on-chain rejects anything not signed by `trustedOracle`.

### 💰 Fee Tiers

| Risk     | Fee               |
| -------- | ----------------- |
| LOW      | 0.05% (500 bps)   |
| MEDIUM   | 0.30% (3000 bps)  |
| HIGH     | 0.75% (7500 bps)  |
| CRITICAL | 1.00% (10000 bps) |

---

## 3️⃣ Agent Consensus (Gensyn AXL)

Three TypeScript agents (ports **4000 / 4001 / 4002**) each run inference independently, then gossip their signed vote to the other two via Gensyn AXL HTTP transport.

* **Threshold:** 2-of-3 matching `ilRisk`
* **Tie-break:** higher risk wins
* **Submission:** only agent-0 (`NODE_ID=0`) calls `submitConsensusResult`

Prevents nonce collisions when agents share one oracle key.

---

## 4️⃣ KeeperHub Execution

Before broadcasting every transaction, KeeperHub calls:

```text id="8qnyaq"
eth_call
```

to simulate it.

If simulation reverts:

* stale timestamp
* bad signature
* invalid fee

…the tx is never sent.

Gas price is fetched live from the network:

`2× current maxFeePerGas`

So gas is never hardcoded or accumulated across retries.

On-chain state is confirmed by polling `lastUpdateTimestamp` every 30 seconds.

Unichain Sepolia public RPC does not support `eth_newFilter`.

---

## 📂 Repository Structure

```text id="sghndr"
NeuralHook/
├── contracts/
│   ├── src/
│   │   ├── NeuralHook.sol
│   │   ├── ILInsuranceFund.sol
│   │   ├── BaseHook.sol
│   │   └── HookMiner.sol
│   ├── test/
│   └── script/Deploy.s.sol
│
├── agents/
│   └── src/
│       ├── agent.ts
│       ├── og-inference.ts
│       ├── il-calculator.ts
│       ├── consensus.ts
│       ├── keeperhub.ts
│       ├── on-chain.ts
│       ├── axl-gossip.ts
│       └── og-storage.ts
│
└── frontend/
    ├── app/
    │   ├── page.tsx
    │   ├── dashboard/page.tsx
    │   └── about/page.tsx
    └── components/
```

---

## 🛠️ Running Locally

## Prerequisites

* Node.js 18+
* Foundry

Install Foundry:

```bash id="xftnfh"
curl -L https://foundry.paradigm.xyz | bash
```

---

## 1️⃣ Contracts

```bash id="eiemgj"
cd contracts
forge install
forge test
forge build
```

Redeploy:

```bash id="g1x4jo"
export PRIVATE_KEY=...
export DEPLOYER_ADDRESS=...
export ORACLE_ADDRESS=...
export UNICHAIN_SEPOLIA_RPC=https://unichain-sepolia-rpc.publicnode.com

forge script script/Deploy.s.sol \
  --rpc-url unichain_sepolia \
  --broadcast
```

---

## 2️⃣ Agents

```bash id="mk1s9a"
cd agents
npm install
cp .env.example .env
npm start
```

Runs agents on:

* `:4000`
* `:4001`
* `:4002`

### API Endpoints

* `GET /status`
* `GET /history`
* `GET /audit-log`
* `POST /trigger-volatility`

---

## 3️⃣ Frontend

```bash id="xlb079"
cd frontend
npm install
npm run dev -- --port 3001
```

Open:

```text id="2h356h"
http://localhost:3001/dashboard
```

---

## 🔄 Data Flow

1. `on-chain.ts` reads `sqrtPriceX96`
2. `il-calculator.ts` computes volatility + momentum
3. `og-inference.ts` gets signed result
4. `consensus.ts` reaches 2-of-3 agreement
5. `keeperhub.ts` simulates + broadcasts
6. `NeuralHook.sol` verifies signature
7. Next swap uses new fee automatically

---

## 🔐 Security Model

### Contract Enforces

* Valid trusted oracle signature
* Timestamp freshness < 600s
* Fee bounds
* Emergency pause

### Agent Network Enforces

* 2-of-3 consensus
* `eth_call` simulation
* Single submitter

### System Does NOT Do

* No admin bypass
* No governance delay
* No mainnet deployment

---

## 🧰 Tech Stack

| Layer              | Technology                   |
| ------------------ | ---------------------------- |
| Hook protocol      | Uniswap v4                   |
| Smart contracts    | Solidity 0.8.26 + Foundry    |
| AI inference       | 0G Sealed Inference          |
| Agent consensus    | Gensyn AXL                   |
| On-chain execution | KeeperHub MCP + ethers.js v6 |
| Persistence        | 0G Storage                   |
| L2 deployment      | Unichain                     |
| Frontend           | Next.js 14 + wagmi + viem    |

---

## 🏆 ETHGlobal Open Agents 2026

Built for ETHGlobal Open Agents 2026.

Each sponsor track is load-bearing infrastructure.

| Track      | Integration                     |
| ---------- | ------------------------------- |
| Uniswap v4 | Dynamic fee hook + IL insurance |
| 0G Network | Sealed inference + storage      |
| Gensyn     | 3-node consensus mesh           |
| KeeperHub  | Simulated transaction execution |

---

## 📜 License

MIT
