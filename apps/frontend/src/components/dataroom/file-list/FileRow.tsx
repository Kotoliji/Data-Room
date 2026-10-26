import { Check, Eye, Pencil, Trash2 } from "lucide-react"
import type { UploadedFile } from "@/lib/types"
import { formatSize } from "@/lib/utils"
import { InsightBadges } from "../InsightBadges"
import { RenameForm } from "./RenameForm"
import { getExt, stripExt } from "./names"

export type UploadingFile = { id: string; original_name: string; size: number; status: "uploading" }
export type ListedFile = UploadedFile | UploadingFile

function LoadingDots() {
  return (
    <div className="flex items-center gap-[6px] px-4">
      <span className="size-[8px] animate-[pulse-dot_1.4s_ease-in-out_infinite] rounded-full bg-[#6c7275]" />
      <span className="size-[10px] animate-[pulse-dot_1.4s_ease-in-out_0.2s_infinite] rounded-full bg-[#141718]" />
      <span className="size-[8px] animate-[pulse-dot_1.4s_ease-in-out_0.4s_infinite] rounded-full bg-[#6c7275]" />
    </div>
  )
}

interface FileRowProps {
  file: ListedFile
  snippet?: string
  /** Current text of the rename input, or null when this row is not being renamed */
  renameValue: string | null
  onRenameValueChange: (value: string) => void
  onRenameSubmit: (fullName: string) => void
  onRenameCancel: () => void
  onStartRename: (nameWithoutExt: string) => void
  onOpen: (file: UploadedFile) => void
  onDelete: () => void
}

export function FileRow({
  file, snippet, renameValue, onRenameValueChange, onRenameSubmit, onRenameCancel, onStartRename, onOpen, onDelete,
}: FileRowProps) {
  const uploading = file.status === "uploading"
  // UploadedFile.status is a plain string, so TS cannot narrow the union by itself
  const ready = uploading ? null : (file as UploadedFile)
  const renaming = renameValue !== null

  return (
    <div
      data-file-id={file.id}
      draggable={!uploading}
      onDragStart={(e) => {
        if (uploading) return
        e.dataTransfer.setData("application/x-file-id", String(file.id))
        e.dataTransfer.setData("text/plain", file.original_name)
        e.dataTransfer.effectAllowed = "move"
      }}
      className="flex cursor-grab items-center border-t border-[rgba(108,114,117,0.15)] py-[14px] md:py-[20px] active:cursor-grabbing"
    >
      {renaming ? (
        <RenameForm
          value={renameValue}
          ext={getExt(file.original_name)}
          onChange={onRenameValueChange}
          onSubmit={(name, ext) => onRenameSubmit(name + ext)}
          onCancel={onRenameCancel}
        />
      ) : (
        <span
          className="flex-1 cursor-pointer truncate font-[Inter,sans-serif] text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[var(--dr-main-title)] hover:underline"
          onClick={() => { if (ready) onOpen(ready) }}
        >
          {file.original_name}
        </span>
      )}
      {!renaming && ready && <InsightBadges insight={ready.insight} snippet={snippet} />}

      {!ready ? (
        <LoadingDots />
      ) : !renaming ? (
        <>
          <span className="mx-4 hidden shrink-0 text-[12px] text-[#6c7275] md:block">
            {formatSize(file.size)}
          </span>
          <button
            onClick={() => onOpen(ready)}
            className="hidden shrink-0 rounded-md p-1 text-[#6c7275] transition-colors hover:bg-[#f3f5f7] hover:text-[#2752f4] md:block"
            title="View file"
          >
            <Eye className="size-[18px]" />
          </button>
          <button
            onClick={() => onStartRename(stripExt(file.original_name))}
            className="ml-1 hidden shrink-0 rounded-md p-1 text-[#6c7275] transition-colors hover:bg-[#f3f5f7] hover:text-[#141718] md:block"
            title="Rename"
          >
            <Pencil className="size-[18px]" />
          </button>
          <Check className="ml-1 hidden size-[24px] shrink-0 text-[#2752f4] md:block" />
          <button
            onClick={onDelete}
            className="ml-1 shrink-0 rounded-md p-1 text-[#6c7275] transition-colors hover:bg-[#f3f5f7] hover:text-red-500"
            title="Delete"
          >
            <Trash2 className="size-[18px]" />
          </button>
        </>
      ) : null}
    </div>
  )
}
