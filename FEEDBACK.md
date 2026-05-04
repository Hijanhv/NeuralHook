# Uniswap Trading API — Developer Feedback

## How NeuralHook uses the Trading API

When the three-node agent mesh reaches consensus on **HIGH** or **CRITICAL** IL risk, agent-0 runs a two-step flow:

**Step 1 — Reference quote** (`POST /v1/quote`, Ethereum mainnet, WETH → USDC, 1 ETH)
Gets the current market price, optimal route, price impact, and gas estimate. Attached to the consensus result and rendered live on the dashboard so LPs see both the new fee and the current "fair value" for ETH in a single update.

**Step 2 — Swap execution** (`POST /v1/quote` + `POST /v1/swap`, Base mainnet, WETH → USDC)
Fetches a second execution quote for a small amount (`SWAP_AMOUNT_WEI`, default 0.0001 ETH), calls `/v1/swap` to get Universal Router calldata, signs and broadcasts the transaction with ethers.js. The resulting TX hash is stored in the consensus result and shown as a live Basescan link in the dashboard Consensus Feed.

This closes the full autonomous loop: detect IL risk → raise pool fee → execute on-chain rebalance swap — without human intervention.

Files: `agents/src/uniswap-api.ts` · `agents/src/agent.ts`

---

## What worked well

- **`/v1/quote` response shape is clean** — `quote.output.amount`, `quote.routeString`, `quote.priceImpact`, and `quote.gasUseEstimateUSD` were all present and easy to parse with a plain `fetch` POST. No SDK dependency needed.
- **Routing quality is excellent** — the API consistently finds the best v3/v4 path; tighter quotes than public RPC-based simulation.
- **`/v1/swap` returns ready-to-broadcast calldata** — the `swap.to` (Universal Router) and `swap.data` fields drop straight into `ethers wallet.sendTransaction`. For ETH-in swaps with no Permit2 requirement, the flow from quote to broadcast is under 20 lines of code.
- **No SDK dependency required** — ideal for agent environments where npm bundle size and cold-start time matter.

---

## What didn't work / friction points

### 1. API key requirement is not clearly documented
`/v1/quote` returns a silent `403` without `x-api-key`. The "Getting Started" docs don't call this out prominently, and the key portal at `hub.uniswap.org` is separate from the docs site. New builders will assume the endpoint is broken before finding the key signup flow.

**Suggestion:** Add a visible callout at the top of the `/v1/quote` and `/v1/swap` reference pages linking directly to the key portal.

### 2. Unichain Sepolia (chain 1301) is not supported
Our hook lives on Unichain Sepolia. The Trading API covers Ethereum mainnet, Base, Optimism, Arbitrum, and Polygon — but not Unichain Sepolia. We worked around this by running the execution swap on Base mainnet, but it means the rebalance happens on a different chain than the pool being protected. Cross-chain agentic behaviour is interesting but ideally the API would let us quote and execute against the same pool.

**Suggestion:** Add Unichain Sepolia (1301) and Unichain mainnet (130) — both are native Uniswap deployments and the natural home for hooks projects.

### 3. Permit2 flow underdocumented for backend signers
For ERC-20 input tokens, `/v1/swap` requires a Permit2 EIP-712 signature. The docs explain the user-wallet flow but there is no guide for autonomous backend signers (no browser, no wallet extension). We handled ETH-in swaps to avoid Permit2 entirely during the hackathon, but a dedicated "agentic signer" guide would unblock a large class of agent-finance projects.

**Suggestion:** Add a code example showing the sign → `/v1/swap` → broadcast loop for a Node.js backend signer using ethers.js.

### 4. `/v1/swap` response field naming is inconsistent
The calldata field appears as `swap.data` in some responses and `swap.calldata` in others depending on routing path. We handle both defensively but a consistent field name would simplify integration.

**Suggestion:** Standardise on `swap.calldata` across all routing types and document it explicitly.

### 5. `slippageTolerance` vs `autoSlippage` mutual exclusion is silent
Sending both fields together silently drops one instead of returning a 400. Debugging inconsistent slippage took time.

**Suggestion:** Return an explicit validation error when both are present.

---

## Missing endpoints / desired features

- **`GET /v1/price`** — a lightweight price endpoint for agents that only need ETH/USDC reference price. Requesting a full routable 1 ETH quote just to get a price is wasteful on rate limits and latency.
- **Webhook / streaming quotes** — agents poll every 30 seconds. A push-based quote stream (WebSocket or SSE) would let agents react to price moves instantly rather than waiting for the next polling cycle.
- **Chain support: Unichain Sepolia (1301) and Unichain mainnet (130)** — repeated from above as the highest priority request for hooks projects.
- **`GET /v1/swap/status`** — a way to check whether a previously broadcast swap TX was included and at what price, so agents can confirm settlement without polling a third-party block explorer.
