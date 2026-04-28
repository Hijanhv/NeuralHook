'use client'
import type { PoolStats as PS } from '@/lib/types'

interface Props { stats: PS }

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` :
  n >= 1_000     ? `$${(n / 1_000).toFixed(1)}K`     : `$${n.toFixed(0)}`

export default function PoolStats({ stats }: Props) {
  return (
    <div className="card p-5 space-y-4">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">Pool Statistics · ETH/USDC · Unichain Sepolia</span>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'TVL', value: fmt(stats.tvl) },
          { label: '24h Volume', value: fmt(stats.volume24h) },
          { label: '24h Fees', value: fmt(stats.fee24h) },
          { label: 'Current Tick', value: stats.currentTick.toLocaleString() },
          { label: 'IL Protected', value: fmt(stats.ilProtected) },
          { label: 'sqrtPriceX96', value: stats.sqrtPriceX96.slice(0, 10) + '…' },
        ].map(item => (
          <div key={item.label}>
            <div className="text-[10px] font-mono text-[#555] uppercase mb-1">{item.label}</div>
            <div className="font-mono text-sm font-bold text-white">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
