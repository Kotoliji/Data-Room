import { useEffect, useState, type RefObject } from "react"

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

/**
 * Tilts an element toward the pointer: writes --tx / --ty (-1..1) as CSS variables,
 * eased in a requestAnimationFrame loop so moving the mouse never re-renders React.
 */
export function useTilt(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let frame = 0

    const tick = () => {
      current.x += (target.x - current.x) * 0.08
      current.y += (target.y - current.y) * 0.08
      el.style.setProperty("--tx", current.x.toFixed(3))
      el.style.setProperty("--ty", current.y.toFixed(3))
      const moving = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > 0.002
      frame = moving ? requestAnimationFrame(tick) : 0
    }
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1
      target.y = (e.clientY / window.innerHeight) * 2 - 1
      if (!frame) frame = requestAnimationFrame(tick)
    }

    window.addEventListener("pointermove", onMove)
    return () => {
      window.removeEventListener("pointermove", onMove)
      cancelAnimationFrame(frame)
    }
  }, [ref])
}

/** True once the element has scrolled into view (and stays true). */
export function useInView(ref: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined")
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setSeen(true)
    }, { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, seen])
  return seen
}
