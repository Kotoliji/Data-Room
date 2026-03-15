import { useState, useRef, useCallback, useEffect } from "react"

const PRESET_COLORS = ["#3e90f0", "#7ece18", "#f0c93e", "#e05297", "#4fc1b0"]

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  onClose?: () => void
}

export function ColorPicker({ value, onChange, onClose }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value.replace("#", ""))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const size = 120

  useEffect(() => {
    setHexInput(value.replace("#", ""))
  }, [value])

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const cx = size / 2
    const cy = size / 2
    const radius = size / 2 - 2

    ctx.clearRect(0, 0, size, size)

    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180
      const endAngle = (angle + 1) * Math.PI / 180

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      gradient.addColorStop(0, "white")
      gradient.addColorStop(1, hsvToHex(angle, 1, 1))

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, radius, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()
    }
  }, [])

  useEffect(() => {
    drawWheel()
  }, [drawWheel])

  const pickColor = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const cx = size / 2
    const cy = size / 2
    const dx = x - cx
    const dy = y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const radius = size / 2 - 2

    if (dist > radius) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data
    const hex = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1].toString(16).padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`
    onChange(hex)
  }, [onChange])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    dragging.current = true
    pickColor(e)
  }, [pickColor])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging.current) pickColor(e)
  }, [pickColor])

  useEffect(() => {
    const handleUp = () => { dragging.current = false }
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose?.()
      }
    }
    window.addEventListener("mouseup", handleUp)
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      window.removeEventListener("mouseup", handleUp)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [onClose])

  const handleHexChange = (val: string) => {
    const clean = val.replace(/[^0-9a-fA-F]/g, "").slice(0, 6)
    setHexInput(clean)
    if (clean.length === 6) {
      onChange(`#${clean}`)
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-3 rounded-xl border border-[var(--dr-sidebar-border)] bg-[var(--dr-sidebar-bg)] p-3 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Presets */}
      <div className="flex gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className="flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110"
            style={{
              background: c,
              outline: value.toLowerCase() === c.toLowerCase() ? "2px solid white" : "none",
              outlineOffset: "2px",
            }}
          />
        ))}
      </div>

      {/* Color wheel */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="cursor-crosshair rounded-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      />

      {/* Hex input */}
      <div className="flex items-center gap-1 rounded-lg border border-[var(--dr-sidebar-border)] bg-black/20 px-2 py-1">
        <span className="text-xs font-mono text-[var(--dr-sidebar-text-inactive)]">#</span>
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          maxLength={6}
          className="w-[70px] bg-transparent font-mono text-xs text-[var(--dr-sidebar-text)] outline-none"
          placeholder="3e90f0"
        />
        <div className="size-4 shrink-0 rounded" style={{ background: value }} />
      </div>
    </div>
  )
}
