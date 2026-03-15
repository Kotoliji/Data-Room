import { Check, Trash2, X, Pencil, Eye, Folder, ChevronRight, ChevronLeft, FolderPlus } from "lucide-react"
import { useState, useRef, useCallback } from "react"
import type { UploadedFile, FolderItem } from "@/lib/types"
import { getFileViewUrl } from "@/lib/api"
import { formatSize } from "@/lib/utils"

interface FileListViewProps {
  folderName: string
  files: (UploadedFile | { id: string; original_name: string; size: number; status: "uploading" })[]
  onImport: () => void
  onDeleteFile: (fileId: number) => void
  onTrashFile?: (fileId: number) => void
  onRenameFile?: (fileId: number, newName: string) => void
  subfolders?: FolderItem[]
  folderPath?: FolderItem[]
  onNavigateFolder?: (folderId: string) => void
  onNavigateUp?: () => void
  onCreateSubfolder?: (name: string) => void
  onDeleteSubfolder?: (folderId: number) => void
  onRenameSubfolder?: (folderId: number, name: string) => void
  onMoveFileToSubfolder?: (fileId: number, folderId: string) => void
  currentFolderId?: string
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-[6px] px-4">
      <span className="size-[8px] animate-[pulse-dot_1.4s_ease-in-out_infinite] rounded-full bg-[#6c7275]" />
      <span className="size-[10px] animate-[pulse-dot_1.4s_ease-in-out_0.2s_infinite] rounded-full bg-[#141718]" />
      <span className="size-[8px] animate-[pulse-dot_1.4s_ease-in-out_0.4s_infinite] rounded-full bg-[#6c7275]" />
    </div>
  )
}

function getExt(name: string): string {
  const d = name.lastIndexOf(".")
  return d > 0 ? name.slice(d) : ""
}

function stripExt(name: string): string {
  const d = name.lastIndexOf(".")
  return d > 0 ? name.slice(0, d) : name
}

function RenameForm({ value, ext, onChange, onSubmit, onCancel }: {
  value: string; ext: string
  onChange: (v: string) => void
  onSubmit: (name: string, ext: string) => void
  onCancel: () => void
}) {
  return (
    <form
      className="flex flex-1 items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim(), ext) }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel() }}
        className="flex-1 rounded-lg border border-[#2752f4] bg-transparent px-2 py-1 font-[Inter,sans-serif] text-[14px] font-semibold text-[var(--dr-main-title)] outline-none"
      />
      {ext && <span className="shrink-0 text-[14px] font-semibold text-[#6c7275]">{ext}</span>}
      <button type="submit" className="rounded-md p-1 text-[#2752f4] hover:bg-[#f3f5f7]">
        <Check className="size-[18px]" />
      </button>
      <button type="button" onClick={onCancel} className="rounded-md p-1 text-[#6c7275] hover:bg-[#f3f5f7]">
        <X className="size-[18px]" />
      </button>
    </form>
  )
}

function ConfirmDeleteModal({ fileName, permanent, onConfirm, onCancel }: { fileName: string; permanent: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,23,24,0.75)]" onClick={onCancel}>
      <div
        className="relative mx-4 flex w-full max-w-[420px] flex-col gap-[24px] rounded-[24px] bg-[#fefefe] p-[24px] font-[Inter,sans-serif] md:p-[32px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onCancel} className="absolute right-[16px] top-[16px] rounded-full bg-[#f3f5f7] p-[6px]">
          <X size={18} className="text-[#141718]" />
        </button>

        <div className="flex flex-col gap-[8px]">
          <h3 className="text-[18px] font-bold leading-[28px] text-[#141718]">
            {permanent ? "Delete permanently?" : "Move to Trash?"}
          </h3>
          <p className="text-[14px] leading-[20px] text-[#6c7275]">
            <span className="font-semibold text-[#141718]">{fileName}</span>
            {permanent
              ? " will be permanently deleted. This action cannot be undone."
              : " will be moved to Trash. You can restore it later."}
          </p>
        </div>

        <div className="flex justify-end gap-[12px]">
          <button
            onClick={onCancel}
            className="rounded-[12px] border-2 border-[#e8ecef] px-[20px] py-[10px] text-[14px] font-semibold text-[#141718] transition-colors hover:bg-[#f3f5f7]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-[12px] bg-red-500 px-[20px] py-[10px] text-[14px] font-semibold text-white transition-colors hover:bg-red-600"
          >
            {permanent ? "Delete" : "Move to Trash"}
          </button>
        </div>
      </div>
    </div>
  )
}

