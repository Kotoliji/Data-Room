import { useCallback, useEffect, useRef, useState } from "react"
import { Download, Loader2, MessageCircleQuestion, Minus, Plus, X } from "lucide-react"
import * as pdfjs from "pdfjs-dist"
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const FLUSH_EVERY_MS = 15_000

interface PdfViewerProps {
  url: string
  title: string
  onClose: () => void
  downloadUrl?: string
  /** When set, seconds spent on each page are reported here (shared-link viewers only). */
  trackUrl?: string
  /** When set, shows an "Ask" button that reports the page being read. */
  onAsk?: (page: number) => void
}

function PdfPage({ doc, pageNumber, scale, width, height, onVisibility }: {
  doc: PDFDocumentProxy
  pageNumber: number
  scale: number
  width: number
  height: number
  onVisibility: (page: number, ratio: number) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)
  const [size, setSize] = useState({ width, height })

  // Render lazily: only pages near the viewport get a canvas
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const lazy = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true) }, { rootMargin: "800px 0px" })
    const ratio = new IntersectionObserver(([e]) => onVisibility(pageNumber, e.intersectionRatio), {
      threshold: [0, 0.25, 0.5, 0.75, 1],
    })
    lazy.observe(el)
    ratio.observe(el)
    return () => { lazy.disconnect(); ratio.disconnect() }
  }, [pageNumber, onVisibility])

  useEffect(() => {
    if (!near) return
    let task: RenderTask | null = null
    let cancelled = false
    doc.getPage(pageNumber).then((page) => {
      const canvas = canvasRef.current
      if (cancelled || !canvas) return
      const viewport = page.getViewport({ scale })
      setSize({ width: viewport.width, height: viewport.height })
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      task = page.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined })
      task.promise.catch(() => { /* cancelled by a zoom change */ })
    })
    return () => { cancelled = true; task?.cancel() }
  }, [doc, pageNumber, scale, near])

  return (
    <div ref={wrapRef} data-page={pageNumber} className="relative shrink-0 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.35)]" style={near ? size : { width, height }}>
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  )
}

export function PdfViewer({ url, title, onClose, downloadUrl, trackUrl, onAsk }: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [baseSize, setBaseSize] = useState<{ width: number; height: number } | null>(null)
  const [fitWidth, setFitWidth] = useState(800)
  const [zoom, setZoom] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const currentPageRef = useRef(1)
  const ratios = useRef(new Map<number, number>())
  const pending = useRef(new Map<number, number>())

  useEffect(() => {
    const task = pdfjs.getDocument({ url, disableRange: true, disableStream: true })
    task.promise
      .then(async (loaded) => {
        const first = (await loaded.getPage(1)).getViewport({ scale: 1 })
        setBaseSize({ width: first.width, height: first.height })
        setDoc(loaded)
      })
      .catch(() => setError("This document could not be opened"))
    return () => { task.destroy() }
  }, [url])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = new ResizeObserver(([e]) => setFitWidth(Math.min(e.contentRect.width - 32, 1000)))
    measure.observe(el)
    return () => measure.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Time on page: one second goes to the most visible page while the tab is in front
  useEffect(() => {
    if (!trackUrl) return
    const flush = () => {
      if (pending.current.size === 0) return
      const body = JSON.stringify({ pages: Object.fromEntries(pending.current) })
      pending.current.clear()
      // text/plain keeps the beacon a CORS "simple" request; it also survives tab close
      navigator.sendBeacon(trackUrl, new Blob([body], { type: "text/plain" }))
    }
    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      const page = currentPageRef.current
      pending.current.set(page, (pending.current.get(page) ?? 0) + 1)
    }, 1000)
    const flusher = window.setInterval(flush, FLUSH_EVERY_MS)
    window.addEventListener("pagehide", flush)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(flusher)
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [trackUrl])

  const onVisibility = useCallback((page: number, ratio: number) => {
    ratios.current.set(page, ratio)
    let best = page
    let bestRatio = -1
    ratios.current.forEach((r, p) => { if (r > bestRatio) { best = p; bestRatio = r } })
    currentPageRef.current = best
    setCurrentPage(best)
  }, [])

  const scale = baseSize ? (fitWidth / baseSize.width) * zoom : 1
  const zoomIndex = ZOOM_STEPS.indexOf(zoom)

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[rgba(20,23,24,0.96)]" role="dialog" aria-label={title}>
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 text-white">
        <span className="min-w-0 flex-1 truncate font-[Inter,sans-serif] text-[14px] font-semibold">{title}</span>
        {doc && (
          <span className="hidden font-[Karla,sans-serif] text-[13px] text-white/60 sm:block">
            Page {currentPage} / {doc.numPages}
          </span>
        )}
        <div className="flex items-center gap-1 rounded-[10px] bg-white/10 p-[2px]">
          <button aria-label="Zoom out" disabled={zoomIndex <= 0} onClick={() => setZoom(ZOOM_STEPS[zoomIndex - 1])} className="rounded-[8px] p-[6px] hover:bg-white/10 disabled:opacity-30">
            <Minus size={15} />
          </button>
          <span className="w-[44px] text-center font-[Karla,sans-serif] text-[12px]">{Math.round(zoom * 100)}%</span>
          <button aria-label="Zoom in" disabled={zoomIndex >= ZOOM_STEPS.length - 1} onClick={() => setZoom(ZOOM_STEPS[zoomIndex + 1])} className="rounded-[8px] p-[6px] hover:bg-white/10 disabled:opacity-30">
            <Plus size={15} />
          </button>
        </div>
        {onAsk && (
          <button onClick={() => onAsk(currentPage)} className="flex items-center gap-1 rounded-[10px] bg-white/10 px-3 py-[6px] font-[Inter,sans-serif] text-[12px] font-semibold hover:bg-white/20">
            <MessageCircleQuestion size={15} /> <span className="hidden sm:inline">Ask about this page</span>
          </button>
        )}
        {downloadUrl && (
          <a href={downloadUrl} aria-label="Download" className="rounded-full p-[8px] hover:bg-white/10">
            <Download size={17} />
          </a>
        )}
        <button onClick={onClose} aria-label="Close viewer" className="rounded-full p-[8px] hover:bg-white/10">
          <X size={18} />
        </button>
      </div>

      <div ref={scrollRef} className="flex flex-1 flex-col items-center gap-4 overflow-auto px-4 py-6">
        {error ? (
          <p className="mt-20 font-[Karla,sans-serif] text-[15px] text-white/70">{error}</p>
        ) : !doc || !baseSize ? (
          <Loader2 size={28} className="mt-20 animate-spin text-white/60" />
        ) : (
          Array.from({ length: doc.numPages }, (_, i) => (
            <PdfPage
              key={i + 1}
              doc={doc}
              pageNumber={i + 1}
              scale={scale}
              width={baseSize.width * scale}
              height={baseSize.height * scale}
              onVisibility={onVisibility}
            />
          ))
        )}
      </div>
    </div>
  )
}
