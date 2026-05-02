'use client'
import { useEffect, useRef } from 'react'
import type p5Type from 'p5'

interface Props {
  intensity?: 'calm' | 'active' | 'critical'
  className?: string
}

export default function P5NeuralNet({ intensity = 'calm', className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let p5Instance: { remove: () => void } | null = null
    let mounted = true

    import('p5').then(({ default: P5 }) => {
      if (!mounted || !ref.current) return

      const sketch = (p: p5Type) => {
        const NODE_COUNT = 28
        const nodes: { x: number; y: number; vx: number; vy: number; r: number }[] = []
        const edges: [number, number][] = []
        const pulses: { edge: number; t: number; speed: number }[] = []

        p.setup = () => {
          const canvas = p.createCanvas(ref.current!.offsetWidth, ref.current!.offsetHeight)
          canvas.parent(ref.current!)
          canvas.style('position', 'absolute')
          canvas.style('top', '0')
          canvas.style('left', '0')
          p.noStroke()

          for (let i = 0; i < NODE_COUNT; i++) {
            nodes.push({
              x: p.random(p.width),
              y: p.random(p.height),
              vx: p.random(-0.3, 0.3),
              vy: p.random(-0.3, 0.3),
              r: p.random(2, 5),
            })
          }

          for (let i = 0; i < NODE_COUNT; i++) {
            for (let j = i + 1; j < NODE_COUNT; j++) {
              if (p.dist(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y) < 180) {
                edges.push([i, j])
              }
            }
          }
        }

        p.draw = () => {
          p.clear()
          const speed = intensity === 'critical' ? 1.6 : intensity === 'active' ? 1.0 : 0.5
          const baseAlpha = intensity === 'critical' ? 140 : intensity === 'active' ? 90 : 45

          for (const n of nodes) {
            n.x += n.vx * speed + p.random(-0.15, 0.15)
            n.y += n.vy * speed + p.random(-0.15, 0.15)
            if (n.x < 0 || n.x > p.width)  n.vx *= -1
            if (n.y < 0 || n.y > p.height) n.vy *= -1
          }

          for (const [a, b] of edges) {
            const d = p.dist(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y)
            if (d > 200) continue
            const alpha = p.map(d, 0, 200, baseAlpha, 0)
            p.stroke(17, 24, 39, alpha)
            p.strokeWeight(0.5)
            p.line(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y)
          }
          p.noStroke()

          if (p.random() < (intensity === 'critical' ? 0.12 : intensity === 'active' ? 0.06 : 0.02)) {
            const ei = Math.floor(p.random(edges.length))
            pulses.push({ edge: ei, t: 0, speed: p.random(0.008, 0.02) * speed })
          }

          for (let i = pulses.length - 1; i >= 0; i--) {
            const pulse = pulses[i]
            pulse.t += pulse.speed
            if (pulse.t >= 1) { pulses.splice(i, 1); continue }
            const [a, b] = edges[pulse.edge]
            const px = p.lerp(nodes[a].x, nodes[b].x, pulse.t)
            const py = p.lerp(nodes[a].y, nodes[b].y, pulse.t)
            p.fill(17, 24, 39, 200)
            p.circle(px, py, 3)
          }

          for (const n of nodes) {
            p.fill(17, 24, 39, baseAlpha + 30)
            p.circle(n.x, n.y, n.r * 2)
          }
        }

        p.windowResized = () => {
          if (ref.current) p.resizeCanvas(ref.current.offsetWidth, ref.current.offsetHeight)
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p5Instance = new (P5 as any)(sketch)
    })

    return () => {
      mounted = false
      p5Instance?.remove()
    }
  }, [intensity])

  return <div ref={ref} className={`relative overflow-hidden ${className}`} />
}
