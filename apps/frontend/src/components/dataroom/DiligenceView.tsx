import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, CircleDashed, Loader2, ShieldAlert, Sparkles, XCircle } from "lucide-react"
import type { ChecklistItem } from "@/lib/types"
import { analyzeUnprocessed, runDiligenceReview } from "@/lib/api"
import { keys, unwrap, useDiligence } from "@/lib/queries"
import { SENSITIVE_LABELS } from "@/lib/labels"
import { timeAgo } from "@/lib/utils"

const STATUS: Record<ChecklistItem["status"], { icon: typeof CheckCircle2; color: string; bar: string; label: string }> = {
  covered: { icon: CheckCircle2, color: "text-[#1f9d55]", bar: "#3FDD78", label: "Covered" },
  partial: { icon: CircleDashed, color: "text-amber-600", bar: "#F0B43E", label: "Partial" },
  missing: { icon: XCircle, color: "text-[var(--dr-main-subtitle)]", bar: "var(--dr-card-border)", label: "Missing" },
}

const card = "rounded-[14px] border border-[var(--dr-card-border)] p-4"
const heading = "font-[Inter,sans-serif] text-[14px] font-semibold text-[var(--dr-main-title)]"
const muted = "font-[Karla,sans-serif] text-[13px] text-[var(--dr-main-subtitle)]"

