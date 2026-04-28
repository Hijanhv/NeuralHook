'use client'
import type { AgentStatus } from '@/lib/types'

interface Props { statuses: AgentStatus[] }

export default function AgentMesh({ statuses }: Props) {
  return (
    <div className="card p-5 space-y-4">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">Agent Mesh — 2-of-3 Consensus</span>
      <div className="grid grid-cols-3 gap-3">
        {statuses.map((s, i) => (
          <div key={s.id} className={`border rounded p-3 space-y-2 ${s.healthy ? 'border-[#333]' : 'border-[#222]'}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.healthy ? 'bg-white' : 'bg-[#333]'}`} />
              <span className="font-mono text-xs font-bold text-white">Node {i}</span>
            </div>
            <div className="space-y-1 text-[10px] font-mono text-[#555]">
              <div className="flex justify-between"><span>Uptime</span><span className="text-white">{s.uptime.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span>Votes</span><span className="text-white">{s.voteCount}</span></div>
              <div className="flex justify-between"><span>Inferences</span><span className="text-white">{s.inferenceCount}</span></div>
            </div>
          </div>
        ))}
      </div>
      {statuses.length === 0 && (
        <div className="text-center text-[#444] font-mono text-xs py-4">Connecting to agents...</div>
      )}
    </div>
  )
}
