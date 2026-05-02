'use client'
import dynamic from 'next/dynamic'
import NeuralHookLogo from '@/components/NeuralHookLogo'

const P5NeuralNet = dynamic(() => import('@/components/P5NeuralNet'), { ssr: false })

const LAYERS = [
  {
    id: '01', title: 'Smart Contracts', subtitle: 'Uniswap v4 · Solidity 0.8.26 · Foundry',
    body: [
      'NeuralHook.sol registers four hook callbacks inside the Uniswap v4 PoolManager: beforeSwap, afterSwap, beforeAddLiquidity, and afterRemoveLiquidity.',
      'Dynamic fees are enabled via DYNAMIC_FEE_FLAG (0x800000). The beforeSwap callback returns the oracle-recommended fee OR\'d with OVERRIDE_FEE_FLAG (0x400000), atomically overriding the pool fee in a single transaction — no separate governance tx needed.',
      'Every fee change requires a valid ECDSA signature from the trusted oracle address. ECDSA.tryRecover catches signature malleability and zero-byte bypass attacks. A faked or replayed signature reverts the transaction.',
      'IL is computed on-chain using sqrtPriceX96: IL = 1 − 2q/(1+q²) where q is the sqrt-price ratio. ILInsuranceFund.sol caps each claim at 10% of reserves to prevent drain attacks.',
    ],
    specs: [
      ['Language', 'Solidity 0.8.26 · via_ir optimizer'],
      ['Network', 'Unichain Sepolia · Chain ID 1301'],
      ['Pool Manager', '0x00B036B58a818B1BC34d502D3fE730Db729e62AC'],
      ['Fee Tiers', 'LOW 0.05% / MED 0.30% / HIGH 0.75% / CRIT 1.00%'],
      ['Tests', '20 passing (Foundry forge test)'],
    ],
  },
  {
    id: '02', title: 'AI Inference Layer', subtitle: '0G Sealed Inference · TEE · ECDSA',
    body: [
      '0G Sealed Inference runs the IL risk model inside a Trusted Execution Environment (TEE). Inputs: rolling 30-period volatility (σ), tick proximity (distance from current tick to position boundaries), and 5-period price momentum.',
      'Output: a 4-class risk label (LOW / MEDIUM / HIGH / CRITICAL), recommended fee in basis points, rebalance signal, and yield score — all signed by the TEE\'s private key using ECDSA before leaving the enclave.',
      'The signed message structure matches NeuralHook.sol exactly: solidityPackedKeccak256([resultHash, ilRisk, predictedILBps, recommendedFee, rebalanceSignal, yieldScore, timestamp, chainId, hookAddress]). No translation layer between TEE output and on-chain verification.',
      'The AI cannot hallucinate a fee change. ECDSA.recover on-chain rejects any output not signed by the trustedOracle address inside the TEE. In development, an ethers.js wallet mocks the same message structure — mock signatures fail if the oracle address is swapped.',
    ],
    specs: [
      ['Provider', '0G Network Sealed Inference'],
      ['Input features', 'σ (volatility) · tick proximity · momentum'],
      ['Output', 'ILRisk class · feeBps · rebalanceSignal · yieldScore'],
      ['Signing', 'ECDSA secp256k1 · keccak256 packed'],
      ['Fallback', 'ethers.Wallet mock (identical message structure)'],
    ],
  },
  {
    id: '03', title: 'Agent Consensus', subtitle: 'Gensyn AXL · 3-Node Gossip · 2-of-3',
    body: [
      'Three independent TypeScript agents each run a 30-second inference loop: fetch pool state, call 0G inference, produce a signed result, then gossip their vote to the other two nodes via Gensyn AXL HTTP transport.',
      'Votes include the signed InferenceResult and the agent\'s measured round-trip latency. When any node collects two matching votes (same ilRisk class), consensus is declared. If all three disagree, the highest risk class wins — NeuralHook is asymmetrically conservative.',
      'The lowest-latency agreeing agent submits the canonical signature on-chain. This keeps gas cost to one tx per consensus round while maintaining Byzantine fault tolerance — one node can fail or lie without breaking the system.',
    ],
    specs: [
      ['Transport', 'Gensyn AXL HTTP gossip'],
      ['Nodes', '3 independent TypeScript agents'],
      ['Threshold', '2-of-3 matching ilRisk class'],
      ['Tie-break', 'Higher risk class wins (conservative)'],
      ['Submission', 'Lowest-latency agreeing agent'],
    ],
  },
  {
    id: '04', title: 'KeeperHub Execution', subtitle: 'MCP Tool · Gas Simulation · Audit',
    body: [
      'KeeperHub is a Model Context Protocol (MCP) tool wrapping the final on-chain submission step. It first simulates the transaction via eth_estimateGas — confirming the consensus signature and parameters are valid before spending any gas.',
      'On failure, KeeperHub retries with exponential backoff: 1s, 2s, 4s. After three failures it logs the entry to the audit trail with success=false. REPLACEMENT_UNDERPRICED errors trigger an immediate gas-price bump without incrementing the attempt counter.',
      'Every execution — success or failure — writes an AuditEntry: txHash, action, ilRisk, fee, gasUsed, timestamp, success. Surfaced live on the Dashboard Audit Trail and queryable via the /audit-log endpoint.',
    ],
    specs: [
      ['Interface', 'MCP Tool (Model Context Protocol)'],
      ['Pre-flight', 'eth_estimateGas simulation'],
      ['Retries', '3 attempts · 1s / 2s / 4s backoff'],
      ['Audit log', 'Every execution recorded (success + failure)'],
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

        {/* Trust block — dark (anza dark card style) */}
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

        {/* Dependency chain */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '1.5rem 2rem' }}>
          <p className="font-mono text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--text-muted)' }}>Data flow</p>
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {['Smart Contracts', '→', '0G Inference', '→', 'Gensyn Consensus', '→', 'KeeperHub', '→', 'On-Chain'].map((item, i) => (
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
                    gridTemplateColumns: '10rem 1fr',
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
