import { ChevronRight } from "lucide-react"
import { useState, useRef } from "react"
import type { FolderItem } from "@/lib/types"

function BreadcrumbSegment({ label, targetId, onNavigate }: {
  label: string
  targetId: string
  onNavigate: (folderId: string) => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const [dragOver, setDragOver] = useState(false)

  return (
    <button
      onClick={() => onNavigate(targetId)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-file-id") || e.dataTransfer.types.includes("application/x-folder-id")) {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(true)
          if (!timerRef.current) {
            timerRef.current = setTimeout(() => {
              onNavigate(targetId)
              timerRef.current = null
            }, 800)
          }
        }
      }}
      onDragLeave={() => {
        setDragOver(false)
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      }}
      className={`rounded px-1 transition-colors hover:text-[var(--dr-main-title)] hover:underline ${dragOver ? "bg-[var(--dr-card-border)]/40 text-[var(--dr-main-title)]" : ""}`}
    >
      {label}
    </button>
  )
}

export function Breadcrumb({ folderName, path, onNavigate }: {
  folderName: string
  path: FolderItem[]
  onNavigate: (folderId: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 font-[Inter,sans-serif] text-[13px] text-[#6c7275]">
      <BreadcrumbSegment label={folderName} targetId="root" onNavigate={onNavigate} />
      {path.map((segment) => (
        <span key={segment.id} className="flex items-center gap-1">
          <ChevronRight className="size-[14px]" />
          <BreadcrumbSegment label={segment.name} targetId={`folder:${segment.id}`} onNavigate={onNavigate} />
        </span>
      ))}
    </div>
  )
}
