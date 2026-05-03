'use client'
import dynamic from 'next/dynamic'
import NeuralHookLogo from '@/components/NeuralHookLogo'

const P5NeuralNet = dynamic(() => import('@/components/P5NeuralNet'), { ssr: false })

const LAYERS = [
  {
    id: '01', title: 'Smart Contracts', subtitle: 'Uniswap v4 · Solidity 0.8.26 · Foundry',
    body: [
      'NeuralHook.sol registers four hook callbacks inside the Uniswap v4 PoolManager: beforeSwap, afterSwap, beforeAddLiquidity, and afterRemoveLiquidity. Dynamic fees are enabled via DYNAMIC_FEE_FLAG (0x800000). The beforeSwap callback overrides the pool fee atomically — no separate governance transaction required.',
      'Every fee change requires a valid ECDSA signature from the trusted oracle address. ECDSA.tryRecover catches signature malleability and zero-byte bypass attacks. A faked, replayed, or stale inference result reverts the transaction. Staleness is enforced: results older than 10 minutes are rejected on-chain (MAX_STALENESS = 600).',
      'IL is computed on-chain using sqrtPriceX96: IL = 1 − 2q/(1+q²) where q is the sqrt-price ratio. ILInsuranceFund.sol caps each payout at 10% of reserves per claim to prevent drain attacks. The fund was seeded with 0.01 ETH at deployment.',
      'The hook is deployed at 0x6DCb771F0A8A61F2679989453af9549C9ceA89c0 on Unichain Sepolia (chain ID 1301). Pool state (sqrtPriceX96, currentTick) is read live from the PoolManager using StateLibrary.extsload — the same extsload pattern used by the Uniswap v4 periphery.',
    ],
    specs: [
      ['Language', 'Solidity 0.8.26 · via_ir optimizer'],
      ['Network', 'Unichain Sepolia · Chain ID 1301'],
      ['NeuralHook', '0x6DCb771F0A8A61F2679989453af9549C9ceA89c0'],
      ['ILInsuranceFund', '0x4D575ac6C3df76C7E22EB59715F0a9e839f16811'],
      ['Fee Tiers', 'LOW 0.05% / MED 0.30% / HIGH 0.75% / CRIT 1.00%'],
      ['Tests', '20 passing (Foundry forge test)'],
    ],
  },
  {
    id: '02', title: 'AI Inference Layer', subtitle: '0G Sealed Inference · TEE · ECDSA',
    body: [
      '0G Sealed Inference runs the IL risk model inside a Trusted Execution Environment (TEE). Inputs are: rolling 30-period volatility (σ), tick proximity (distance from current price to position range boundaries), and 5-period signed price momentum. These three features combine into a composite risk score.',
      'Output: a 4-class risk label (LOW / MEDIUM / HIGH / CRITICAL), recommended fee in basis points, rebalance signal (bool), and yield score (0–255) — all signed by the TEE private key using ECDSA before leaving the enclave. The signed message structure matches NeuralHook.sol exactly: solidityPackedKeccak256([resultHash, ilRisk, predictedILBps, recommendedFee, rebalanceSignal, yieldScore, timestamp, chainId, hookAddress]).',
      'Live sqrtPriceX96 is read from the PoolManager via StateLibrary.extsload on every inference cycle. This gives agents the real current ETH price (≈ $2000 at pool init) rather than a simulated value. If the pool slot is empty or out of sanity bounds, agents fall back to simulated metrics without stalling.',
      'When OG_PROVIDER_ADDRESS is unset, a local heuristic model produces identical output structure and signs it with the same oracle key. The signature scheme is identical — local mode cannot be distinguished from TEE mode by the smart contract.',
    ],
    specs: [
      ['Provider', '0G Network Sealed Inference (local heuristic fallback)'],
      ['Input features', 'σ (volatility) · tick proximity · momentum · live sqrtPriceX96'],
      ['Output', 'ILRisk class · feeBps · rebalanceSignal · yieldScore'],
      ['Signing', 'ECDSA secp256k1 · solidityPackedKeccak256'],
      ['Staleness check', 'MAX_STALENESS = 600s enforced on-chain'],
    ],
  },
  {
    id: '03', title: 'Agent Consensus', subtitle: 'Gensyn AXL · 3-Node Gossip · 2-of-3',
    body: [
      'Three independent TypeScript agents each run a 30-second inference loop: read live pool state, call the inference layer, produce a signed InferenceResult, then gossip their vote to the other two agents via HTTP (Gensyn AXL when configured, HTTP fallback otherwise). Each vote carries the full signed result and the agent\'s measured round-trip latency.',
      'When any node collects two matching votes (same ilRisk class), consensus is declared. Tie-break rule: higher risk class wins, so NeuralHook is asymmetrically conservative. The lowest-latency agreeing agent\'s signature becomes the canonical result submitted on-chain.',
      'Only agent-0 (NODE_ID=0) calls submitConsensusResult on-chain. Agents 1 and 2 gossip and vote but never touch the chain. This prevents nonce collisions when all agents share the same oracle key — which was the root cause of all failed on-chain submissions before this architecture was finalized.',
    ],
    specs: [
      ['Transport', 'Gensyn AXL HTTP gossip (HTTP fallback)'],
      ['Nodes', '3 independent TypeScript agents (ports 4000–4002)'],
      ['Threshold', '2-of-3 matching ilRisk class'],
      ['Tie-break', 'Higher risk class wins (conservative bias)'],
      ['Submission', 'Agent-0 only — prevents nonce collisions'],
    ],
  },
  {
    id: '04', title: 'KeeperHub Execution', subtitle: 'MCP Tool · eth_call Simulation · Polling',
    body: [
      'KeeperHub wraps the final on-chain submission step. Before broadcasting, it simulates the transaction via eth_call — confirming the consensus signature and all parameters are valid without spending gas. A revert in simulation means the signature is wrong, the timestamp is stale, or the fee is invalid; the entry is logged with success=false.',
      'Gas price is fetched fresh from the network on every submission (2× the current maxFeePerGas). This prevents the gas from being hardcoded or pumped by a retry loop — the original source of a stuck high-gas transaction that blocked the wallet for several hours during testing.',
      'On-chain state is confirmed via a 30-second polling loop that reads lastUpdateTimestamp, currentFee, and currentRisk directly from the contract. Unichain Sepolia\'s public RPC does not support eth_newFilter (event subscriptions), so polling is the only viable approach.',
      'Every execution — success or failure — writes an AuditEntry: txHash, action, ilRisk, fee, gasUsed, timestamp, success. Entries are surfaced live on the Dashboard Audit Trail and queryable via GET /audit-log. The last 200 entries are retained in memory.',
    ],
    specs: [
      ['Interface', 'MCP Tool (Model Context Protocol)'],
      ['Pre-flight', 'eth_call simulation before every broadcast'],
      ['Gas', 'Live network estimate × 2 (no hardcoded values)'],
      ['State poll', '30s interval · reads lastUpdateTimestamp + currentFee'],
      ['RPC', 'publicnode.com (load-balanced sepolia.unichain.org had stuck txs)'],
      ['Audit log', 'Every execution recorded · last 200 entries retained'],
    ],
  },
]

