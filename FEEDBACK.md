# Uniswap Trading API — Developer Feedback

## How NeuralHook uses the Trading API

When the three-node agent mesh reaches consensus on **HIGH** or **CRITICAL** IL risk, agent-0 calls `POST /v1/quote` (Ethereum Mainnet, WETH → USDC) to compute the optimal rebalance swap. The quote — price, route, impact, gas — is attached to the consensus result, returned from `/history`, and rendered live on the dashboard so LPs know exactly what swap to execute to cut their IL exposure.

File: `agents/src/uniswap-api.ts`

---

## What worked well

- **`/v1/quote` response shape is clean** — `quote.output.amount`, `quote.routeString`, `quote.priceImpact`, and `quote.gasUseEstimateUSD` were all present and easy to parse.
- **Routing quality is excellent** — the API consistently finds the best v3/v4 path; agents got tighter quotes than public RPC-based simulation.
- **No SDK dependency required** — a plain `fetch` POST is enough to get a quote, which is ideal for agent environments where npm bundle size matters.

---

## What didn't work / friction points

### 1. API key requirement is not clearly documented
The `/v1/quote` endpoint returns a `403` without an `x-api-key` header, but the "Getting Started" docs don't prominently surface that a key is required for production use. The key signup flow at `hub.uniswap.org` is separate from the docs site — new builders will hit a 403 and assume the endpoint is broken before finding the key portal.

**Suggestion:** Add a visible callout in the `/v1/quote` reference page that a key is needed and link directly to the key portal.

### 2. Unichain Sepolia (chain 1301) is not supported
Our pool lives on Unichain Sepolia. The Trading API covers mainnet and L2s (Base, Optimism, Arbitrum, Polygon) but not Unichain Sepolia, so quotes run against mainnet pools as a price reference rather than against our actual pool. This is fine for a price oracle use case but means agents can't quote against the same liquidity they're protecting.

**Suggestion:** Add Unichain Sepolia (1301) — even read-only quote support would let hooks projects test end-to-end on the official Unichain testnet.

### 3. Permit2 flow adds complexity for agentic use
Moving from "get a quote" to "execute the swap" requires a Permit2 signature step (`/v1/swap` → sign permit → broadcast). For human wallets this is fine, but for autonomous agent signers it means the agent must handle EIP-712 typed-data signing mid-inference loop. The permit2 flow works but required reading through the Permit2 contracts directly — a dedicated "agentic swap" guide showing the sign → broadcast loop for backend signers would save hours.

### 4. `slippageTolerance` vs `autoSlippage` mutual exclusion is silent
Sending both `slippageTolerance` and `autoSlippage` in the body silently drops one rather than returning a 400. We spent time debugging inconsistent slippage before realising the conflict.

**Suggestion:** Return an explicit validation error when both are present.

---

## Missing endpoints / desired features

- **`GET /v1/price`** — a lightweight price endpoint (no routing computation) for agents that only need a reference price, not a full routable quote. The current approach of requesting a full 1 ETH quote just to get ETH/USDC price is wasteful.
- **Webhook / streaming quotes** — agents poll every 30 seconds; a push-based quote stream (WebSocket or SSE) would let agents react to price moves instantly without polling overhead.
- **Chain support: Unichain Sepolia (1301)** — already mentioned above but worth repeating as a prioritised request given ETHGlobal encourages Unichain deployment.
