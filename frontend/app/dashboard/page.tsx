'use client'
import dynamic from 'next/dynamic'
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
  useTriggerVolatility, useDerivedStats, useOnChainHookState,
  useWalletLPPosition, useFeeHistory,
} from '@/lib/hooks'
import { sqrtPriceX96ToPrice } from '@/lib/contracts'
import type { ILRisk } from '@/lib/types'

const P5NeuralNet = dynamic(() => import('@/components/P5NeuralNet'), { ssr: false })

function DataSourceBadge({ source }: { source: string }) {
  const isLive = source !== 'offline'
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded"
      style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: isLive ? '#22C55E' : 'var(--border-mid)' }} />
      <span className="font-mono text-xs tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
        {source}
      </span>
    </div>
  )
}

export default function DashboardPage() {
  const statuses    = useAgentStatuses()
  const liveHistory = useAgentHistory()
  const auditLog    = useAuditLog()
  const { trigger, loading } = useTriggerVolatility()
  const walletPos   = useWalletLPPosition()
  const chain       = useOnChainHookState()
  const chartData   = useFeeHistory(liveHistory)

  const agentsOnline = statuses.some(s => s.healthy)
  const { avgFee, consensusRate } = useDerivedStats(liveHistory)

  const currentRisk: ILRisk = chain.currentRisk ?? (liveHistory.length ? liveHistory[liveHistory.length - 1].ilRisk : 'LOW')
  const currentFee = chain.currentFee ?? (liveHistory.length ? liveHistory[liveHistory.length - 1].recommendedFee : 500)

  // Get live ETH price from agent sqrtPriceX96
  const liveAgent = statuses.find(s => s.healthy && s.sqrtPriceX96)
  const ethPrice = liveAgent?.sqrtPriceX96 ? sqrtPriceX96ToPrice(liveAgent.sqrtPriceX96) : null

  const dataSource = chain.deployed
    ? 'on-chain · unichain sepolia'
    : agentsOnline ? 'live agents' : 'offline'

  const intensity = currentRisk === 'CRITICAL' ? 'critical' : currentRisk === 'HIGH' ? 'active' : 'calm'

  return (
    <main className="relative min-h-screen pt-[92px]" style={{ background: 'var(--bg)' }}>
      <P5NeuralNet intensity={intensity} className="fixed inset-0 w-full h-full opacity-[0.06]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-5">

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.875rem', color: 'var(--text)', letterSpacing: '-0.01em' }}>
              LP Shield
            </h1>
            <p className="font-mono text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
              ETH / USDC · Uniswap v4 · Unichain Sepolia
            </p>
            {chain.lastUpdate && chain.lastUpdate > 0 && (
              <p className="font-mono text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Last on-chain update {new Date(chain.lastUpdate * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <DataSourceBadge source={dataSource} />
            {chain.paused && (
              <span className="font-mono text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--text)', color: 'var(--text)' }}>PAUSED</span>
            )}
            <ILRiskBadge risk={currentRisk} size="lg" />
            <button onClick={trigger} disabled={loading || !agentsOnline} className="btn-outline !py-2 !px-4 !text-xs disabled:opacity-30">
              {loading ? 'Triggering…' : 'Trigger Volatility'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5 flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Current IL Risk</span>
            <ILRiskBadge risk={currentRisk} size="md" />
            <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{chain.deployed ? 'from chain' : 'ai consensus'}</span>
          </div>
          <StatCard
            label="Active Fee"
            value={`${(currentFee / 10000).toFixed(2)}%`}
            sub={chain.deployed ? 'on-chain override' : 'dynamic override'}
          />
          <StatCard
            label="Avg Fee (session)"
            value={avgFee > 0 ? `${(avgFee / 10000).toFixed(2)}%` : '—'}
            sub={avgFee > 0 ? `${liveHistory.length} rounds` : agentsOnline ? 'loading…' : 'agents offline'}
          />
          <StatCard
            label="Consensus Rate"
            value={liveHistory.length > 0 ? `${(consensusRate * 100).toFixed(0)}%` : '—'}
            sub="2-of-3 threshold"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <FeeGauge fee={currentFee} risk={currentRisk} />
          <PoolStats ethPrice={ethPrice} agentsOnline={agentsOnline} />
          <InsuranceFund />
        </div>

        <PriceChart data={chartData} />

        <div className="grid md:grid-cols-2 gap-4">
          <AgentMesh statuses={statuses} />
          <ConsensusFeed history={liveHistory} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <LPPositions walletPos={walletPos} />
          <AuditTrail entries={auditLog} />
        </div>

        <p className="font-mono text-xs text-center pb-4" style={{ color: 'var(--text-muted)' }}>
          Unichain Sepolia testnet · no mainnet assets at risk ·{' '}
          {chain.deployed ? 'reading live contract state' : agentsOnline ? 'live agent data' : 'start agents: cd agents && npm start'}
        </p>
      </div>
    </main>
  )
}
