import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Upload, Download, Trash2, Pencil, ArrowRight, Loader2 } from "lucide-react"
import type { ActivityEntry } from "@/lib/types"
import { clearActivity } from "@/lib/api"
import { useActivity } from "@/lib/queries"
import { timeAgo } from "@/lib/utils"

const ACTION_CONFIG: Record<string, { icon: typeof Upload; color: string; label: string }> = {
  uploaded: { icon: Upload, color: "text-[#3E90F0]", label: "Uploaded" },
  imported: { icon: Download, color: "text-[#8E55EA]", label: "Imported" },
  deleted: { icon: Trash2, color: "text-[#D84C10]", label: "Deleted" },
  renamed: { icon: Pencil, color: "text-[#F0C93E]", label: "Renamed" },
  moved: { icon: ArrowRight, color: "text-[#3FDD78]", label: "Moved" },
}

const NO_ENTRIES: ActivityEntry[] = []

interface ActivityViewProps {
  folderId?: string
}

export function ActivityView({ folderId }: ActivityViewProps) {
  const queryClient = useQueryClient()
  const { data: entries = NO_ENTRIES, isPending: loading } = useActivity(folderId)
  const [clearing, setClearing] = useState(false)

  const handleClear = async () => {
    setClearing(true)
    const res = await clearActivity()
    if (!res.error) {
      await queryClient.invalidateQueries({ queryKey: ["activity"] })
    }
    setClearing(false)
  }

  const folderLabel = !folderId || folderId === "All documents" ? "all folders" : folderId

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-6 md:px-[40px] md:pt-[40px]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-[Inter,sans-serif] text-[20px] font-bold tracking-[-0.4px] text-[var(--dr-main-title)] md:text-[28px]">
            Activity
          </h2>
          <p className="mt-1 font-[Karla,sans-serif] text-[14px] text-[var(--dr-main-subtitle)]">
            Showing activity for {folderLabel}
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={handleClear}
            disabled={clearing}
            className="flex items-center gap-2 rounded-[10px] border border-[var(--dr-card-border)] px-4 py-2 font-[Inter,sans-serif] text-[13px] font-semibold text-[var(--dr-main-subtitle)] transition-colors hover:border-red-300 hover:text-red-500 disabled:opacity-50"
          >
            <Trash2 size={14} />
            {clearing ? "Clearing..." : "Clear all"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center pb-[80px]">
          <Loader2 size={28} className="animate-spin text-[var(--dr-main-subtitle)]" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 pb-[80px]">
          <p className="font-[Inter,sans-serif] text-[18px] font-semibold text-[var(--dr-main-title)]">
            No activity yet
          </p>
          <p className="font-[Karla,sans-serif] text-[15px] text-[var(--dr-main-subtitle)]">
            Your recent actions will appear here
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[2px]">
          {entries.map((entry) => {
            const config = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG.uploaded
            const Icon = config.icon
            return (
              <div
                key={entry.id}
                className="flex items-center gap-4 rounded-[10px] px-4 py-3 transition-colors hover:bg-[var(--dr-card-border)]/40"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--dr-card-border)]">
                  <Icon size={18} className={config.color} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-[Inter,sans-serif] text-[14px] font-semibold leading-6 text-[var(--dr-main-title)]">
                    {entry.file_name}
                  </span>
                  <span className="font-[Karla,sans-serif] text-[13px] text-[var(--dr-main-subtitle)]">
                    {config.label}
                    {entry.details ? ` · ${entry.details}` : ""}
                  </span>
                </div>
                <span className="shrink-0 font-[Karla,sans-serif] text-[12px] text-[var(--dr-main-subtitle)]">
                  {timeAgo(entry.created_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
