'use client'

interface Props {
  ethPrice:     number | null
  agentsOnline: boolean
}

export default function PoolStats({ ethPrice, agentsOnline }: Props) {
  const rows = [
    { label: 'ETH Price',    value: ethPrice ? `$${ethPrice.toFixed(2)}` : agentsOnline ? 'loading…' : '—' },
    { label: 'Pool Pair',    value: 'ETH / USDC' },
    { label: 'Fee Model',    value: 'Dynamic (AI)' },
    { label: 'Tick Spacing', value: '60' },
    { label: 'IL Threshold', value: '0.2% (20 bps)' },
    { label: 'Network',      value: 'Unichain Sepolia' },
  ]

  return (
    <div className="card p-5 space-y-4">
      <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        Pool · ETH/USDC · Unichain Sepolia
      </span>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(item => (
          <div key={item.label}>
            <div className="font-mono text-xs uppercase mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
            <div className="font-mono text-sm font-bold" style={{ color: 'var(--text)' }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
