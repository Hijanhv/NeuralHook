'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import NeuralHookLogo from '@/components/NeuralHookLogo'
import ILRiskBadge from '@/components/ILRiskBadge'
import type { ILRisk } from '@/lib/types'

const P5NeuralNet = dynamic(() => import('@/components/P5NeuralNet'), { ssr: false })

const RISKS: ILRisk[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

const TICKER_ITEMS = [
  'Hook deployed · block 50918795 · Unichain Sepolia',
  '0G Sealed Inference — TEE-attested AI decisions',
  'Gensyn AXL — 3-node 2-of-3 consensus',
  'KeeperHub MCP — gas-simulated on-chain execution',
  'ETH/USDC pool · chain ID 1301 · fee updating live',
  'Every fee change is cryptographically proven on-chain',
]

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [riskIdx, setRiskIdx] = useState(0)

  useEffect(() => {
    setMounted(true)
    const id = setInterval(() => setRiskIdx(i => (i + 1) % RISKS.length), 2200)
    return () => clearInterval(id)
  }, [])

  const risk: ILRisk = mounted ? RISKS[riskIdx] : 'LOW'
  const tickerText = TICKER_ITEMS.join('  ·  ')

  return (
    <main className="relative min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <P5NeuralNet intensity="calm" className="fixed inset-0 w-full h-full opacity-[0.07]" />

      {/* Announcement ticker */}
      <div style={{ background: 'var(--bg-dark)', borderBottom: '1px solid #333' }}
           className="fixed top-[60px] left-0 right-0 z-40 overflow-hidden h-8 flex items-center">
        <div className="flex whitespace-nowrap animate-ticker gap-0">
          {[tickerText, tickerText].map((t, i) => (
            <span key={i} className="font-mono text-xs text-white/70 tracking-widest uppercase px-8">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center gap-12 pt-28">
        <div className="flex flex-col items-center gap-5">
          <NeuralHookLogo size={52} />
          <p className="font-mono text-[13px] tracking-[0.22em] uppercase" style={{ color: 'var(--text-muted)' }}>
            Uniswap v4 Hook · Unichain Sepolia · Live
          </p>
        </div>

        <div className="max-w-4xl">
          <h1
            style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(3.5rem, 9vw, 7.5rem)', lineHeight: 0.95, letterSpacing: '-0.02em', color: 'var(--text)' }}
          >
            The LP Shield.
          </h1>
          <p
            className="mt-6 max-w-xl mx-auto leading-relaxed"
            style={{ fontFamily: 'var(--font-inter)', fontSize: '1.0625rem', color: 'var(--text-mid)' }}
          >
            AI predicts impermanent loss before it happens. Fees surge to compensate.
            Cryptography proves the AI is not lying.
          </p>
        </div>

        {/* Live risk indicator */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
            Live risk signal
          </span>
          <ILRiskBadge risk={risk} size="lg" />
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/dashboard" className="btn-primary">View Dashboard</Link>
          <Link href="/about" className="btn-outline">How it works</Link>
        </div>

        {/* Stat callout */}
        <div
          className="flex gap-px mt-4"
          style={{ border: '1px solid var(--border)' }}
        >
          {[
            { value: 'LIVE', label: 'Hook updating on-chain now' },
            { value: '41k gas', label: 'Per consensus submission' },
            { value: '2-of-3', label: 'Agent consensus required' },
          ].map((s, i) => (
            <div key={i} className="px-10 py-5 text-center" style={{ borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--text)' }}>{s.value}</div>
              <div className="font-mono text-xs tracking-widest uppercase mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Four-layer architecture */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-28 w-full">
        <p className="font-mono text-xs tracking-[0.2em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
          Architecture
        </p>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--text)', marginBottom: '2.5rem' }}>
          Four layers. Remove any one and the project breaks.
        </h2>

        <div style={{ border: '1px solid var(--border)' }}>
          {[
            {
              num: '01', name: 'Smart Contracts', tech: 'Uniswap v4 · Solidity 0.8.26 · Unichain Sepolia',
              desc: 'NeuralHook.sol verifies ECDSA oracle signatures before executing any fee change. ILInsuranceFund.sol holds ETH reserves with 10% drain protection per claim.',
            },
            {
              num: '02', name: 'AI Inference', tech: '0G Sealed Inference · TEE · local fallback',
              desc: 'Processes pool volatility, tick proximity, and momentum. Produces a signed IL risk (LOW → CRITICAL) and recommended fee. Output signed inside TEE before leaving the model.',
            },
            {
              num: '03', name: 'Agent Consensus', tech: 'Gensyn AXL · 3 nodes · 2-of-3 threshold',
              desc: "Three agents gossip votes over HTTP. When 2-of-3 agree on the same risk class, consensus is declared and the fastest-responding agent's signature is used on-chain.",
            },
            {
              num: '04', name: 'KeeperHub Execution', tech: 'MCP Tool · eth_call simulation · publicnode RPC',
              desc: 'Simulates every tx via eth_call before broadcasting. Only agent-0 submits to prevent nonce collisions. Gas fetched live from the network. Full AuditEntry on every round.',
            },
          ].map((row, i, arr) => (
            <div
              key={row.num}
              className="grid gap-6 px-8 py-7"
              style={{
                gridTemplateColumns: '3rem 1fr 1.4fr',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>{row.num}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--text)' }}>{row.name}</div>
                <div className="font-mono text-xs mt-1 tracking-wider" style={{ color: 'var(--text-muted)' }}>{row.tech}</div>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-mid)', lineHeight: 1.6 }}>{row.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why trust it */}
      <section className="relative z-10 w-full" style={{ background: 'var(--bg-dark)' }}>
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="font-mono text-xs tracking-[0.2em] uppercase mb-3 text-white/65">Trust</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: '#F9F8F5', marginBottom: '1.5rem' }}>
            The AI cannot hallucinate a fee.
          </h2>
          <p style={{ fontSize: '1rem', color: 'rgba(249,248,245,0.82)', lineHeight: 1.7, maxWidth: '640px' }}>
            Every output is signed inside a 0G Sealed Inference TEE before it leaves the model.
            NeuralHook.sol calls <code className="font-mono text-xs bg-white/10 px-1 rounded">ECDSA.recover(resultHash, signature)</code> and
            reverts if the signer is not the <code className="font-mono text-xs bg-white/10 px-1 rounded">trustedOracle</code> address.
            A fabricated fee cannot pass this check. No admin key. No governance delay. The proof is the permission.
          </p>
          <div className="grid grid-cols-3 gap-px mt-10" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              { label: 'TEE Signed', desc: 'Output signed inside hardware enclave before leaving the model' },
              { label: '2-of-3 Consensus', desc: 'Three Gensyn AXL agents agree before any on-chain action' },
              { label: 'On-Chain Proof', desc: 'ECDSA.recover verifies every signature atomically per swap' },
            ].map((t, i) => (
              <div key={t.label} className="px-6 py-6" style={{ borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <div className="font-mono text-xs tracking-widest uppercase text-white/65 mb-2">{t.label}</div>
                <p style={{ fontSize: '0.8125rem', color: 'rgba(249,248,245,0.78)', lineHeight: 1.6 }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deployed contracts */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16 w-full">
        <p className="font-mono text-xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--text-muted)' }}>Deployed contracts · Unichain Sepolia</p>
        <div style={{ border: '1px solid var(--border)' }}>
          {[
            { name: 'NeuralHook', addr: '0x6DCb771F0A8A61F2679989453af9549C9ceA89c0', note: 'Hook · dynamic fee oracle' },
            { name: 'ILInsuranceFund', addr: '0x4D575ac6C3df76C7E22EB59715F0a9e839f16811', note: 'Insurance reserve · 0.01 ETH seed' },
            { name: 'PoolManager', addr: '0x00B036B58a818B1BC34d502D3fE730Db729e62AC', note: 'Uniswap v4 · Unichain Sepolia' },
          ].map((c, i, arr) => (
            <div key={c.name} className="grid px-6 py-4 gap-4 items-center"
              style={{ gridTemplateColumns: '10rem 1fr auto', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontFamily: 'var(--font-inter)', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
              <span className="font-mono text-xs truncate" style={{ color: 'var(--text-muted)' }}>{c.addr}</span>
              <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{c.note}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Built with */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-16 w-full">
        <p className="font-mono text-xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--text-muted)' }}>Built with</p>
        <div className="flex flex-wrap gap-px" style={{ border: '1px solid var(--border)' }}>
          {[
            { name: 'Uniswap v4', role: 'Hook protocol' },
            { name: '0G Network', role: 'Sealed AI inference' },
            { name: 'Gensyn AXL', role: '3-node consensus' },
            { name: 'KeeperHub MCP', role: 'Execution layer' },
            { name: 'Unichain', role: 'L2 deployment' },
          ].map((s, i, arr) => (
            <div key={s.name} className="px-6 py-5 flex-1"
              style={{ background: 'var(--bg-card)', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none', minWidth: '120px' }}>
              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>{s.name}</div>
              <div className="font-mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.role}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
