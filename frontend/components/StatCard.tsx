interface Props {
  label: string
  value: string | number
  sub?: string
  mono?: boolean
}

export default function StatCard({ label, value, sub, mono = true }: Props) {
  return (
    <div className="card p-5 flex flex-col gap-1">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">{label}</span>
      <span className={`text-2xl font-bold text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
      {sub && <span className="text-[11px] text-[#555] font-mono">{sub}</span>}
    </div>
  )
}
