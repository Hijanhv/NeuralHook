# Local Devnet Setup

Complete guide to running NeuralHook end-to-end on your machine without a live deployment.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Foundry | latest | `curl -L https://foundry.paradigm.xyz \| bash` |
| Node.js | 22+ | `nvm install 22` |
| npm | 10+ | bundled with Node |

---

## Step 1 — Environment

```bash
cp .env.example .env
```

For local testing, the defaults in `.env.example` work as-is:
- `ORACLE_PRIVATE_KEY` defaults to Foundry's first test key (`0xac0974...`)
- `HOOK_ADDRESS` defaults to `0x000...001` (mock — signatures won't verify on-chain)
- `RPC_URL` defaults to `https://sepolia.unichain.org`

---

## Step 2 — Contracts (local Anvil)

```bash
# Terminal 1 — start a local fork
anvil --fork-url https://sepolia.unichain.org --port 8545

# Terminal 2 — run tests
cd contracts
forge test -v

# Optional: deploy to the local fork
forge script script/Deploy.s.sol \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

After deployment, copy the printed `NeuralHook` address into `.env` as `HOOK_ADDRESS`.

---

## Step 3 — Agents

```bash
cd agents
npm install

# Start all three nodes
npm start

# Or individually:
NODE_ID=0 PORT=4000 tsx src/agent.ts
NODE_ID=1 PORT=4001 tsx src/agent.ts
NODE_ID=2 PORT=4002 tsx src/agent.ts
```

Verify agents are running:

```bash
curl http://localhost:4000/status
curl http://localhost:4001/history
curl http://localhost:4002/audit-log
```

Trigger a test volatility spike:

```bash
curl -X POST http://localhost:4000/trigger-volatility
```

---

## Step 4 — Frontend

```bash
cd frontend
npm install
npm run dev -- --port 3001
```

Open [http://localhost:3001](http://localhost:3001).

- **Home** — p5.js neural net, live IL risk badge cycling
- **Dashboard** — live agent data when agents are running; simulated data otherwise. Status dot in the header shows agent connectivity.
- **Connect** — MetaMask / WalletConnect on Unichain Sepolia (chain 1301)
- **About** — full technical writeup of all four layers

---

## Step 5 — Docker (optional)

```bash
# Builds and starts agents + frontend together
make up

# Stop
make down
```

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `PRIVATE_KEY` | Deploy only | Deployer wallet private key |
| `ORACLE_PRIVATE_KEY` | Agents | Signs inference results (must match `trustedOracle` in contract) |
| `ORACLE_ADDRESS` | Deploy only | Matching public address for `ORACLE_PRIVATE_KEY` |
| `DEPLOYER_ADDRESS` | Deploy only | Deployer public address (for HookMiner CREATE2) |
| `HOOK_ADDRESS` | Agents | Deployed NeuralHook contract address |
| `RPC_URL` | Agents | Unichain Sepolia JSON-RPC endpoint |
| `CHAIN_ID` | Agents | `1301` for Unichain Sepolia |
| `OG_ENDPOINT` | Optional | 0G Inference API URL (falls back to mock if unset) |
| `NEXT_PUBLIC_AGENT_0/1/2` | Frontend | Agent HTTP URLs for dashboard polling |
| `NEXT_PUBLIC_WC_PROJECT_ID` | Frontend | WalletConnect project ID |

---

## Troubleshooting

**`forge test` fails with "file not found"**
Run `forge test` from inside the `contracts/` directory, not from the project root.

**Agents show "Connecting..." in dashboard**
Normal — agents aren't running. Dashboard falls back to simulated data automatically.

**MetaMask shows wrong network**
Click "Switch to Unichain Sepolia" on the Connect page, or add the network manually:
- RPC: `https://sepolia.unichain.org`
- Chain ID: `1301`
- Symbol: `ETH`
- Explorer: `https://sepolia.uniscan.xyz`

**Hook address flags mismatch on deploy**
HookMiner iterates nonces until the CREATE2 address encodes the correct permission flags. This is deterministic — run the deploy script again from the same deployer address with the same constructor args.
