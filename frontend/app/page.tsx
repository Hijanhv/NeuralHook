'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import NeuralHookLogo from '@/components/NeuralHookLogo'
import ILRiskBadge from '@/components/ILRiskBadge'
import type { ILRisk } from '@/lib/types'

const P5NeuralNet = dynamic(() => import('@/components/P5NeuralNet'), { ssr: false })

const RISKS: ILRisk[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export default function HomePage() {
  const [riskIdx, setRiskIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setRiskIdx(i => (i + 1) % RISKS.length), 1800)
    return () => clearInterval(id)
  }, [])

  const risk = RISKS[riskIdx]

  return (
    <main className="scanlines relative min-h-screen flex flex-col">
      {/* Full-screen neural net background */}
      <P5NeuralNet
        intensity={risk === 'CRITICAL' ? 'critical' : risk === 'HIGH' ? 'active' : 'calm'}
        className="fixed inset-0 w-full h-full"
      />

      {/* Radial fade overlay */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 20%, #000 85%)' }} />

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center gap-10 pt-14">
        <div className="flex flex-col items-center gap-6">
          <NeuralHookLogo size={72} />
          <h1 className="font-mono font-black text-white leading-none tracking-tighter"
            style={{ fontSize: 'clamp(3rem, 10vw, 8rem)' }}>
            NEURAL<br />HOOK
          </h1>
          <p className="font-mono text-[#666] tracking-widest text-xs uppercase max-w-md">
            AI-Powered Impermanent Loss Protection for Uniswap v4 Liquidity Providers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[#444] uppercase tracking-widest">Live Risk</span>
          <ILRiskBadge risk={risk} size="lg" />
        </div>

        <div className="flex gap-4">
          <Link href="/dashboard" className="btn-primary">View Dashboard</Link>
          <Link href="/connect" className="btn-outline">Connect Wallet</Link>
        </div>

        {/* Stat callout */}
        <div className="border border-[#222] px-8 py-4 font-mono text-center">
          <div className="text-4xl font-black text-white">$60M+</div>
          <div className="text-[10px] text-[#555] uppercase tracking-widest mt-1">LP Capital Lost to IL in 2024</div>
        </div>
      </section>

      {/* Architecture table */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-24 w-full">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#444] mb-8">Four-Layer Architecture</h2>
        <div className="border border-[#222] divide-y divide-[#1a1a1a]">
          {[
            { layer: '01', name: 'Smart Contracts', tech: 'Uniswap v4 · Solidity 0.8.26', desc: 'NeuralHook.sol enforces oracle signatures before executing any fee change. ILInsuranceFund.sol holds ETH reserves with 10% drain protection per claim.' },
            { layer: '02', name: 'AI Inference', tech: '0G Sealed Inference · TEE', desc: 'Processes pool volatility, tick proximity, and price momentum via TEE-attested model. Produces ECDSA-signed IL risk classification (LOW/MEDIUM/HIGH/CRITICAL).' },
            { layer: '03', name: 'Agent Consensus', tech: 'Gensyn AXL · 3 nodes', desc: 'Three independent agents run inference in parallel. AXL HTTP gossip achieves 2-of-3 threshold consensus before any on-chain action is taken.' },
            { layer: '04', name: 'Execution', tech: 'KeeperHub MCP · ethers.js', desc: 'Simulates gas, submits the consensus signature on-chain, and retries with exponential backoff (1s → 2s → 4s). Full audit trail stored off-chain.' },
          ].map(row => (
            <div key={row.layer} className="grid grid-cols-[3rem_1fr_1fr] gap-4 px-6 py-5">
              <span className="font-mono text-[#333] text-sm">{row.layer}</span>
              <div>
                <div className="font-mono font-bold text-white text-sm">{row.name}</div>
                <div className="font-mono text-[10px] text-[#555] mt-0.5">{row.tech}</div>
              </div>
              <p className="font-mono text-xs text-[#666] leading-relaxed">{row.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sponsors */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24 w-full">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#444] mb-6">Built With</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-px border border-[#1a1a1a]">
          {['Uniswap v4', '0G Network', 'Gensyn AXL', 'KeeperHub', 'Unichain'].map(s => (
            <div key={s} className="bg-[#0a0a0a] px-4 py-5 font-mono text-xs text-[#555] text-center hover:text-white transition-colors">
              {s}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
