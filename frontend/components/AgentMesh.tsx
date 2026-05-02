'use client'
import type { AgentStatus } from '@/lib/types'

interface Props { statuses: AgentStatus[] }

const OFFLINE_NODES: AgentStatus[] = [
  { id: 'agent-0', healthy: false, lastConsensus: 0, voteCount: 0, inferenceCount: 0, uptime: 0 },
  { id: 'agent-1', healthy: false, lastConsensus: 0, voteCount: 0, inferenceCount: 0, uptime: 0 },
  { id: 'agent-2', healthy: false, lastConsensus: 0, voteCount: 0, inferenceCount: 0, uptime: 0 },
]

export default function AgentMesh({ statuses }: Props) {
  const nodes = statuses.length > 0 ? statuses : OFFLINE_NODES
  const onlineCount = nodes.filter(s => s.healthy).length

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          AI Agent Mesh
        </span>
        <span className="font-mono text-xs" style={{ color: onlineCount > 0 ? '#22C55E' : 'var(--text-muted)' }}>
          {onlineCount}/3 online · 2-of-3 consensus
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {nodes.map((s, i) => (
          <div
            key={s.id}
            className="rounded p-3 space-y-2"
            style={{ border: `1px solid ${s.healthy ? 'var(--border-mid)' : 'var(--border)'}` }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: s.healthy ? '#22C55E' : 'var(--border)' }}
              />
              <span className="font-mono text-xs font-bold" style={{ color: s.healthy ? 'var(--text)' : 'var(--text-muted)' }}>
                Node {i}
              </span>
            </div>
            <div className="space-y-1 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
              <div className="flex justify-between">
                <span>Uptime</span>
                <span style={{ color: s.healthy ? 'var(--text)' : 'var(--text-muted)' }}>
                  {s.healthy ? `${s.uptime.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Votes</span>
                <span style={{ color: s.healthy ? 'var(--text)' : 'var(--text-muted)' }}>
                  {s.healthy ? s.voteCount : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Inferences</span>
                <span style={{ color: s.healthy ? 'var(--text)' : 'var(--text-muted)' }}>
                  {s.healthy ? s.inferenceCount : '—'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {onlineCount === 0 && (
        <p className="font-mono text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          Run <code style={{ color: 'var(--text-mid)' }}>pnpm agents</code> to bring nodes online
        </p>
      )}
    </div>
  )
}
