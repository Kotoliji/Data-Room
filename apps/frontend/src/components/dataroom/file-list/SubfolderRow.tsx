import { Check, Trash2, X, Pencil, Folder, ChevronRight, RotateCcw } from "lucide-react"
import { useState, useRef, useCallback } from "react"
import type { FolderItem } from "@/lib/types"

export function SubfolderRow({ folder, onNavigate, onDelete, onRestore, onRename, onDrop, dragOverId, setDragOverId }: {
  folder: FolderItem
  onNavigate: (id: string) => void
  onDelete?: (id: number) => void
  onRestore?: (id: number) => void
  onRename?: (id: number, name: string) => void
  onDrop?: (fileId: number, folderId: string) => void
  dragOverId: number | null
  setDragOverId: (id: number | null) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [renamingValue, setRenamingValue] = useState(folder.name)
  const isDragOver = dragOverId === folder.id
  const dragTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const clearDragTimer = useCallback(() => {
    if (dragTimerRef.current) { clearTimeout(dragTimerRef.current); dragTimerRef.current = null }
  }, [])

  return (
    <div
      data-folder-id={folder.id}
      className={`flex cursor-pointer items-center border-t border-[rgba(108,114,117,0.15)] py-[14px] transition-colors md:py-[20px] ${isDragOver ? "bg-[var(--dr-card-border)]/40" : "hover:bg-[var(--dr-card-border)]/20"}`}
      onClick={() => onNavigate(`folder:${folder.id}`)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-folder-id", String(folder.id))
        e.dataTransfer.effectAllowed = "move"
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = "move"
        setDragOverId(folder.id)
        // Auto-open folder after 800ms hover
        if (!dragTimerRef.current) {
          dragTimerRef.current = setTimeout(() => {
            onNavigate(`folder:${folder.id}`)
            dragTimerRef.current = null
          }, 800)
        }
      }}
      onDragLeave={(e) => {
        e.stopPropagation()
        setDragOverId(null)
        clearDragTimer()
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOverId(null)
        clearDragTimer()
        const fileId = e.dataTransfer.getData("application/x-file-id")
        if (fileId && onDrop) {
          onDrop(Number(fileId), `folder:${folder.id}`)
        }
      }}
    >
      <Folder className="mr-3 size-[20px] shrink-0" style={{ color: folder.color || "#3e90f0" }} />
      {renaming ? (
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (renamingValue.trim()) {
              onRename?.(folder.id, renamingValue.trim())
              setRenaming(false)
            }
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            value={renamingValue}
            onChange={(e) => setRenamingValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setRenaming(false) }}
            className="flex-1 rounded-lg border border-[#2752f4] bg-transparent px-2 py-1 font-[Inter,sans-serif] text-[14px] font-semibold text-[var(--dr-main-title)] outline-none"
          />
          <button type="submit" className="rounded-md p-1 text-[#2752f4] hover:bg-[var(--dr-card-border)]/30">
            <Check className="size-[18px]" />
          </button>
          <button type="button" onClick={() => setRenaming(false)} className="rounded-md p-1 text-[#6c7275] hover:bg-[var(--dr-card-border)]/30">
            <X className="size-[18px]" />
          </button>
        </form>
      ) : (
        <span className="flex-1 truncate font-[Inter,sans-serif] text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[var(--dr-main-title)]">
          {folder.name}
        </span>
      )}
      {!renaming && onRename && (
        <button
          onClick={(e) => { e.stopPropagation(); setRenamingValue(folder.name); setRenaming(true) }}
          className="ml-1 shrink-0 rounded-md p-1 text-[#6c7275] transition-colors hover:bg-[var(--dr-card-border)]/30 hover:text-[var(--dr-main-title)]"
          title="Rename folder"
        >
          <Pencil className="size-[18px]" />
        </button>
      )}
      {!renaming && onRestore && (
        <button
          onClick={(e) => { e.stopPropagation(); onRestore(folder.id) }}
          className="ml-1 shrink-0 rounded-md p-1 text-[#6c7275] transition-colors hover:bg-[var(--dr-card-border)]/30 hover:text-green-500"
          title="Restore folder"
        >
          <RotateCcw className="size-[18px]" />
        </button>
      )}
      {!renaming && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(folder.id) }}
          className="ml-1 shrink-0 rounded-md p-1 text-[#6c7275] transition-colors hover:bg-[var(--dr-card-border)]/30 hover:text-red-500"
          title="Delete folder"
        >
          <Trash2 className="size-[18px]" />
        </button>
      )}
      {!renaming && <ChevronRight className="ml-1 size-[18px] shrink-0 text-[#6c7275]" />}
    </div>
  )
}
