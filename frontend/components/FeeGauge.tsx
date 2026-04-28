'use client'
import type { ILRisk } from '@/lib/types'

interface Props { fee: number; risk: ILRisk }

const MAX_FEE = 10000

export default function FeeGauge({ fee, risk }: Props) {
  const pct = Math.min((fee / MAX_FEE) * 100, 100)
  const barColor = risk === 'CRITICAL' ? '#ffffff' : risk === 'HIGH' ? '#cccccc' : risk === 'MEDIUM' ? '#888888' : '#444444'

  return (
    <div className="card p-5 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">Dynamic Fee</span>
        <span className="font-mono text-lg font-bold text-white">{(fee / 100).toFixed(2)}%</span>
      </div>
      <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-[#444]">
        <span>0.05%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
