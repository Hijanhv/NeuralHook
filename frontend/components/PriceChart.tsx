'use client'
import { useEffect, useRef } from 'react'

interface DataPoint { t: number; fee: number; risk: number }
interface Props { data: DataPoint[] }

const ACCENT   = '#3B4BD8'
const GRID_CLR = '#EBE9E2'
const MUTED    = '#A8A49C'
const BG_CLR   = '#F9F8F5'
const RISK_COLORS = ['#22C55E', '#EAB308', '#F97316', '#EF4444']

function smoothPath(ctx: CanvasRenderingContext2D, xs: number[], ys: number[]) {
  ctx.moveTo(xs[0], ys[0])
  for (let i = 1; i < xs.length - 1; i++) {
    const mx = (xs[i - 1] + xs[i]) / 2
    const my = (ys[i - 1] + ys[i]) / 2
    ctx.quadraticCurveTo(xs[i - 1], ys[i - 1], mx, my)
  }
  ctx.lineTo(xs[xs.length - 1], ys[xs.length - 1])
}

export default function PriceChart({ data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio ?? 1
    const W = canvas.clientWidth
    const H = canvas.clientHeight
    canvas.width  = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle = BG_CLR
    ctx.fillRect(0, 0, W, H)

    if (data.length < 2) {
      ctx.font = '400 12px monospace'
      ctx.fillStyle = MUTED
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Waiting for agent consensus…', W / 2, H / 2)
      return
    }

    const PL = 60, PR = 14, PT = 14, PB = 26
    const fees = data.map(d => d.fee)
    const minF = Math.min(...fees)
    const maxF = Math.max(...fees) || 1

    const toX = (i: number) => PL + (i / (data.length - 1)) * (W - PL - PR)
    const toY = (v: number, lo: number, hi: number) =>
      PT + (1 - (v - lo) / (hi - lo || 1)) * (H - PT - PB)

    // Y grid (fee labels)
    const feeTicks = [500, 3000, 7500, 10000]
    ctx.font = '400 11px monospace'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'right'
    for (const f of feeTicks) {
      if (f < minF - 500 || f > maxF + 500) continue
      const y = toY(f, minF - 500, maxF + 500)
      ctx.strokeStyle = GRID_CLR
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W - PR, y); ctx.stroke()
      ctx.fillStyle = MUTED
      ctx.fillText(`${(f / 100).toFixed(2)}%`, PL - 5, y)
    }

    // X labels
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let i = 0; i <= Math.min(4, data.length - 1); i++) {
      const idx = Math.round((i / 4) * (data.length - 1))
      const d = new Date(data[idx].t)
      ctx.fillStyle = MUTED
      ctx.fillText(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), toX(idx), H - PB + 5)
    }

    const xs = data.map((_, i) => toX(i))
    const ys = data.map(d => toY(d.fee, minF - 500, maxF + 500))

    // Gradient fill under fee line
    const grad = ctx.createLinearGradient(0, PT, 0, H - PB)
    grad.addColorStop(0, 'rgba(59,75,216,0.13)')
    grad.addColorStop(1, 'rgba(59,75,216,0)')
    ctx.beginPath()
    smoothPath(ctx, xs, ys)
    ctx.lineTo(xs[xs.length - 1], H - PB)
    ctx.lineTo(xs[0], H - PB)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // Fee line
    ctx.beginPath()
    smoothPath(ctx, xs, ys)
    ctx.strokeStyle = ACCENT
    ctx.lineWidth = 2
    ctx.setLineDash([])
    ctx.stroke()

    // Risk dots on each consensus point
    data.forEach((d, i) => {
      ctx.beginPath()
      ctx.arc(toX(i), toY(d.fee, minF - 500, maxF + 500), 4, 0, Math.PI * 2)
      ctx.fillStyle = RISK_COLORS[d.risk] ?? RISK_COLORS[0]
      ctx.fill()
    })

    // Live dot
    const lx = xs[xs.length - 1]
    const ly = ys[ys.length - 1]
    ctx.beginPath()
    ctx.arc(lx, ly, 6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(59,75,216,0.18)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(lx, ly, 3, 0, Math.PI * 2)
    ctx.fillStyle = ACCENT
    ctx.fill()
  }, [data])

  const latestFee = data.length > 0 ? data[data.length - 1].fee : null

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            AI Fee Decisions — Live Consensus History
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--text)' }}>
              {latestFee ? `${(latestFee / 100).toFixed(2)}%` : '—'}
            </span>
            <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>current fee</span>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
          {(['LOW', 'MED', 'HIGH', 'CRIT'] as const).map((label, i) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: RISK_COLORS[i] }} />
              {label}
            </span>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '180px', display: 'block' }} />
    </div>
  )
}
