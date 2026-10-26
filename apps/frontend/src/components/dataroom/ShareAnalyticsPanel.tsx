import { useState } from "react"
import { Loader2 } from "lucide-react"
import type { ShareAnalytics } from "@/lib/types"
import { useShareAnalytics } from "@/lib/queries"
import { formatDuration, timeAgo } from "@/lib/utils"

// One hue for every mark: sequential intensity is mixed from the theme's surface toward it
const MARK = "#3E90F0"
const heat = (share: number) =>
  share <= 0 ? "var(--dr-card-border)" : `color-mix(in oklab, ${MARK} ${Math.round(20 + share * 80)}%, var(--dr-main-bg))`

const muted = "font-[Karla,sans-serif] text-[12px] text-[var(--dr-main-subtitle)]"
const heading = "font-[Inter,sans-serif] text-[13px] font-semibold text-[var(--dr-main-title)]"

function Tip({ text, left }: { text: string; left: number }) {
  return (
    <div
      className="pointer-events-none absolute -top-[30px] z-10 -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-[#141718] px-2 py-[3px] font-[Karla,sans-serif] text-[11px] text-white shadow"
      style={{ left }}
    >
      {text}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[12px] border border-[var(--dr-card-border)] px-4 py-3">
      <span className={muted}>{label}</span>
      <span className="font-[Inter,sans-serif] text-[22px] font-bold leading-7 text-[var(--dr-main-title)]">{value}</span>
    </div>
  )
}

function DailyBars({ daily }: { daily: ShareAnalytics["daily"] }) {
  const [tip, setTip] = useState<{ text: string; left: number } | null>(null)
  const max = Math.max(1, ...daily.map((d) => d.events))
  const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return (
    <div className="flex flex-col gap-2">
      <span className={heading}>Activity, last 14 days</span>
      <div className="relative flex h-[84px] items-end gap-[2px] border-b border-[var(--dr-card-border)]" onMouseLeave={() => setTip(null)}>
        {tip && <Tip {...tip} />}
        {daily.map((d) => (
          <div
            key={d.date}
            className="flex h-full flex-1 items-end"
            onMouseEnter={(e) => {
              const box = e.currentTarget
              setTip({ text: `${label(d.date)} · ${d.events} event${d.events === 1 ? "" : "s"}`, left: box.offsetLeft + box.offsetWidth / 2 })
            }}
          >
            <div
              className="w-full rounded-t-[4px] transition-opacity hover:opacity-80"
              style={{ height: d.events ? `${Math.max(6, (d.events / max) * 100)}%` : 0, background: MARK }}
            />
          </div>
        ))}
      </div>
      <div className={`flex justify-between ${muted}`}>
        <span>{label(daily[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

function PageHeatmap({ doc }: { doc: ShareAnalytics["documents"][number] }) {
  const [tip, setTip] = useState<{ text: string; left: number } | null>(null)
  const max = Math.max(1, ...doc.pages.map((p) => p.seconds))

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--dr-card-border)] px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`truncate ${heading}`}>{doc.file_name}</span>
        <span className={`shrink-0 ${muted}`}>
          {formatDuration(doc.seconds)} · {doc.viewers} viewer{doc.viewers === 1 ? "" : "s"}
          {doc.downloads ? ` · ${doc.downloads} download${doc.downloads === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      {doc.pages.length === 0 ? (
        <span className={muted}>Opened outside the in-app viewer — no page data</span>
      ) : (
        <div className="relative flex flex-wrap gap-[2px]" onMouseLeave={() => setTip(null)}>
          {tip && <Tip {...tip} />}
          {doc.pages.map((p) => (
            <div
              key={p.page}
              className="flex h-[26px] min-w-[26px] flex-1 items-center justify-center rounded-[4px] font-[Karla,sans-serif] text-[10px] text-[var(--dr-main-title)]"
              style={{ background: heat(p.seconds / max), maxWidth: 48 }}
              onMouseEnter={(e) => {
                const box = e.currentTarget
                setTip({ text: `Page ${p.page} · ${formatDuration(p.seconds)}`, left: box.offsetLeft + box.offsetWidth / 2 })
              }}
            >
              {p.page}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ShareAnalyticsPanel({ linkId }: { linkId: number }) {
  const { data } = useShareAnalytics(linkId)

  if (!data) {
    return <Loader2 size={18} className="mx-auto my-4 animate-spin text-[var(--dr-main-subtitle)]" />
  }
  if (data.viewers.length === 0) {
    return <p className={`px-4 py-3 ${muted} text-[13px]`}>No one has opened this link yet — analytics appear after the first visit</p>
  }

  const maxSeconds = Math.max(1, ...data.viewers.map((v) => v.seconds))

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatTile label="Viewers" value={String(data.totals.viewers)} />
        <StatTile label="Time reading" value={formatDuration(data.totals.seconds)} />
        <StatTile label="Document views" value={String(data.totals.views)} />
        <StatTile label="Downloads" value={String(data.totals.downloads)} />
      </div>

      <DailyBars daily={data.daily} />

      <div className="flex flex-col gap-2">
        <span className={heading}>Who is most engaged</span>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse font-[Karla,sans-serif] text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-[var(--dr-main-subtitle)]">
                <th className="py-1 pr-3 font-normal">Viewer</th>
                <th className="py-1 pr-3 font-normal">Time reading</th>
                <th className="py-1 pr-3 text-right font-normal">Views</th>
                <th className="py-1 pr-3 text-right font-normal">Downloads</th>
                <th className="py-1 text-right font-normal">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.viewers.map((v) => (
                <tr key={v.email} className="border-t border-[var(--dr-card-border)] text-[var(--dr-main-title)]">
                  <td className="max-w-[200px] truncate py-2 pr-3 font-semibold">{v.email}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-[6px] w-[80px] overflow-hidden rounded-full bg-[var(--dr-card-border)]">
                        <div className="h-full rounded-full" style={{ width: `${(v.seconds / maxSeconds) * 100}%`, background: MARK }} />
                      </div>
                      <span>{formatDuration(v.seconds)}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{v.views}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{v.downloads}</td>
                  <td className="py-2 text-right text-[var(--dr-main-subtitle)]">{v.last_seen ? timeAgo(v.last_seen) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.documents.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={heading}>Time per page</span>
            <span className={`flex items-center gap-2 ${muted}`}>
              Less
              <span className="h-[8px] w-[60px] rounded-full" style={{ background: `linear-gradient(90deg, ${heat(0.01)}, ${heat(1)})` }} />
              More
            </span>
          </div>
          {data.documents.map((d) => <PageHeatmap key={d.file_id} doc={d} />)}
        </div>
      )}
    </div>
  )
}