function Coverage({ items }: { items: ChecklistItem[] }) {
  const counts = { covered: 0, partial: 0, missing: 0 }
  items.forEach((i) => { counts[i.status] += 1 })
  return (
    <div className={`${card} flex flex-col gap-3`}>
      <div className="flex items-baseline gap-2">
        <span className="font-[Inter,sans-serif] text-[32px] font-bold leading-none text-[var(--dr-main-title)]">
          {counts.covered}<span className="text-[18px] text-[var(--dr-main-subtitle)]"> / {items.length}</span>
        </span>
        <span className={muted}>checklist items covered</span>
      </div>
      <div className="flex h-[10px] gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`${counts.covered} covered, ${counts.partial} partial, ${counts.missing} missing`}>
        {(["covered", "partial", "missing"] as const).map((s) => counts[s] > 0 && (
          <div key={s} style={{ flex: counts[s], background: STATUS[s].bar }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {(["covered", "partial", "missing"] as const).map((s) => {
          const Icon = STATUS[s].icon
          return (
            <span key={s} className={`flex items-center gap-1 ${muted}`}>
              <Icon size={14} className={STATUS[s].color} /> {counts[s]} {STATUS[s].label.toLowerCase()}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function Checklist({ items }: { items: ChecklistItem[] }) {
  const groups = items.reduce<Record<string, ChecklistItem[]>>((acc, i) => {
    (acc[i.category] ??= []).push(i)
    return acc
  }, {})
  return (
    <div className={`${card} flex flex-col gap-4`}>
      <span className={heading}>Due diligence checklist</span>
      {Object.entries(groups).map(([category, list]) => (
        <div key={category} className="flex flex-col gap-1">
          <span className="font-[Karla,sans-serif] text-[11px] font-semibold uppercase tracking-wide text-[var(--dr-main-subtitle)]">{category}</span>
          {list.map((item) => {
            const s = STATUS[item.status]
            return (
              <div key={item.id} className="flex items-start gap-3 rounded-[10px] px-2 py-2 hover:bg-[var(--dr-card-border)]/30">
                <s.icon size={17} className={`mt-[2px] shrink-0 ${s.color}`} aria-label={s.label} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-[Inter,sans-serif] text-[13px] font-semibold text-[var(--dr-main-title)]">{item.title}</span>
                  {item.note && <span className={muted}>{item.note}</span>}
                  {item.evidence.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.evidence.map((e) => (
                        <span key={e.id} className="max-w-[220px] truncate rounded-full bg-[var(--dr-card-border)] px-2 py-[1px] font-[Karla,sans-serif] text-[11px] text-[var(--dr-main-title)]">
                          {e.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function DiligenceView() {
  const queryClient = useQueryClient()
  // Polls on its own while documents are still being classified
  const { data } = useDiligence()

  const review = useMutation({
    mutationFn: () => unwrap(runDiligenceReview()),
    onSuccess: (overview) => queryClient.setQueryData(keys.diligence, overview),
  })
  const analyze = useMutation({
    mutationFn: () => unwrap(analyzeUnprocessed()),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.diligence }),
      queryClient.invalidateQueries({ queryKey: keys.files }),
    ]),
  })
  const reviewing = review.isPending
  const handleReview = () => review.mutate()
  const handleAnalyze = () => analyze.mutate()

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[var(--dr-main-subtitle)]" />
      </div>
    )
  }

  const maxCategory = Math.max(1, ...data.categories.map((c) => c.count))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-6 pb-10 md:px-[40px] md:pt-[40px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[Inter,sans-serif] text-[20px] font-bold tracking-[-0.4px] text-[var(--dr-main-title)] md:text-[28px]">Due diligence</h2>
          <p className={`mt-1 ${muted} text-[14px]`}>
            Coverage against a standard M&A checklist ·{" "}
            {data.reviewed_at
              ? `reviewed ${timeAgo(data.reviewed_at)} by ${data.source === "claude" ? "Claude" : "keyword matching"}`
              : "keyword matching — run a review for a reasoned assessment"}
          </p>
        </div>
        <button
          onClick={handleReview}
          disabled={reviewing || data.total_files === 0}
          className="flex items-center gap-2 rounded-[12px] bg-[#141718] px-4 py-[10px] font-[Inter,sans-serif] text-[14px] font-semibold text-white hover:bg-[#232627] disabled:opacity-50"
        >
          {reviewing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {reviewing ? "Reviewing…" : data.ai_enabled ? "Run AI review" : "Re-run review"}
        </button>
      </div>

      {!data.ai_enabled && (
        <p className={`rounded-[12px] bg-[var(--dr-card-border)]/50 px-4 py-3 ${muted}`}>
          AI is off on this server, so documents are classified by keywords. Set <code>ANTHROPIC_API_KEY</code> to have Claude read and assess them.
        </p>
      )}
      {(data.unanalyzed > 0 || data.pending > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[#3E90F0]/30 bg-[#3E90F0]/5 px-4 py-3">
          {data.pending > 0 ? (
            <span className={`flex items-center gap-2 ${muted}`}><Loader2 size={14} className="animate-spin" /> Classifying {data.pending} document{data.pending === 1 ? "" : "s"}…</span>
          ) : (
            <>
              <span className={muted}>{data.unanalyzed} document{data.unanalyzed === 1 ? " was" : "s were"} uploaded before analysis was available.</span>
              <button onClick={handleAnalyze} className="font-[Inter,sans-serif] text-[13px] font-semibold text-[#3E90F0] hover:underline">Analyze now</button>
            </>
          )}
        </div>
      )}

      {data.total_files === 0 ? (
        <p className={`py-16 text-center ${muted} text-[15px]`}>Upload or import documents to see how complete your data room is</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <Coverage items={data.checklist} />
            <Checklist items={data.checklist} />
          </div>
          <div className="flex flex-col gap-4">
            <div className={`${card} flex flex-col gap-3`}>
              <span className={heading}>Documents by category</span>
              {data.categories.length === 0 ? <span className={muted}>Nothing classified yet</span> : data.categories.map((c) => (
                <div key={c.category} className="flex flex-col gap-1" title={`${c.category}: ${c.count}`}>
                  <div className="flex justify-between font-[Karla,sans-serif] text-[12px] text-[var(--dr-main-title)]">
                    <span>{c.category}</span><span className="tabular-nums text-[var(--dr-main-subtitle)]">{c.count}</span>
                  </div>
                  <div className="h-[6px] rounded-full bg-[var(--dr-card-border)]">
                    <div className="h-full rounded-full bg-[#3E90F0]" style={{ width: `${(c.count / maxCategory) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className={`${card} flex flex-col gap-3`}>
              <span className={`flex items-center gap-2 ${heading}`}><ShieldAlert size={16} className="text-amber-600" /> Review before sharing</span>
              {data.sensitive_files.length === 0 ? (
                <span className={muted}>No sensitive data detected</span>
              ) : data.sensitive_files.map((f) => (
                <div key={f.id} className="flex flex-col gap-1">
                  <span className="truncate font-[Inter,sans-serif] text-[13px] font-semibold text-[var(--dr-main-title)]">{f.name}</span>
                  <div className="flex flex-wrap gap-1">
                    {f.sensitive.map((s, i) => (
                      <span key={i} title={s.detail} className="rounded-full bg-amber-500/10 px-2 py-[1px] font-[Karla,sans-serif] text-[11px] font-semibold text-amber-600">
                        {SENSITIVE_LABELS[s.kind]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
