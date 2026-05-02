'use client'
import { useOnChainFundStats } from '@/lib/hooks'

export default function InsuranceFund() {
  const chain = useOnChainFundStats()

  const balance      = chain.balance      ?? 0
  const totalClaimed = chain.totalClaimed ?? 0
  const claimCount   = chain.claimCount   ?? 0
  const utilized     = balance + totalClaimed > 0
    ? (totalClaimed / (balance + totalClaimed)) * 100
    : 0

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>IL Insurance Fund</span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: chain.deployed ? '#22C55E' : 'var(--border-mid)' }} />
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{chain.deployed ? 'on-chain' : 'not deployed'}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Balance',  value: chain.deployed ? `${balance.toFixed(3)} ETH`       : '—' },
          { label: 'Claimed',  value: chain.deployed ? `${totalClaimed.toFixed(3)} ETH`  : '—' },
          { label: 'Claims',   value: chain.deployed ? claimCount                         : '—' },
        ].map(item => (
          <div key={item.label}>
            <div className="font-mono text-xs uppercase" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
            <div className="font-mono font-bold text-sm mt-1" style={{ color: 'var(--text)' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>Fund Utilization</span><span>{utilized.toFixed(1)}%</span>
        </div>
        <div className="h-1 rounded overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded transition-all duration-500" style={{ width: `${Math.min(utilized, 100)}%`, background: 'var(--text-mid)' }} />
        </div>
      </div>

      <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
        10% max drain per claim · auto-paid on remove-liquidity · ETH-denominated
      </p>
    </div>
  )
}
