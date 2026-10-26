import { Check, X, Folder, ChevronLeft, FolderPlus, Share2 } from "lucide-react"
import { useState } from "react"
import type { UploadedFile, FolderItem } from "@/lib/types"
import { getFileViewUrl } from "@/lib/api"
import { LazyPdfViewer as PdfViewer } from "@/components/viewer/LazyPdfViewer"
import { FileRow, type ListedFile } from "./file-list/FileRow"
import { ConfirmDeleteModal } from "./file-list/ConfirmDeleteModal"
import { SubfolderRow } from "./file-list/SubfolderRow"
import { Breadcrumb } from "./file-list/Breadcrumb"
import { DeleteFolderModal } from "./DeleteFolderModal"
import { triggerTrashAnimation } from "./TrashAnimation"

interface FileListViewProps {
  folderName: string
  files: ListedFile[]
  onImport: () => void
  onShare?: () => void
  onDeleteFile: (fileId: number) => void
  onTrashFile?: (fileId: number) => void
  onRenameFile?: (fileId: number, newName: string) => void
  subfolders?: FolderItem[]
  folderPath?: FolderItem[]
  onNavigateFolder?: (folderId: string) => void
  onNavigateUp?: () => void
  onCreateSubfolder?: (name: string) => void
  onDeleteSubfolder?: (folderId: number) => void
  onRestoreSubfolder?: (folderId: number) => void
  onRenameSubfolder?: (folderId: number, name: string) => void
  onMoveFileToSubfolder?: (fileId: number, folderId: string) => void
  currentFolderId?: string
  /** Content-search snippets keyed by file id */
  snippets?: Record<number, string>
}

