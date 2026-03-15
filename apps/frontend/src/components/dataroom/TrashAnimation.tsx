import { useEffect, useState } from "react"
import { FileText, Folder } from "lucide-react"

interface TrashAnimationItem {
  id: string
  type: "file" | "folder"
  startX: number
  startY: number
}

let addAnimation: ((item: TrashAnimationItem) => void) | null = null

export function triggerTrashAnimation(el: HTMLElement, type: "file" | "folder") {
  if (!addAnimation) return
  const rect = el.getBoundingClientRect()
  addAnimation({
    id: `${Date.now()}-${Math.random()}`,
    type,
    startX: rect.left + rect.width / 2,
    startY: rect.top + rect.height / 2,
  })
}

export function TrashAnimationLayer() {
  const [items, setItems] = useState<TrashAnimationItem[]>([])

  useEffect(() => {
    addAnimation = (item) => setItems((prev) => [...prev, item])
    return () => { addAnimation = null }
  }, [])

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {items.map((item) => (
        <FlyingItem key={item.id} item={item} onDone={() => removeItem(item.id)} />
      ))}
    </div>
  )
}

function FlyingItem({ item, onDone }: { item: TrashAnimationItem; onDone: () => void }) {
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "absolute",
    left: item.startX,
    top: item.startY,
    opacity: 1,
    transform: "translate(-50%, -50%) scale(1)",
    transition: "none",
  })

  useEffect(() => {
    const trashEl = document.querySelector("[data-trash-target]")
    if (!trashEl) {
      onDone()
      return
    }

    const trashRect = trashEl.getBoundingClientRect()
    const endX = trashRect.left + trashRect.width / 2
    const endY = trashRect.top + trashRect.height / 2

    // Calculate arc midpoint (offset perpendicular to line for curve effect)
    const midX = (item.startX + endX) / 2
    const midY = Math.min(item.startY, endY) - 80

    const duration = 800
    const startTime = performance.now()
    let frameId = 0
    let cancelled = false

    const animate = (now: number) => {
      if (cancelled) return
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)

      const u = 1 - ease
      const x = u * u * item.startX + 2 * u * ease * midX + ease * ease * endX
      const y = u * u * item.startY + 2 * u * ease * midY + ease * ease * endY
      const scale = 1 - ease * 0.6
      const opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3

      setStyle({
        position: "absolute",
        left: x,
        top: y,
        opacity,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transition: "none",
      })

      if (t < 1) {
        frameId = requestAnimationFrame(animate)
      } else {
        onDone()
      }
    }

    frameId = requestAnimationFrame(animate)
    return () => { cancelled = true; cancelAnimationFrame(frameId) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const Icon = item.type === "folder" ? Folder : FileText

  return (
    <div style={style}>
      <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--dr-sidebar-bg)] shadow-lg ring-1 ring-[var(--dr-sidebar-border)]">
        <Icon className="size-5 text-[#D84C10]" />
      </div>
    </div>
  )
}
