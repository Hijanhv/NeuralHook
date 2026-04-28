'use client'
import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import ILRiskBadge from '@/components/ILRiskBadge'
import StatCard from '@/components/StatCard'
import FeeGauge from '@/components/FeeGauge'
import AgentMesh from '@/components/AgentMesh'
import ConsensusFeed from '@/components/ConsensusFeed'
import InsuranceFund from '@/components/InsuranceFund'
import LPPositions from '@/components/LPPositions'
import AuditTrail from '@/components/AuditTrail'
import PoolStats from '@/components/PoolStats'
import PriceChart from '@/components/PriceChart'
import {
  useAgentStatuses, useAgentHistory, useAuditLog,
  useTriggerVolatility, useDerivedStats, useMockPoolStats,
  useMockPositions, useMockConsensusHistory,
  useOnChainHookState,
} from '@/lib/hooks'
import type { ILRisk } from '@/lib/types'

const P5NeuralNet = dynamic(() => import('@/components/P5NeuralNet'), { ssr: false })

function genChartData(n = 60) {
  let price = 1800
  return Array.from({ length: n }, (_, i) => {
    price += (Math.random() - 0.5) * 40
    const il = Math.abs((price - 1800) / 1800) * 200
    return { t: Date.now() - (n - i) * 60000, price, il }
  })
}

export default function DashboardPage() {
  const statuses    = useAgentStatuses()
  const liveHistory = useAgentHistory()
  const mockHistory = useMockConsensusHistory()
  const auditLog    = useAuditLog()
  const { trigger, loading } = useTriggerVolatility()
  const poolStats   = useMockPoolStats()
  const positions   = useMockPositions()
  const chain       = useOnChainHookState()

  // Prefer live agent data → on-chain state → mock
  const agentsOnline = statuses.some(s => s.healthy)
  const history = agentsOnline && liveHistory.length > 0 ? liveHistory : mockHistory
  const { avgFee, consensusRate } = useDerivedStats(history)

  // Current risk/fee: chain > agents > mock
  const currentRisk: ILRisk = chain.currentRisk ?? (history.length ? history[history.length - 1].ilRisk : 'LOW')
  const currentFee = chain.currentFee ?? (history.length ? history[history.length - 1].recommendedFee : 500)

  const [chartData, setChartData] = useState(() => genChartData())
  useEffect(() => {
    const id = setInterval(() => {
      setChartData(prev => {
        const last = prev[prev.length - 1]
        const price = last.price + (Math.random() - 0.5) * 30
        const il = Math.abs((price - 1800) / 1800) * 200
        return [...prev.slice(1), { t: Date.now(), price, il }]
      })
    }, 3000)
    return () => clearInterval(id)
  }, [])

  const intensity = currentRisk === 'CRITICAL' ? 'critical' : currentRisk === 'HIGH' ? 'active' : 'calm'

  // Data source label
  const dataSource = chain.deployed ? 'on-chain' : agentsOnline ? 'live agents' : 'simulated'
  const dotColor   = chain.deployed || agentsOnline ? 'bg-white' : 'bg-[#444]'

  return (
    <main className="relative min-h-screen pt-14">
      <P5NeuralNet intensity={intensity} className="fixed inset-0 w-full h-full opacity-20" />
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-black/80 via-black/60 to-black/90" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-mono font-black text-2xl text-white tracking-tight">DASHBOARD</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              <p className="font-mono text-xs text-[#555]">Data source: {dataSource}</p>
              {chain.paused && (
                <span className="font-mono text-[10px] text-white border border-white px-2 py-0.5">PAUSED</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ILRiskBadge risk={currentRisk} size="lg" />
            <button
              onClick={trigger}
              disabled={loading || !agentsOnline}
              className="btn-outline text-xs px-4 py-2 disabled:opacity-30"
              title={!agentsOnline ? 'Start agents to trigger volatility' : undefined}
            >
              {loading ? 'Triggering…' : 'Trigger Volatility'}
            </button>
          </div>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Current IL Risk"
            value={currentRisk}
            sub={chain.deployed ? 'from chain' : undefined}
          />
          <StatCard
            label="Active Fee"
            value={`${(currentFee / 100).toFixed(2)}%`}
            sub={chain.deployed ? 'on-chain override' : 'dynamic override'}
          />
          <StatCard
            label="Avg Fee (session)"
            value={avgFee > 0 ? `${(avgFee / 100).toFixed(2)}%` : '—'}
          />
          <StatCard
            label="Consensus Rate"
            value={`${(consensusRate * 100).toFixed(0)}%`}
            sub="2-of-3 threshold"
          />
        </div>

        {/* Middle row */}
        <div className="grid md:grid-cols-3 gap-4">
          <FeeGauge fee={currentFee} risk={currentRisk} />
          <PoolStats stats={poolStats} />
          <InsuranceFund />
        </div>

        {/* Chart */}
        <PriceChart data={chartData} />

        {/* Agent mesh + consensus */}
        <div className="grid md:grid-cols-2 gap-4">
          <AgentMesh statuses={statuses} />
          <ConsensusFeed history={history} />
        </div>

        {/* Positions + audit */}
        <div className="grid md:grid-cols-2 gap-4">
          <LPPositions positions={positions} />
          <AuditTrail entries={auditLog} />
        </div>
      </div>
    </main>
  )
}
