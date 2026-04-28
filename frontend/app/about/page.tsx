'use client'
import dynamic from 'next/dynamic'
import NeuralHookLogo from '@/components/NeuralHookLogo'

const P5NeuralNet = dynamic(() => import('@/components/P5NeuralNet'), { ssr: false })

const LAYERS = [
  {
    id: '01',
    title: 'Smart Contracts',
    subtitle: 'Uniswap v4 · Solidity 0.8.26 · Foundry',
    body: [
      'NeuralHook.sol implements IHooks directly (no BaseHook abstraction) and registers four callbacks: beforeSwap, afterSwap, beforeAddLiquidity, and afterRemoveLiquidity.',
      'Dynamic fees are enabled via the DYNAMIC_FEE_FLAG (0x800000) at pool initialization. The beforeSwap callback returns the oracle-recommended fee OR\'d with OVERRIDE_FEE_FLAG (0x400000), atomically overriding the pool fee in a single transaction.',
      'Every fee change requires a valid ECDSA signature from the trusted oracle address. The contract uses ECDSA.tryRecover to surface all signature errors as a single InvalidSignature revert — preventing signature malleability attacks and zero-byte bypasses.',
      'IL is computed on-chain using the sqrtPriceX96 formula: IL = 1 − 2q/(1+q²) where q is the sqrt-price ratio between entry and exit. The result is stored in basis points (0–10000) for gas efficiency.',
      'ILInsuranceFund.sol holds ETH reserves. Each claim is capped at 10% of the fund balance to prevent drain attacks. The payout formula is: payout = min(halfIL, balance/10).',
      'HookMiner.sol mines CREATE2 salts so the hook\'s deployed address encodes Uniswap\'s permission flags in its lower 14 bits: BEFORE_SWAP(1<<7), AFTER_SWAP(1<<6), BEFORE_ADD_LIQUIDITY(1<<11), AFTER_REMOVE_LIQUIDITY(1<<8).',
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
    id: '02',
    title: 'AI Inference Layer',
    subtitle: '0G Sealed Inference · TEE Attestation · ECDSA Signing',
    body: [
      '0G\'s Sealed Inference runs the IL risk model inside a Trusted Execution Environment (TEE). The compute node processes three input signals: rolling 30-period volatility (σ), tick proximity (distance from current tick to position boundaries as a fraction of the range), and 5-period price momentum.',
      'The model outputs a 4-class risk label (LOW / MEDIUM / HIGH / CRITICAL) plus a recommended fee in basis points and a rebalance signal. Before the result leaves the TEE, the execution environment signs a deterministic hash over all output fields using ECDSA.',
      'The signed message structure is identical to what NeuralHook.sol verifies on-chain — solidityPackedKeccak256([resultHash, ilRisk, predictedILBps, recommendedFee, rebalanceSignal, yieldScore, timestamp, chainId, hookAddress]). This means the TEE attestation and the on-chain check share the same cryptographic primitive with no translation layer.',
      'In development/mock mode, an ethers.js Wallet produces signatures with an identical message structure, allowing full end-to-end testing without a live TEE. The mock is designed to fail on-chain if the oracle address is swapped, ensuring test coverage is meaningful.',
    ],
    specs: [
      ['Provider', '0G Network Sealed Inference'],
      ['Input features', 'σ (volatility) · tick proximity · momentum'],
      ['Output', 'ILRisk class · feeBps · rebalanceSignal · yieldScore'],
      ['Signing', 'ECDSA secp256k1 · keccak256 packed'],
      ['Fallback', 'ethers.Wallet mock (same message structure)'],
    ],
  },
  {
    id: '03',
    title: 'Agent Consensus',
    subtitle: 'Gensyn AXL · 3-Node Gossip · 2-of-3 Threshold',
    body: [
      'Three independent TypeScript agents each run a full 30-second inference loop: fetch pool state, call 0G inference, produce a signed result, then gossip the vote to the other two nodes via Gensyn\'s AXL HTTP transport.',
      'Votes carry the signed InferenceResult plus the agent\'s measured round-trip latency. When a node collects two matching votes (same ilRisk class), it declares consensus. If three nodes disagree, the higher risk class wins the tie-break — NeuralHook is asymmetrically conservative.',
      'Once consensus is reached, the node with the lowest latency among the agreeing agents submits the canonical signature on-chain. This minimizes gas cost (only one submission) while preserving Byzantine fault tolerance — one node can fail or lie without breaking the system.',
      'Each agent exposes HTTP endpoints: /vote (receive peer votes), /status (health + uptime), /history (last N consensus results), /audit-log (KeeperHub execution records), /trigger-volatility (testing). The AXL gossip layer handles node discovery and message deduplication.',
    ],
    specs: [
      ['Transport', 'Gensyn AXL HTTP gossip'],
      ['Nodes', '3 independent TypeScript agents'],
      ['Threshold', '2-of-3 matching ilRisk class'],
      ['Tie-break', 'Higher risk wins'],
      ['Submission', 'Lowest-latency agreeing agent'],
    ],
  },
  {
    id: '04',
    title: 'KeeperHub Execution',
    subtitle: 'MCP Tool · Gas Simulation · Exponential Backoff',
    body: [
      'KeeperHub is a Model Context Protocol (MCP) tool that wraps the final on-chain submission step. It first simulates the transaction via eth_estimateGas to confirm the consensus signature and parameters are valid before committing any gas.',
      'If simulation passes, KeeperHub calls submitConsensusResult on NeuralHook.sol, passing the consensus IL risk, recommended fee, and the oracle\'s ECDSA signature. The hook\'s onlyPoolManager modifier and signature verification run on-chain atomically.',
      'On failure, KeeperHub retries with exponential backoff: attempt 1 after 1s, attempt 2 after 2s, attempt 3 after 4s. After three failures it logs the entry to the audit trail with success=false and surfaces the error to the Gensyn consensus layer.',
      'Every execution — success or failure — writes an AuditEntry: txHash, action, ilRisk, fee, gasUsed, timestamp, success. These entries are surfaced on the Dashboard\'s Audit Trail and can be queried via the /audit-log endpoint.',
    ],
    specs: [
      ['Interface', 'MCP Tool (Model Context Protocol)'],
      ['Pre-flight', 'eth_estimateGas simulation'],
      ['Retries', '3 attempts · 1s / 2s / 4s backoff'],
      ['Audit log', 'Every execution recorded (success + failure)'],
      ['Signer', 'ethers.Wallet (NEXT_PUBLIC_PRIVATE_KEY)'],
    ],
  },
]

export default function AboutPage() {
  return (
    <main className="relative min-h-screen pt-14">
      <P5NeuralNet intensity="calm" className="fixed inset-0 w-full h-full opacity-15" />
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-black via-black/80 to-black" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 space-y-24">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-6">
          <NeuralHookLogo size={64} />
          <div>
            <h1 className="font-mono font-black text-3xl text-white tracking-tight uppercase">How NeuralHook Works</h1>
            <p className="font-mono text-xs text-[#555] mt-3 max-w-lg mx-auto leading-relaxed">
              Four layers that each depend on the next — remove any one and the project breaks.
              This is a fully integrated system, not a stack of independent modules.
            </p>
          </div>
        </div>

        {/* Dependency chain diagram */}
        <div className="border border-[#1a1a1a] p-6 font-mono text-xs text-[#555]">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {['Smart Contracts', '→', '0G AI Inference', '→', 'Gensyn Consensus', '→', 'KeeperHub MCP', '→', 'On-Chain Execution'].map((item, i) => (
              <span key={i} className={item === '→' ? 'text-[#333] flex-shrink-0' : 'text-white whitespace-nowrap flex-shrink-0'}>
                {item}
              </span>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-[#333]">
            The contracts define what valid inference looks like (signature schema + fee tiers). The AI layer produces the signed result. Consensus validates it across 3 nodes. KeeperHub submits it.
          </p>
        </div>

        {/* Layers */}
        {LAYERS.map(layer => (
          <section key={layer.id} className="space-y-6">
            <div className="flex items-start gap-6">
              <span className="font-mono text-[#333] text-4xl font-black leading-none">{layer.id}</span>
              <div>
                <h2 className="font-mono font-black text-xl text-white uppercase tracking-tight">{layer.title}</h2>
                <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest mt-1">{layer.subtitle}</p>
              </div>
            </div>

            <div className="space-y-4 pl-16">
              {layer.body.map((para, i) => (
                <p key={i} className="font-mono text-sm text-[#888] leading-relaxed">{para}</p>
              ))}
            </div>

            <div className="pl-16">
              <div className="border border-[#1a1a1a] divide-y divide-[#111]">
                {layer.specs.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[10rem_1fr] px-4 py-2">
                    <span className="font-mono text-[10px] text-[#444] uppercase">{k}</span>
                    <span className="font-mono text-[10px] text-white">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* ETHGlobal note */}
        <div className="border border-[#222] p-6 space-y-3">
          <h3 className="font-mono font-bold text-white text-sm uppercase tracking-widest">ETHGlobal Open Agents 2026</h3>
          <p className="font-mono text-xs text-[#666] leading-relaxed">
            NeuralHook was built for ETHGlobal Open Agents 2026. The project demonstrates that AI agents can be
            integrated into DeFi infrastructure without compromising on-chain security guarantees — every agent
            action ultimately requires a cryptographic proof that the smart contract verifies atomically.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            {[
              { track: 'Uniswap v4', use: 'Dynamic fee hook + insurance' },
              { track: '0G Network', use: 'Sealed inference + TEE signing' },
              { track: 'Gensyn', use: 'AXL 3-node consensus' },
              { track: 'KeeperHub', use: 'MCP execution + audit' },
            ].map(t => (
              <div key={t.track} className="space-y-1">
                <div className="font-mono text-[10px] text-white uppercase">{t.track}</div>
                <div className="font-mono text-[10px] text-[#444]">{t.use}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