export function FileListView({
  folderName, files, onImport, onShare, onDeleteFile, onTrashFile, onRenameFile,
  subfolders = [], folderPath = [],
  onNavigateFolder, onCreateSubfolder, onDeleteSubfolder, onRestoreSubfolder, onRenameSubfolder, onMoveFileToSubfolder,
  currentFolderId, snippets = {},
}: FileListViewProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<FolderItem | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ id: number; name: string } | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null)
  const [dragOverContainer, setDragOverContainer] = useState(false)
  const isTrash = folderName === "Trash"
  const [pdfPreview, setPdfPreview] = useState<{ url: string; name: string } | null>(null)

  // PDFs open in the in-app viewer; other formats keep the browser's native handling
  const openFile = async (file: UploadedFile) => {
    const url = await getFileViewUrl(file.id)
    if (!url) return
    if (file.mime_type === "application/pdf" || file.original_name.toLowerCase().endsWith(".pdf")) {
      setPdfPreview({ url, name: file.original_name })
    } else {
      window.open(url, "_blank")
    }
  }

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
        <div className="flex items-center justify-between gap-3 pr-12 md:pr-0">
          <div className="flex min-w-0 items-center gap-2">
            {hasBreadcrumb && onNavigateFolder && (
              <button
                onClick={() => {
                  if (folderPath.length > 1) {
                    onNavigateFolder(`folder:${folderPath[folderPath.length - 2].id}`)
                  } else {
                    onNavigateFolder("root")
                  }
                }}
                className="flex shrink-0 items-center justify-center rounded-full p-[4px] hover:bg-[var(--dr-card-border)]/30"
              >
                <ChevronLeft size={22} className="text-[var(--dr-main-title)]" />
              </button>
            )}
            <h2 className="truncate font-[Inter,sans-serif] text-[20px] font-bold leading-[32px] tracking-[-0.28px] text-[var(--dr-main-title)] md:text-[28px] md:leading-[40px]">
              {folderName}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onCreateSubfolder && !isTrash && (
              <button
                onClick={() => { setCreatingFolder(true); setNewFolderName("") }}
                className="flex shrink-0 items-center gap-[6px] rounded-[12px] border-2 border-white bg-white px-[8px] py-[6px] font-[Inter,sans-serif] text-[13px] font-semibold text-[#141718] transition-colors hover:bg-[#f3f5f7] md:px-[16px] md:py-[10px] md:text-[14px]"
              >
                <FolderPlus className="size-[16px]" />
                <span className="hidden md:inline">New folder</span>
              </button>
            )}
            {onShare && (
              <button
                onClick={onShare}
                className="flex shrink-0 items-center gap-[6px] rounded-[12px] border-2 border-white bg-white px-[8px] py-[6px] font-[Inter,sans-serif] text-[13px] font-semibold text-[#141718] transition-colors hover:bg-[#f3f5f7] md:px-[16px] md:py-[10px] md:text-[14px]"
              >
                <Share2 className="size-[16px]" />
                <span className="hidden md:inline">Share</span>
              </button>
            )}
            <button
              onClick={onImport}
              className="flex shrink-0 items-center gap-[8px] rounded-[12px] bg-[#141718] px-[10px] py-[8px] font-[Inter,sans-serif] text-[13px] font-semibold text-[#fefefe] transition-colors hover:bg-[#232627] md:px-[24px] md:py-[12px] md:text-[16px]"
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
            onDelete={(id) => {
              const f = subfolders.find((sf) => sf.id === id)
              if (f) setDeleteFolderTarget(f)
            }}
            onRestore={onRestoreSubfolder ? (id) => onRestoreSubfolder(id) : undefined}
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
          <FileRow
            key={file.id}
            file={file}
            snippet={snippets[file.id as number]}
            renameValue={renameTarget?.id === file.id ? renameValue : null}
            onRenameValueChange={setRenameValue}
            onRenameSubmit={(fullName) => { if (renameTarget) onRenameFile?.(renameTarget.id, fullName); setRenameTarget(null) }}
            onRenameCancel={() => setRenameTarget(null)}
            onStartRename={(name) => { setRenameTarget({ id: file.id as number, name: file.original_name }); setRenameValue(name) }}
            onOpen={openFile}
            onDelete={() => setDeleteTarget({ id: file.id as number, name: file.original_name })}
          />
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
              const el = document.querySelector(`[data-file-id="${deleteTarget.id}"]`)
              const rect = el?.getBoundingClientRect()
              onTrashFile?.(deleteTarget.id)
              if (rect) {
                // Element already removed from DOM, animate a ghost from its position
                const ghost = document.createElement("div")
                ghost.style.position = "fixed"
                ghost.style.left = `${rect.left}px`
                ghost.style.top = `${rect.top}px`
                ghost.style.width = `${rect.width}px`
                ghost.style.height = `${rect.height}px`
                ghost.style.pointerEvents = "none"
                document.body.appendChild(ghost)
                triggerTrashAnimation(ghost, "file")
                setTimeout(() => ghost.remove(), 900)
              }
            }
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteFolderTarget && (
        <DeleteFolderModal
          folder={deleteFolderTarget}
          onConfirm={() => {
            if (!isTrash) {
              const el = document.querySelector(`[data-folder-id="${deleteFolderTarget.id}"]`)
              const rect = el?.getBoundingClientRect()
              onDeleteSubfolder?.(deleteFolderTarget.id)
              if (rect) {
                const ghost = document.createElement("div")
                ghost.style.position = "fixed"
                ghost.style.left = `${rect.left}px`
                ghost.style.top = `${rect.top}px`
                ghost.style.width = `${rect.width}px`
                ghost.style.height = `${rect.height}px`
                ghost.style.pointerEvents = "none"
                document.body.appendChild(ghost)
                triggerTrashAnimation(ghost, "folder")
                setTimeout(() => ghost.remove(), 900)
              }
            } else {
              onDeleteSubfolder?.(deleteFolderTarget.id)
            }
            setDeleteFolderTarget(null)
          }}
          onCancel={() => setDeleteFolderTarget(null)}
        />
      )}

      {pdfPreview && <PdfViewer url={pdfPreview.url} title={pdfPreview.name} onClose={() => setPdfPreview(null)} />}
    </div>
  )
}
