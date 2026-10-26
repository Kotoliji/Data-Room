import { useEffect, useRef, useState, type CSSProperties } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { prefersReducedMotion, useTilt } from "./motion"
import "./landing.css"

type Doc = { name: string; category: string; sensitive?: boolean }
const FOLDERS: { name: string; color: string; docs: Doc[] }[] = [
  { name: "1. Corporate", color: "#3E90F0", docs: [
    { name: "Articles of Association.pdf", category: "Corporate" },
    { name: "Cap Table March 2026.pdf", category: "Corporate" },
    { name: "Board Minutes Q1.pdf", category: "Corporate" },
  ] },
  { name: "2. Financial", color: "#8E55EA", docs: [
    { name: "Audited Financial Statements FY2025.pdf", category: "Financial" },
    { name: "Management Accounts Q2 2026.pdf", category: "Financial" },
    { name: "Budget 2027.xlsx", category: "Financial" },
  ] },
  { name: "3. Legal & Contracts", color: "#2FB866", docs: [
    { name: "Master Services Agreement – Globex.pdf", category: "Commercial" },
    { name: "Office Lease – Berlin.pdf", category: "Real Estate" },
    { name: "Mutual NDA.docx", category: "Legal" },
  ] },
  { name: "4. HR", color: "#F07B2F", docs: [
    { name: "Employee Option Plan.pdf", category: "HR" },
    { name: "Org Chart.pdf", category: "HR" },
    { name: "Key Employee Compensation.pdf", category: "HR", sensitive: true },  // last = top of the fan, flag fully visible
  ] },
]
const TOTAL = FOLDERS.reduce((n, f) => n + f.docs.length, 0)
const SKELETON = [92, 78, 85, 60, 88, 70]

type Phase = "import" | "classify" | "done"
const STATUS: Record<Phase, string> = {
  import: `Importing ${TOTAL} documents from Google Drive…`,
  classify: "Claude is reading and classifying them…",
  done: `${TOTAL} documents classified · 1 sensitive file flagged before sharing`,
}

/**
 * Intro scene: documents fly in and settle into four folders, a scan sweeps across while
 * "Claude" classifies them, then category chips pop in. Hovering a folder fans its documents out.
 */
export function FolderDesk() {
  const sceneRef = useRef<HTMLDivElement>(null)
  useTilt(sceneRef)
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? "done" : "import"))
  const [open, setOpen] = useState<number | null>(null)
  const touched = useRef(false)
  const hovered = useRef<number | null>(null)  // a folder the mouse just opened: the next click keeps it open

  // One timeline for the whole intro: re-running on every phase change would restart the clock
  useEffect(() => {
    if (prefersReducedMotion()) return
    const toClassify = setTimeout(() => setPhase("classify"), 1900)
    const toDone = setTimeout(() => setPhase("done"), 3300)
    return () => { clearTimeout(toClassify); clearTimeout(toDone) }
  }, [])

  // Once classified, open the HR folder to show the sensitive flag, unless the visitor got there first
  useEffect(() => {
    if (phase !== "done" || touched.current) return
    const t = setTimeout(() => { if (!touched.current) setOpen(3) }, 500)
    return () => clearTimeout(t)
  }, [phase])

  const choose = (i: number | null) => {
    touched.current = true
    setOpen(i)
  }

  return (
    <div className="flex flex-col items-center">
      <div ref={sceneRef} className="lp-scene relative">
        <div className="lp-desk" data-classified={phase === "done"}>
          {FOLDERS.map((folder, f) => (
            <button
              key={folder.name}
              type="button"
              className="lp-folder"
              aria-expanded={open === f}
              aria-label={`${folder.name}, ${folder.docs.length} documents`}
              style={{ "--c": folder.color, "--d": `${f * 90}ms` } as CSSProperties}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return
                hovered.current = f
                choose(f)
              }}
              onClick={() => {
                const keepOpen = hovered.current === f
                hovered.current = null
                choose(keepOpen || open !== f ? f : null)
              }}
            >
              <span className="lp-folder-back" />
              {folder.docs.map((doc, i) => {
                const n = f * 3 + i
                return (
                  <span
                    key={doc.name}
                    className="lp-doc block"
                    style={{
                      "--i": i - 1,
                      "--d": `${250 + n * 85}ms`,
                      "--fx": `${(((n * 37) % 11) - 5) * 90}px`,
                      "--fy": `${-260 - ((n * 53) % 7) * 45}px`,
                      "--fr": `${(((n * 29) % 9) - 4) * 22}deg`,
                    } as CSSProperties}
                  >
                    <span className="flex items-start gap-1.5">
                      <span className="mt-[1px] size-2.5 shrink-0 rounded-[3px]" style={{ background: folder.color }} />
                      <span className="line-clamp-2 font-[Inter,sans-serif] text-[9px] font-semibold leading-[11px] text-[#141718]">{doc.name}</span>
                    </span>
                    <span className="mt-2.5 flex flex-col gap-[5px]">
                      {SKELETON.map((w, k) => (
                        <span key={k} className="block h-[4px] rounded-full bg-[#E3E6EA]" style={{ width: `${(w + n * 7 + k * 3) % 40 + 55}%` }} />
                      ))}
                    </span>
                    <span className="absolute bottom-2.5 left-2.5 flex gap-1">
                      <span className="lp-chip rounded-full bg-[#141718] px-1.5 py-[1px] font-[Inter,sans-serif] text-[8px] font-semibold text-white" style={{ "--cd": `${n * 60}ms` } as CSSProperties}>
                        {doc.category}
                      </span>
                      {doc.sensitive && (
                        <span className="lp-chip rounded-full bg-[#F07B2F] px-1.5 py-[1px] font-[Inter,sans-serif] text-[8px] font-semibold text-white" style={{ "--cd": `${n * 60 + 200}ms` } as CSSProperties}>
                          Sensitive
                        </span>
                      )}
                    </span>
                  </span>
                )
              })}
              <span className="lp-folder-front">
                <span className="font-[Inter,sans-serif] text-[15px] font-semibold text-white">{folder.name}</span>
                <span className="font-[Karla,sans-serif] text-[12px] text-white/75">{folder.docs.length} documents</span>
              </span>
            </button>
          ))}
        </div>
        <div aria-hidden className="lp-scan" />
      </div>

      <p className="mt-10 flex items-center gap-2 font-[Karla,sans-serif] text-[14px] text-[#9BA1A6]" aria-live="polite">
        {phase === "done"
          ? <CheckCircle2 size={15} className="shrink-0 text-[#3FDD78]" />
          : <Loader2 size={15} className="shrink-0 animate-spin" />}
        {STATUS[phase]}
      </p>
    </div>
  )
}
