'use client'
import type { AuditEntry } from '@/lib/types'
import ILRiskBadge from './ILRiskBadge'

interface Props { entries: AuditEntry[] }

export default function AuditTrail({ entries }: Props) {
  const recent = entries.slice(-10).reverse()
  return (
    <div className="card p-5 space-y-3">
      <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>KeeperHub Audit Trail</span>
      <div className="space-y-1 max-h-72 overflow-y-auto font-mono text-xs">
        {recent.length === 0 && (
          <div className="py-4 text-center" style={{ color: 'var(--text-muted)' }}>No on-chain activity yet</div>
        )}
        {recent.map((e, i) => (
          <div key={i} className="flex items-start gap-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: e.success ? '#22C55E' : 'var(--border-mid)' }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <ILRiskBadge risk={e.ilRisk} size="sm" showLabel={false} />
                <span className="truncate" style={{ color: 'var(--text)' }}>{e.action}</span>
              </div>
              <div className="flex gap-4 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                <span>{e.txHash.slice(0, 10)}…</span>
                <span>{e.gasUsed.toLocaleString()} gas</span>
                <span>{(e.fee / 100).toFixed(2)}% fee</span>
              </div>
            </div>
            <span className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{new Date(e.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
