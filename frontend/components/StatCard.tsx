interface Props {
  label: string
  value: string | number
  sub?: string
}

export default function StatCard({ label, value, sub }: Props) {
  return (
    <div className="card p-5 flex flex-col gap-1">
      <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="font-mono text-2xl font-bold" style={{ color: 'var(--text)' }}>{value}</span>
      {sub && <span className="font-mono text-[13px]" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  )
}