export default function AboutPage() {
  return (
    <main className="relative min-h-screen pt-[92px]" style={{ background: 'var(--bg)' }}>
      <P5NeuralNet intensity="calm" className="fixed inset-0 w-full h-full opacity-[0.05]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 space-y-20">

        {/* Header */}
        <div className="flex flex-col items-center text-center gap-5">
          <NeuralHookLogo size={52} />
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 5vw, 3.25rem)', color: 'var(--text)', lineHeight: 1.05 }}>
              How NeuralHook works
            </h1>
            <p className="font-mono text-[13px] tracking-widest uppercase mt-4" style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '1rem auto 0' }}>
              Four layers that each depend on the next — remove any one and the project breaks.
            </p>
          </div>
        </div>

        {/* Live status banner */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '1.25rem 2rem' }}
             className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#22C55E' }} />
            <span className="font-mono text-sm" style={{ color: 'var(--text)' }}>Hook is live on Unichain Sepolia</span>
          </div>
          <div className="flex gap-6 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>NeuralHook · <span style={{ color: 'var(--text)' }}>0x6DCb…89c0</span></span>
            <span>Confirmed · <span style={{ color: 'var(--text)' }}>block 50918795</span></span>
            <span>Gas · <span style={{ color: 'var(--text)' }}>41,116 per update</span></span>
          </div>
        </div>

        {/* Trust block */}
        <div style={{ background: 'var(--bg-dark)', borderRadius: '6px', padding: '2rem 2.5rem' }}>
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-white/65 mb-3">Trust guarantee</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: '#F9F8F5', marginBottom: '1rem' }}>
            The AI cannot hallucinate a fee.
          </h2>
          <p style={{ fontSize: '0.9375rem', color: 'rgba(249,248,245,0.82)', lineHeight: 1.7 }}>
            NeuralHook.sol calls{' '}
            <code className="font-mono text-[12px] bg-white/10 px-1.5 py-0.5 rounded">ECDSA.recover(resultHash, sig) == trustedOracle</code>
            {' '}on every submission. Any tampered, replayed, or fabricated output simply reverts.
            No admin override. No governance delay. The TEE signature is the permission.
          </p>
          <div className="grid grid-cols-3 gap-px mt-8" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              ['TEE Signed', 'Output signed inside the 0G enclave before it leaves the model'],
              ['2-of-3 Verified', 'Three Gensyn agents must reach consensus before any chain call'],
              ['On-Chain Proof', 'ECDSA.recover validates every result atomically inside beforeSwap'],
            ].map(([label, desc], i) => (
              <div key={label} className="px-5 py-5" style={{ borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <div className="font-mono text-xs tracking-widest uppercase text-white/65 mb-2">{label}</div>
                <p style={{ fontSize: '0.8125rem', color: 'rgba(249,248,245,0.78)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Data flow */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '1.5rem 2rem' }}>
          <p className="font-mono text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--text-muted)' }}>Data flow</p>
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {['Pool State', '→', '0G Inference', '→', 'Gensyn Consensus', '→', 'KeeperHub', '→', 'NeuralHook.sol'].map((item, i) => (
              <span key={i} className="font-mono text-xs whitespace-nowrap"
                style={{ color: item === '→' ? 'var(--text-muted)' : 'var(--text)', fontWeight: item === '→' ? 400 : 500, flexShrink: 0 }}>
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Layer sections */}
        {LAYERS.map(layer => (
          <section key={layer.id}>
            <div className="flex items-start gap-6 mb-6">
              <span className="font-mono text-4xl font-bold leading-none" style={{ color: 'var(--text-muted)' }}>{layer.id}</span>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.625rem', color: 'var(--text)' }}>{layer.title}</h2>
                <p className="font-mono text-xs uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>{layer.subtitle}</p>
              </div>
            </div>

            <div className="pl-[4.5rem] space-y-4 mb-6">
              {layer.body.map((para, i) => (
                <p key={i} style={{ fontSize: '0.9375rem', color: 'var(--text-mid)', lineHeight: 1.75 }}>{para}</p>
              ))}
            </div>

            <div className="pl-[4.5rem]">
              <div style={{ border: '1px solid var(--border)', borderRadius: '4px' }}>
                {layer.specs.map(([k, v], i) => (
                  <div key={k} className="grid px-4 py-2" style={{
                    gridTemplateColumns: '12rem 1fr',
                    borderBottom: i < layer.specs.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--text)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* Run locally */}
        <section>
          <div className="flex items-start gap-6 mb-6">
            <span className="font-mono text-4xl font-bold leading-none" style={{ color: 'var(--text-muted)' }}>05</span>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.625rem', color: 'var(--text)' }}>Run it locally</h2>
              <p className="font-mono text-xs uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>Node.js 18+ · Foundry · 3 terminals</p>
            </div>
          </div>

          <div className="pl-[4.5rem] space-y-6">
            {/* Prerequisites */}
            <div>
              <p className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Prerequisites</p>
              <div style={{ border: '1px solid var(--border)', borderRadius: '4px' }}>
                {[
                  ['Node.js', '18 or later — node --version'],
                  ['Foundry', 'curl -L https://foundry.paradigm.xyz | bash'],
                  ['Git', 'git clone https://github.com/Hijanhv/NeuralHook'],
                ].map(([k, v], i, arr) => (
                  <div key={k} className="grid px-4 py-2" style={{ gridTemplateColumns: '9rem 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <code className="font-mono text-xs" style={{ color: 'var(--text)' }}>{v}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Steps */}
            {[
              {
                step: '1', label: 'Clone and install',
                lines: [
                  'git clone https://github.com/Hijanhv/NeuralHook',
                  'cd NeuralHook',
                  'cd agents && npm install && cd ..',
                  'cd frontend && npm install && cd ..',
                ],
              },
              {
                step: '2', label: 'Configure agents',
                lines: [
                  'cd agents',
                  'cp .env.example .env   # or create .env manually',
                  '',
                  '# Minimum required in agents/.env:',
                  'HOOK_ADDRESS=0x6DCb771F0A8A61F2679989453af9549C9ceA89c0',
                  'RPC_URL=https://unichain-sepolia-rpc.publicnode.com',
                  'CHAIN_ID=1301',
                  'PRIVATE_KEY=<your-wallet-private-key>',
                  'ORACLE_PRIVATE_KEY=<same-key>',
                ],
              },
              {
                step: '3', label: 'Start the agents (terminal 1)',
                lines: [
                  'cd agents',
                  'npm start',
                  '',
                  '# Starts 3 agents on :4000 :4001 :4002',
                  '# Wait for: [agent-0] simulation passed — broadcasting',
                ],
              },
              {
                step: '4', label: 'Start the frontend (terminal 2)',
                lines: [
                  'cd frontend',
                  '',
                  '# Create frontend/.env.local:',
                  'NEXT_PUBLIC_HOOK_ADDRESS=0x6DCb771F0A8A61F2679989453af9549C9ceA89c0',
                  'NEXT_PUBLIC_FUND_ADDRESS=0x4D575ac6C3df76C7E22EB59715F0a9e839f16811',
                  'NEXT_PUBLIC_AGENT_0=http://localhost:4000',
                  'NEXT_PUBLIC_AGENT_1=http://localhost:4001',
                  'NEXT_PUBLIC_AGENT_2=http://localhost:4002',
                  '',
                  'npm run dev -- --port 3001',
                ],
              },
              {
                step: '5', label: 'Open the dashboard',
                lines: [
                  'http://localhost:3001/dashboard',
                  '',
                  '# You should see:',
                  '# • Data source: live agents',
                  '# • Agent mesh: 3 nodes healthy',
                  '# • Consensus feed updating every 30s',
                  '# • On-chain state: fee + risk from NeuralHook.sol',
                ],
              },
            ].map(({ step, label, lines }) => (
              <div key={step}>
                <p className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                  Step {step} — {label}
                </p>
                <div style={{ background: 'var(--bg-dark)', borderRadius: '4px', padding: '1rem 1.25rem' }}>
                  {lines.map((line, i) => (
                    <div key={i} className="font-mono text-xs leading-6" style={{ color: line.startsWith('#') ? 'rgba(249,248,245,0.4)' : line === '' ? undefined : '#22C55E' }}>
                      {line === '' ? <br /> : line}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '1rem 1.25rem' }}>
              <p className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Note — wallet funding</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-mid)', lineHeight: 1.6 }}>
                The oracle wallet needs a small amount of Unichain Sepolia ETH to pay gas for on-chain submissions (~41k gas per round).
                Get testnet ETH from the{' '}
                <a href="https://faucet.unichain.org" target="_blank" rel="noopener noreferrer"
                   className="underline" style={{ color: 'var(--text)' }}>Unichain faucet</a>
                {' '}or bridge from Sepolia. 0.05 ETH covers hundreds of submissions.
              </p>
            </div>
          </div>
        </section>

        {/* ETHGlobal footer */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '1.5rem 2rem' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.125rem', color: 'var(--text)', marginBottom: '0.75rem' }}>
            ETHGlobal Open Agents 2026
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-mid)', lineHeight: 1.7 }}>
            Built for ETHGlobal Open Agents 2026. Demonstrates that AI agents can be integrated into DeFi
            infrastructure without compromising on-chain security — every agent action requires a cryptographic
            proof that the smart contract verifies atomically.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
            {[
              ['Uniswap v4', 'Dynamic fee hook + IL insurance'],
              ['0G Network', 'Sealed inference + TEE signing'],
              ['Gensyn', 'AXL 3-node consensus'],
              ['KeeperHub', 'MCP execution + full audit'],
            ].map(([track, use]) => (
              <div key={track}>
                <div className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text)' }}>{track}</div>
                <div className="font-mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{use}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}
