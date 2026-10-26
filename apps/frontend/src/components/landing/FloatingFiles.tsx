import { useEffect, useRef } from "react"
import { FileSpreadsheet, FileText, FolderClosed, Lock, type LucideIcon } from "lucide-react"
import { prefersReducedMotion } from "./motion"

const ICONS: LucideIcon[] = [FileText, FileSpreadsheet, FileText, FolderClosed, Lock]
const REPEL_RADIUS = 150

/** Deterministic 0..1 noise per index, so the layout is stable and render stays pure. */
function noise(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

const SEEDS = Array.from({ length: 18 }, (_, i) => ({
  x: noise(i, 1),
  y: noise(i, 2),
  drift: { x: (noise(i, 3) - 0.5) * 0.3, y: -0.12 - noise(i, 4) * 0.25 },
  spin: (noise(i, 5) - 0.5) * 0.2,
  size: 18 + Math.round(noise(i, 6) * 18),
  opacity: 0.07 + noise(i, 7) * 0.14,
  Icon: ICONS[i % ICONS.length],
}))

/**
 * Background of document icons drifting upward and scattering away from the cursor.
 * Positions live in a ref and are written straight to `transform` each frame: no React state.
 */
export function FloatingFiles() {
  const boxRef = useRef<HTMLDivElement>(null)
  const nodes = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let width = box.clientWidth
    let height = box.clientHeight
    const items = SEEDS.map((s) => ({ ...s, x: s.x * width, y: s.y * height, vx: s.drift.x, vy: s.drift.y, angle: s.x * 360 }))
    const place = () => items.forEach((p, i) => {
      const node = nodes.current[i]
      if (node) node.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.angle}deg)`
    })
    place()
    if (prefersReducedMotion()) return

    const pointer = { x: -1e4, y: -1e4 }
    const onMove = (e: PointerEvent) => {
      const rect = box.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
    }
    const onResize = () => {
      width = box.clientWidth
      height = box.clientHeight
    }

    let frame = requestAnimationFrame(function tick() {
      for (const p of items) {
        const dx = p.x - pointer.x
        const dy = p.y - pointer.y
        const dist = Math.hypot(dx, dy)
        if (dist < REPEL_RADIUS && dist > 1) {
          const push = ((REPEL_RADIUS - dist) / REPEL_RADIUS) * 0.9
          p.vx += (dx / dist) * push
          p.vy += (dy / dist) * push
        }
        // relax back toward the slow base drift after being pushed
        p.vx = p.vx * 0.94 + p.drift.x * 0.06
        p.vy = p.vy * 0.94 + p.drift.y * 0.06
        p.x += p.vx
        p.y += p.vy
        p.angle += p.spin + p.vx * 0.4
        if (p.y < -60) p.y = height + 40
        if (p.y > height + 60) p.y = -40
        if (p.x < -60) p.x = width + 40
        if (p.x > width + 60) p.x = -40
      }
      place()
      frame = requestAnimationFrame(tick)
    })

    window.addEventListener("pointermove", onMove)
    window.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("resize", onResize)
    }
  }, [])

  return (
    <div ref={boxRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {SEEDS.map(({ Icon, size, opacity }, i) => (
        <div
          key={i}
          ref={(node) => { nodes.current[i] = node }}
          className="absolute left-0 top-0 text-[#E8ECEF] will-change-transform"
          style={{ opacity }}
        >
          <Icon size={size} strokeWidth={1.4} />
        </div>
      ))}
    </div>
  )
}
