import { useRef, useState } from "react"
import { CheckCircle2, CircleDashed, Quote, XCircle } from "lucide-react"
import { useInView } from "./motion"

const TODAY = new Date().toISOString().slice(0, 10)
const card = "rounded-[20px] border border-white/10 bg-white/[0.03] p-6"
const title = "font-[Inter,sans-serif] text-[18px] font-semibold text-white"
const body = "mt-2 font-[Karla,sans-serif] text-[15px] leading-6 text-[#9BA1A6]"

/** Type an email, watch it get stamped across a shared page, the way the server watermarks real PDFs. */
export function WatermarkDemo() {
  const [email, setEmail] = useState("partner@northwind.vc")
  const stamp = `${email.trim() || "viewer@email"} · ${TODAY}`

  return (
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <div>
        <h2 className="font-[Inter,sans-serif] text-[32px] font-bold leading-tight tracking-[-0.6px] text-white md:text-[40px]">
          Every page knows who is reading it
        </h2>
        <p className="mt-4 max-w-[480px] font-[Karla,sans-serif] text-[18px] leading-7 text-[#B4BAC0]">
          Shared PDFs are stamped on the server with the viewer's email and the date, page by page. A leaked copy points back to its source. Try it:
        </p>
        <label className="mt-6 block max-w-[420px]">
          <span className="font-[Inter,sans-serif] text-[13px] font-semibold text-[#9BA1A6]">Viewer email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value.slice(0, 48))}
            className="mt-2 w-full rounded-[12px] border border-white/15 bg-white/[0.04] px-4 py-3 font-[Inter,sans-serif] text-[15px] text-white outline-none transition-colors focus:border-[#3E90F0]"
          />
        </label>
      </div>

      <div className="mx-auto w-full max-w-[380px]">
        <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-[#FBFBFC] p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
          <p className="font-[Inter,sans-serif] text-[13px] font-bold text-[#141718]">Audited Financial Statements FY2025</p>
          <p className="mt-1 font-[Inter,sans-serif] text-[10px] text-[#6C7275]">Acme Corp · Page 2 of 14</p>
          <div className="mt-5 flex flex-col gap-2">
            {[96, 88, 92, 70, 0, 94, 85, 90, 64, 0, 91, 80, 87, 58].map((w, i) => (
              <span key={i} className="block h-[6px] rounded-full bg-[#E3E6EA]" style={{ width: `${w}%`, opacity: w ? 1 : 0 }} />
            ))}
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-[-40%] flex rotate-[-30deg] flex-col justify-center gap-7">
            {Array.from({ length: 12 }, (_, row) => (
              <p key={row} className="whitespace-nowrap font-[Inter,sans-serif] text-[12px] font-semibold text-[#141718]/[0.13]" style={{ marginLeft: row % 2 ? -60 : 0 }}>
                {Array.from({ length: 4 }, () => stamp).join("     ")}
              </p>
            ))}
          </div>
        </div>
        <p className="mt-4 text-center font-[Karla,sans-serif] text-[13px] text-[#6C7275]" data-testid="watermark-stamp">{stamp}</p>
      </div>
    </div>
  )
}

const HEAT = [0.35, 0.9, 1, 0.55, 0.3, 0.75, 0.45, 0.2, 0.6, 0.85, 0.4, 0.25]

function AnalyticsCard() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  return (
    <div ref={ref} className={card} data-inview={inView}>
      <div aria-hidden className="flex h-[96px] items-end gap-[6px]">
        {HEAT.map((v, n) => (
          <span
            key={n}
            className="lp-bar block h-full flex-1 rounded-[4px]"
            style={{ "--v": v, "--n": n, background: `color-mix(in srgb, #3E90F0 ${Math.round(v * 100)}%, #2A2E31)` } as React.CSSProperties}
          />
        ))}
      </div>
      <h3 className={`${title} mt-5`}>Links that report back</h3>
      <p className={body}>Every open, view and download is logged per link. Time on each page shows what a buyer actually read, and who is most engaged.</p>
    </div>
  )
}

const CHECKS = [
  { icon: CheckCircle2, color: "text-[#3FDD78]", text: "Audited financial statements" },
  { icon: CheckCircle2, color: "text-[#3FDD78]", text: "Cap table & shareholder register" },
  { icon: CircleDashed, color: "text-[#F5B83D]", text: "Material customer contracts" },
  { icon: XCircle, color: "text-[#9BA1A6]", text: "Tax returns (last 3 years)" },
]

function DiligenceCard() {
  return (
    <div className={card}>
      <ul aria-hidden className="flex h-[96px] flex-col justify-between">
        {CHECKS.map(({ icon: Icon, color, text }) => (
          <li key={text} className="flex items-center gap-2 font-[Karla,sans-serif] text-[14px] text-[#E8ECEF]">
            <Icon size={16} className={color} /> {text}
          </li>
        ))}
      </ul>
      <h3 className={`${title} mt-5`}>Claude does the first pass</h3>
      <p className={body}>Each document gets a category, a one-line summary and sensitive-data flags. The room is scored against a 16-item M&A checklist.</p>
    </div>
  )
}

function QACard() {
  return (
    <div className={card}>
      <div aria-hidden className="flex h-[96px] flex-col justify-between">
        <p className="self-start rounded-[12px] rounded-bl-[4px] bg-white/[0.07] px-3 py-1.5 font-[Karla,sans-serif] text-[13px] text-[#E8ECEF]">
          Can Globex terminate on a change of control?
        </p>
        <p className="flex items-start gap-1.5 self-end rounded-[12px] rounded-br-[4px] bg-[#3E90F0]/15 px-3 py-1.5 font-[Karla,sans-serif] text-[13px] italic text-[#BFD9F8]">
          <Quote size={12} className="mt-1 shrink-0" /> "Either party may terminate on 180 days written notice."
        </p>
      </div>
      <h3 className={`${title} mt-5`}>Answers with sources</h3>
      <p className={body}>Buyers ask about a page; you answer from an AI draft whose every quote is checked against the document text before you see it.</p>
    </div>
  )
}

export function FeatureCards() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      <AnalyticsCard />
      <DiligenceCard />
      <QACard />
    </div>
  )
}
