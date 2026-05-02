'use client'
import type { ILRisk } from '@/lib/types'

interface Props { fee: number; risk: ILRisk }

const MAX_FEE = 10000
const BAR: Record<ILRisk, string> = {
  LOW: '#D4D1C9', MEDIUM: '#A8A49C', HIGH: '#57534A', CRITICAL: '#1A1916',
}

export default function FeeGauge({ fee, risk }: Props) {
  const pct = Math.min((fee / MAX_FEE) * 100, 100)
  return (
    <div className="card p-5 space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Dynamic Fee</span>
        <span className="font-mono text-lg font-bold" style={{ color: 'var(--text)' }}>{(fee / 100).toFixed(2)}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: BAR[risk] }} />
      </div>
      <div className="flex justify-between font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>0.05%</span><span>100%</span>
      </div>
    </div>
  )
}