function SubfolderRow({ folder, onNavigate, onDelete, onRename, onDrop, dragOverId, setDragOverId }: {
  folder: FolderItem
  onNavigate: (id: string) => void
  onDelete?: (id: number) => void
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

function Breadcrumb({ folderName, path, onNavigate }: {
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

export function FileListView({
  folderName, files, onImport, onDeleteFile, onTrashFile, onRenameFile,
  subfolders = [], folderPath = [],
  onNavigateFolder, onCreateSubfolder, onDeleteSubfolder, onRenameSubfolder, onMoveFileToSubfolder,
  currentFolderId,
}: FileListViewProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ id: number; name: string } | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null)
  const [dragOverContainer, setDragOverContainer] = useState(false)
  const isTrash = folderName === "Trash"

  const hasSubfolders = subfolders.length > 0
  const hasFiles = files.length > 0
  const hasBreadcrumb = folderPath.length > 0

  return (
    <div
      className={`flex flex-1 min-h-0 flex-col gap-[20px] items-center justify-start overflow-y-auto px-4 pt-[24px] pb-[100px] md:gap-[32px] md:px-[39px] md:pt-[40px] md:pb-[80px] transition-colors ${dragOverContainer ? "bg-[var(--dr-card-border)]/10" : ""}`}
      onDragOver={(e) => {
        if (currentFolderId && e.dataTransfer.types.includes("application/x-file-id")) {
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
          setDragOverContainer(true)
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOverContainer(false)
      }}
      onDrop={(e) => {
        setDragOverContainer(false)
        if (!currentFolderId) return
        const fileId = e.dataTransfer.getData("application/x-file-id")
        if (fileId && onMoveFileToSubfolder) {
          e.preventDefault()
          onMoveFileToSubfolder(Number(fileId), currentFolderId)
        }
      }}
    >
      <div className="flex w-full max-w-[984px] flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {hasBreadcrumb && onNavigateFolder && (
              <button
                onClick={() => {
                  if (folderPath.length > 1) {
                    onNavigateFolder(`folder:${folderPath[folderPath.length - 2].id}`)
                  } else {
                    onNavigateFolder("root")
                  }
                }}
                className="flex items-center justify-center rounded-full p-[4px] hover:bg-[var(--dr-card-border)]/30"
              >
                <ChevronLeft size={22} className="text-[var(--dr-main-title)]" />
              </button>
            )}
            <h2 className="font-[Inter,sans-serif] text-[20px] font-bold leading-[32px] tracking-[-0.28px] text-[var(--dr-main-title)] md:text-[28px] md:leading-[40px]">
              {folderName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onCreateSubfolder && !isTrash && (
              <button
                onClick={() => { setCreatingFolder(true); setNewFolderName("") }}
                className="flex shrink-0 items-center gap-[6px] rounded-[12px] border-2 border-[#e8ecef] px-[12px] py-[8px] font-[Inter,sans-serif] text-[13px] font-semibold text-[#141718] transition-colors hover:bg-[#f3f5f7] md:px-[16px] md:py-[10px] md:text-[14px]"
              >
                <FolderPlus className="size-[16px]" />
                <span className="hidden md:inline">New folder</span>
              </button>
            )}
            <button
              onClick={onImport}
              className="flex shrink-0 items-center gap-[8px] rounded-[12px] bg-[#141718] px-[16px] py-[10px] font-[Inter,sans-serif] text-[14px] font-semibold text-[#fefefe] transition-colors hover:bg-[#232627] md:px-[24px] md:py-[12px] md:text-[16px]"
            >
              Import
            </button>
          </div>
        </div>

        {hasBreadcrumb && onNavigateFolder && (
          <Breadcrumb folderName={folderName} path={folderPath} onNavigate={onNavigateFolder} />
        )}
      </div>

      <div className="flex w-full max-w-[984px] flex-col">
        {creatingFolder && (
          <div className="flex items-center border-t border-[rgba(108,114,117,0.15)] py-[14px] md:py-[20px]">
            <Folder className="mr-3 size-[20px] shrink-0 text-[#3e90f0]" />
            <form
              className="flex flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (newFolderName.trim()) {
                  onCreateSubfolder?.(newFolderName.trim())
                  setCreatingFolder(false)
                  setNewFolderName("")
                }
              }}
            >
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setCreatingFolder(false) }}
                placeholder="Folder name"
                className="flex-1 rounded-lg border border-[#2752f4] bg-transparent px-2 py-1 font-[Inter,sans-serif] text-[14px] font-semibold text-[var(--dr-main-title)] outline-none placeholder:font-normal placeholder:text-[#a0a4a8]"
              />
              <button type="submit" className="rounded-md p-1 text-[#2752f4] hover:bg-[#f3f5f7]">
                <Check className="size-[18px]" />
              </button>
              <button type="button" onClick={() => setCreatingFolder(false)} className="rounded-md p-1 text-[#6c7275] hover:bg-[#f3f5f7]">
                <X className="size-[18px]" />
              </button>
            </form>
          </div>
        )}

        {subfolders.map((folder) => (
          <SubfolderRow
            key={folder.id}
            folder={folder}
            onNavigate={(id) => onNavigateFolder?.(id)}
            onDelete={onDeleteSubfolder}
            onRename={onRenameSubfolder}
            onDrop={onMoveFileToSubfolder}
            dragOverId={dragOverFolderId}
            setDragOverId={setDragOverFolderId}
          />
        ))}

        {hasSubfolders && hasFiles && (
          <div className="my-1 border-t-2 border-[rgba(108,114,117,0.1)]" />
        )}

        {!hasSubfolders && !hasFiles && !creatingFolder && (
          <div className="flex flex-col items-center gap-3 py-[40px]">
            <p className="font-[Inter,sans-serif] text-[15px] text-[var(--dr-main-subtitle)]">
              This folder is empty
            </p>
            {hasBreadcrumb && onNavigateFolder && (
              <button
                onClick={() => onNavigateFolder("root")}
                className="rounded-[10px] border border-[var(--dr-card-border)] px-4 py-2 font-[Inter,sans-serif] text-[13px] font-semibold text-[var(--dr-main-subtitle)] transition-colors hover:bg-[var(--dr-card-border)]/20"
              >
                Go back
              </button>
            )}
          </div>
        )}

        {files.map((file) => (
          <div
            key={file.id}
            draggable={file.status !== "uploading"}
            onDragStart={(e) => {
              if (file.status === "uploading") return
              e.dataTransfer.setData("application/x-file-id", String(file.id))
              e.dataTransfer.setData("text/plain", file.original_name)
              e.dataTransfer.effectAllowed = "move"
            }}
            className="flex cursor-grab items-center border-t border-[rgba(108,114,117,0.15)] py-[14px] md:py-[20px] active:cursor-grabbing"
          >
            {renameTarget?.id === file.id ? (
              <RenameForm
                value={renameValue}
                ext={getExt(renameTarget.name)}
                onChange={setRenameValue}
                onSubmit={(name, ext) => { onRenameFile?.(renameTarget.id, name + ext); setRenameTarget(null) }}
                onCancel={() => setRenameTarget(null)}
              />
            ) : (
              <span
                className="flex-1 cursor-pointer truncate font-[Inter,sans-serif] text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[var(--dr-main-title)] hover:underline"
                onClick={async () => {
                  if (file.status !== "uploading") {
                    const url = await getFileViewUrl(file.id as number)
                    if (url) window.open(url, "_blank")
                  }
                }}
              >
                {file.original_name}
              </span>
            )}

            {file.status === "uploading" ? (
              <LoadingDots />
            ) : renameTarget?.id !== file.id ? (
              <>
                <span className="mx-4 hidden shrink-0 text-[12px] text-[#6c7275] md:block">
                  {formatSize(file.size)}
                </span>
                <button
                  onClick={async () => { const url = await getFileViewUrl(file.id as number); if (url) window.open(url, "_blank") }}
                  className="hidden shrink-0 rounded-md p-1 text-[#6c7275] transition-colors hover:bg-[#f3f5f7] hover:text-[#2752f4] md:block"
                  title="View file"
                >
                  <Eye className="size-[18px]" />
                </button>
                <button
                  onClick={() => { setRenameTarget({ id: file.id as number, name: file.original_name }); setRenameValue(stripExt(file.original_name)) }}
                  className="ml-1 hidden shrink-0 rounded-md p-1 text-[#6c7275] transition-colors hover:bg-[#f3f5f7] hover:text-[#141718] md:block"
                  title="Rename"
                >
                  <Pencil className="size-[18px]" />
                </button>
                <Check className="ml-1 hidden size-[24px] shrink-0 text-[#2752f4] md:block" />
                <button
                  onClick={() => setDeleteTarget({ id: file.id as number, name: file.original_name })}
                  className="ml-1 shrink-0 rounded-md p-1 text-[#6c7275] transition-colors hover:bg-[#f3f5f7] hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 className="size-[18px]" />
                </button>
              </>
            ) : null}
          </div>
        ))}
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          fileName={deleteTarget.name}
          permanent={isTrash}
          onConfirm={() => {
            if (isTrash) {
              onDeleteFile(deleteTarget.id)
            } else {
              onTrashFile?.(deleteTarget.id)
            }
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
