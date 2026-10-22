import { Loader2, ShieldAlert, TextSearch } from "lucide-react"
import type { FileInsight } from "@/lib/types"
import { SENSITIVE_LABELS } from "@/lib/labels"

const chip = "flex shrink-0 items-center gap-1 rounded-full px-[8px] py-[2px] font-[Karla,sans-serif] text-[11px] font-semibold"

interface InsightBadgesProps {
  insight?: FileInsight | null
  snippet?: string
}

export function InsightBadges({ insight, snippet }: InsightBadgesProps) {
  return (
    <div className="ml-3 hidden shrink-0 items-center gap-1 md:flex">
      {snippet && (
        <span className={`${chip} bg-[#3E90F0]/10 text-[#3E90F0]`} title={snippet}>
          <TextSearch size={12} /> in text
        </span>
      )}
      {insight?.status === "pending" && (
        <span className={`${chip} text-[var(--dr-main-subtitle)]`} title="Classifying…">
          <Loader2 size={12} className="animate-spin" />
        </span>
      )}
      {insight?.status === "ready" && insight.category && (
        <span className={`${chip} bg-[var(--dr-card-border)] text-[var(--dr-main-subtitle)]`} title={insight.summary ?? undefined}>
          {insight.category}
        </span>
      )}
      {insight?.status === "ready" && insight.sensitive.length > 0 && (
        <span
          className={`${chip} bg-amber-500/10 text-amber-600`}
          title={`Contains: ${insight.sensitive.map((s) => SENSITIVE_LABELS[s.kind]).join(", ")} — review before sharing`}
        >
          <ShieldAlert size={12} /> Sensitive
        </span>
      )}
    </div>
  )
}
