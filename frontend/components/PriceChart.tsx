'use client'
import { useEffect, useRef } from 'react'

interface DataPoint { t: number; price: number; il: number }

interface Props { data: DataPoint[] }

export default function PriceChart({ data }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || data.length < 2) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const prices = data.map(d => d.price)
    const minP = Math.min(...prices), maxP = Math.max(...prices)
    const rangeP = maxP - minP || 1

    const toX = (i: number) => (i / (data.length - 1)) * W
    const toY = (v: number) => H - 8 - ((v - minP) / rangeP) * (H - 16)

    // Grid lines
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = 8 + (i / 4) * (H - 16)
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    // Price fill
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(data[0].price))
    data.forEach((d, i) => ctx.lineTo(toX(i), toY(d.price)))
    ctx.lineTo(toX(data.length - 1), H)
    ctx.lineTo(0, H)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fill()

    // Price line
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(data[0].price))
    data.forEach((d, i) => ctx.lineTo(toX(i), toY(d.price)))
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // IL line (secondary)
    const ils = data.map(d => d.il)
    const minIL = Math.min(...ils), maxIL = Math.max(...ils) || 1
    const toYIL = (v: number) => H - 8 - ((v - minIL) / (maxIL - minIL || 1)) * (H - 16)
    ctx.beginPath()
    ctx.moveTo(toX(0), toYIL(data[0].il))
    data.forEach((d, i) => ctx.lineTo(toX(i), toYIL(d.il)))
    ctx.strokeStyle = 'rgba(200,200,200,0.35)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }, [data])

  return (
    <div className="card p-5 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">Price / IL</span>
        <div className="flex gap-4 text-[10px] font-mono text-[#555]">
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-px bg-white" />Price</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-px bg-[#888]" style={{borderTop:'1px dashed #888'}} />IL %</span>
        </div>
      </div>
      <canvas ref={ref} width={480} height={120} className="w-full" />
    </div>
  )
}
