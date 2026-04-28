'use client'
import type { AuditEntry } from '@/lib/types'
import ILRiskBadge from './ILRiskBadge'

interface Props { entries: AuditEntry[] }

export default function AuditTrail({ entries }: Props) {
  const recent = entries.slice(-10).reverse()

  return (
    <div className="card p-5 space-y-3">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">KeeperHub Audit Trail</span>
      <div className="space-y-1 max-h-72 overflow-y-auto font-mono text-[10px]">
        {recent.length === 0 && (
          <div className="text-[#444] py-4 text-center">No on-chain activity yet</div>
        )}
        {recent.map((e, i) => (
          <div key={i} className="flex items-start gap-3 py-1.5 border-b border-[#111] last:border-0">
            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.success ? 'bg-white' : 'bg-[#444]'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <ILRiskBadge risk={e.ilRisk} size="sm" showLabel={false} />
                <span className="text-white truncate">{e.action}</span>
              </div>
              <div className="flex gap-4 text-[#444] mt-0.5">
                <span>{e.txHash.slice(0, 10)}…</span>
                <span>{e.gasUsed.toLocaleString()} gas</span>
                <span>{(e.fee / 100).toFixed(2)}% fee</span>
              </div>
            </div>
            <span className="text-[#333] flex-shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
