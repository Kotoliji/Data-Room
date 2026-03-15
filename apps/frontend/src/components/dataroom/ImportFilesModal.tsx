import { X, Upload, HardDrive, ChevronLeft, ChevronRight, Search, Check, Loader2, AlertCircle, Folder } from "lucide-react"
import { useState, useRef, useEffect, useCallback } from "react"
import type { DriveFile } from "@/lib/types"
import { getDriveFiles, getGoogleConnectUrl, getGoogleDriveStatus } from "@/lib/api"
import { formatSize } from "@/lib/utils"

const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_FILES = 20
const FOLDER_MIME = "application/vnd.google-apps.folder"

interface ImportFilesModalProps {
  isOpen: boolean
  onClose: () => void
  onApply?: (files: File[], folderId?: string) => void
  onImportDrive?: (files: DriveFile[], folderId?: string) => void
  folderId?: string
}

type ModalView = "main" | "drive"
type FolderEntry = { id: string; name: string }

export function ImportFilesModal({ isOpen, onClose, onApply, onImportDrive, folderId: rawFolderId }: ImportFilesModalProps) {
  // Normalize "All documents" to "all" for the backend
  const folderId = rawFolderId === "All documents" ? "all" : rawFolderId
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Drive state
  const [view, setView] = useState<ModalView>("main")
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null)
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState("")
  const [driveSearch, setDriveSearch] = useState("")
  const [driveNextPage, setDriveNextPage] = useState<string | null>(null)
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<Map<string, DriveFile>>(new Map())

  // Folder navigation
  const [folderStack, setFolderStack] = useState<FolderEntry[]>([])
  const currentParentId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : undefined

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setFiles([])
      setError("")
      setView("main")
      setDriveFiles([])
      setDriveError("")
      setDriveSearch("")
      setDriveNextPage(null)
      setSelectedDriveFiles(new Map())
      setDriveConnected(null)
      setFolderStack([])
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen])

  const fetchDriveFiles = useCallback(async (pageToken?: string, query?: string, parentId?: string) => {
    setDriveLoading(true)
    setDriveError("")
    const res = await getDriveFiles(pageToken, query, parentId)
    setDriveLoading(false)
    if (res.error) {
      setDriveError(res.error)
      return
    }
    if (res.data) {
      if (pageToken) {
        setDriveFiles((prev) => [...prev, ...res.data!.files])
      } else {
        setDriveFiles(res.data.files)
      }
      setDriveNextPage(res.data.next_page_token)
    }
  }, [])

  const handleDriveClick = async () => {
    setView("drive")
    if (driveConnected === null) {
      setDriveLoading(true)
      const connected = await getGoogleDriveStatus()
      setDriveConnected(connected)
      setDriveLoading(false)
      if (connected) {
        fetchDriveFiles()
      }
    } else if (driveConnected) {
      fetchDriveFiles()
    }
  }

  const handleConnectDrive = async () => {
    const url = await getGoogleConnectUrl()
    if (url) {
      window.location.href = url
    } else {
      setDriveError("Failed to connect to Google Drive. Please try again.")
    }
  }

  const handleDriveSearch = () => {
    setDriveFiles([])
    setDriveNextPage(null)
    setFolderStack([])
    fetchDriveFiles(undefined, driveSearch.trim() || undefined)
  }

  const navigateToFolder = (folder: DriveFile) => {
    setDriveFiles([])
    setDriveNextPage(null)
    setDriveSearch("")
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }])
    fetchDriveFiles(undefined, undefined, folder.id)
  }

  const navigateBack = () => {
    if (folderStack.length === 0) return
    const newStack = folderStack.slice(0, -1)
    setFolderStack(newStack)
    setDriveFiles([])
    setDriveNextPage(null)
    const parentId = newStack.length > 0 ? newStack[newStack.length - 1].id : undefined
    fetchDriveFiles(undefined, undefined, parentId)
  }

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      // Root
      setFolderStack([])
      setDriveFiles([])
      setDriveNextPage(null)
      fetchDriveFiles()
      return
    }
    const newStack = folderStack.slice(0, index + 1)
    setFolderStack(newStack)
    setDriveFiles([])
    setDriveNextPage(null)
    fetchDriveFiles(undefined, undefined, newStack[newStack.length - 1].id)
  }

  const toggleDriveFile = (file: DriveFile) => {
    setSelectedDriveFiles((prev) => {
      const next = new Map(prev)
      if (next.has(file.id)) {
        next.delete(file.id)
      } else {
        if (next.size >= MAX_FILES) return prev
        next.set(file.id, file)
      }
      return next
    })
  }

  const handleDriveImport = () => {
    if (selectedDriveFiles.size === 0) return
    onImportDrive?.(Array.from(selectedDriveFiles.values()), folderId)
    onClose()
  }

  if (!isOpen) return null

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return
    setError("")
    const arr = Array.from(newFiles)

    const total = files.length + arr.length
    if (total > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files per upload`)
      return
    }

    const oversized = arr.find((f) => f.size > MAX_FILE_SIZE)
    if (oversized) {
      setError(`"${oversized.name}" exceeds 50MB limit`)
      return
    }

    setFiles((prev) => [...prev, ...arr])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleApply = () => {
    if (files.length === 0) return
    onApply?.(files, folderId)
    onClose()
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  // Separate folders and files
  const driveFolders = driveFiles.filter((f) => f.mimeType === FOLDER_MIME)
  const driveNonFolders = driveFiles.filter((f) => f.mimeType !== FOLDER_MIME)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,23,24,0.75)]"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex w-full max-w-[640px] max-h-[80vh] flex-col gap-[24px] rounded-[20px] bg-[#fefefe] p-[24px] font-[Inter,sans-serif] md:gap-[32px] md:rounded-[24px] md:p-[48px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-[24px] top-[24px] flex items-center justify-center rounded-full bg-[#f3f5f7] p-[8px]"
        >
          <X size={24} className="text-[#141718]" />
        </button>

        {view === "main" ? (
          <>
            <h2 className="text-[20px] font-bold leading-[32px] tracking-[-0.28px] text-[#141718] md:text-[28px] md:leading-[40px]">
              Import Files
            </h2>

            <div className="flex flex-col gap-[8px]">
              <label className="text-[14px] font-semibold text-[#232627]">Upload your file</label>

              <div className="flex flex-col gap-[8px]">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-[12px] rounded-[12px] border border-[#e8ecef] p-[20px] transition-colors hover:bg-[#f3f5f7]"
                >
                  <Upload size={20} className="shrink-0 text-[rgba(108,114,117,0.5)]" />
                  <span className="text-[14px] leading-[20px] text-[rgba(108,114,117,0.5)]">
                    Upload from your computer
                  </span>
                </button>

                <button
                  onClick={handleDriveClick}
                  className="flex items-center gap-[12px] rounded-[12px] border border-[#e8ecef] p-[20px] transition-colors hover:bg-[#f3f5f7]"
                >
                  <HardDrive size={20} className="shrink-0 text-[rgba(108,114,117,0.5)]" />
                  <span className="text-[14px] leading-[20px] text-[rgba(108,114,117,0.5)]">
                    Upload from Google Drive
                  </span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ""
                }}
                className="hidden"
              />

              {error && (
                <p className="text-[13px] font-medium text-red-500">{error}</p>
              )}

              {files.length > 0 && (
                <div className="flex max-h-[200px] flex-col gap-[4px] overflow-y-auto pt-[4px]">
                  {files.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-[8px] rounded-[8px] bg-[#f3f5f7] px-[12px] py-[8px]"
                    >
                      <span className="flex-1 truncate text-[13px] text-[#232627]">{file.name}</span>
                      <span className="shrink-0 text-[12px] text-[#6c7275]">
                        {formatSize(file.size)}
                      </span>
                      <button
                        onClick={() => removeFile(i)}
                        className="shrink-0 text-[#6c7275] hover:text-[#141718]"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-[12px]">
              <button
                onClick={onClose}
                className="rounded-[12px] border-2 border-[#e8ecef] px-[24px] py-[12px] text-[16px] font-semibold text-[#141718] transition-colors hover:bg-[#f3f5f7]"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={files.length === 0}
                className="rounded-[12px] bg-[#2752f4] px-[24px] py-[12px] text-[16px] font-semibold text-[#fefefe] transition-colors hover:bg-[#1e42d4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </>
        ) : (
          /* Google Drive view */
          <>
            <div className="flex items-center gap-[12px]">
              <button
                onClick={folderStack.length > 0 ? navigateBack : () => setView("main")}
                className="flex items-center justify-center rounded-full p-[4px] hover:bg-[#f3f5f7]"
              >
                <ChevronLeft size={20} className="text-[#141718]" />
              </button>
              <h2 className="text-[20px] font-bold leading-[32px] tracking-[-0.28px] text-[#141718] md:text-[28px] md:leading-[40px]">
                Google Drive
              </h2>
            </div>

            {driveLoading && driveConnected === null ? (
              /* Checking connection status */
              <div className="flex flex-col items-center gap-[16px] py-[32px]">
                <Loader2 size={32} className="animate-spin text-[#6c7275]" />
                <p className="text-center text-[14px] text-[#6c7275]">Checking Google Drive connection...</p>
              </div>
            ) : driveConnected === false ? (
              /* Not connected — show connect button */
              <div className="flex flex-col items-center gap-[16px] py-[32px]">
                <HardDrive size={48} className="text-[#6c7275]" />
                <p className="text-center text-[14px] text-[#6c7275]">
                  Connect your Google Drive to import files
                </p>
                <button
                  onClick={handleConnectDrive}
                  className="rounded-[12px] bg-[#2752f4] px-[24px] py-[12px] text-[16px] font-semibold text-[#fefefe] transition-colors hover:bg-[#1e42d4]"
                >
                  Connect Google Drive
                </button>
              </div>
            ) : (
              /* Connected — show file list */
              <>
                {/* Search */}
                <div className="flex gap-[8px]">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#6c7275]" />
                    <input
                      type="text"
                      placeholder="Search files..."
                      value={driveSearch}
                      onChange={(e) => setDriveSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleDriveSearch()
                      }}
                      className="w-full rounded-[10px] border border-[#e8ecef] py-[10px] pl-[36px] pr-[12px] text-[14px] text-[#141718] outline-none placeholder:text-[#6c7275] focus:border-[#2752f4]"
                    />
                  </div>
                  <button
                    onClick={handleDriveSearch}
                    className="shrink-0 rounded-[10px] bg-[#f3f5f7] px-[16px] py-[10px] text-[14px] font-medium text-[#141718] hover:bg-[#e8ecef]"
                  >
                    Search
                  </button>
                </div>

                {/* Breadcrumb */}
                {folderStack.length > 0 && (
                  <div className="flex items-center gap-[4px] overflow-x-auto text-[13px]">
                    <button
                      onClick={() => navigateToBreadcrumb(-1)}
                      className="shrink-0 font-medium text-[#2752f4] hover:underline"
                    >
                      My Drive
                    </button>
                    {folderStack.map((folder, i) => (
                      <span key={folder.id} className="flex items-center gap-[4px]">
                        <ChevronRight size={14} className="shrink-0 text-[#6c7275]" />
                        {i === folderStack.length - 1 ? (
                          <span className="shrink-0 font-medium text-[#141718]">{folder.name}</span>
                        ) : (
                          <button
                            onClick={() => navigateToBreadcrumb(i)}
                            className="shrink-0 font-medium text-[#2752f4] hover:underline"
                          >
                            {folder.name}
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {driveError && (
                  <div className="flex items-center gap-[8px] rounded-[8px] bg-red-50 px-[12px] py-[8px]">
                    <AlertCircle size={16} className="shrink-0 text-red-500" />
                    <p className="text-[13px] text-red-600">{driveError}</p>
                  </div>
                )}

                <div className="flex max-h-[320px] flex-col gap-[2px] overflow-y-auto">
                  {/* Folders first */}
                  {driveFolders.map((df) => (
                    <button
                      key={df.id}
                      onClick={() => navigateToFolder(df)}
                      className="flex items-center gap-[12px] rounded-[8px] px-[12px] py-[10px] text-left transition-colors hover:bg-[#f3f5f7]"
                    >
                      <Folder size={20} className="shrink-0 text-[#6c7275]" />
                      <span className="flex-1 truncate text-[13px] font-medium text-[#141718]">{df.name}</span>
                      <ChevronRight size={16} className="shrink-0 text-[#6c7275]" />
                    </button>
                  ))}

                  {/* Separator if both folders and files exist */}
                  {driveFolders.length > 0 && driveNonFolders.length > 0 && (
                    <div className="my-[4px] border-t border-[#e8ecef]" />
                  )}

                  {/* Files */}
                  {driveNonFolders.map((df) => {
                    const isSelected = selectedDriveFiles.has(df.id)
                    return (
                      <button
                        key={df.id}
                        onClick={() => toggleDriveFile(df)}
                        className={`flex items-center gap-[12px] rounded-[8px] px-[12px] py-[10px] text-left transition-colors ${
                          isSelected ? "bg-[#eef1fd]" : "hover:bg-[#f3f5f7]"
                        }`}
                      >
                        <div
                          className={`flex size-[20px] shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors ${
                            isSelected
                              ? "border-[#2752f4] bg-[#2752f4]"
                              : "border-[#d0d5dd]"
                          }`}
                        >
                          {isSelected && <Check size={14} className="text-white" />}
                        </div>

                        {df.iconLink && (
                          <img src={df.iconLink} alt="" className="size-[20px] shrink-0" />
                        )}

                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[13px] font-medium text-[#141718]">{df.name}</span>
                          <span className="text-[11px] text-[#6c7275]">
                            {formatDate(df.modifiedTime)}
                            {df.size ? ` · ${formatSize(Number(df.size))}` : ""}
                          </span>
                        </div>
                      </button>
                    )
                  })}

                  {driveLoading && (
                    <div className="flex items-center justify-center py-[24px]">
                      <Loader2 size={24} className="animate-spin text-[#6c7275]" />
                    </div>
                  )}

                  {!driveLoading && driveFiles.length === 0 && !driveError && (
                    <p className="py-[24px] text-center text-[14px] text-[#6c7275]">
                      {folderStack.length > 0 ? "This folder is empty" : "No files found"}
                    </p>
                  )}

                  {driveNextPage && !driveLoading && (
                    <button
                      onClick={() => fetchDriveFiles(driveNextPage, driveSearch.trim() || undefined, currentParentId)}
                      className="mt-[8px] self-center rounded-[8px] px-[16px] py-[8px] text-[13px] font-medium text-[#2752f4] hover:bg-[#f3f5f7]"
                    >
                      Load more
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#6c7275]">
                    {selectedDriveFiles.size > 0
                      ? `${selectedDriveFiles.size} file${selectedDriveFiles.size > 1 ? "s" : ""} selected`
                      : "Select files to import"}
                  </span>
                  <div className="flex gap-[12px]">
                    <button
                      onClick={() => setView("main")}
                      className="rounded-[12px] border-2 border-[#e8ecef] px-[24px] py-[12px] text-[16px] font-semibold text-[#141718] transition-colors hover:bg-[#f3f5f7]"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleDriveImport}
                      disabled={selectedDriveFiles.size === 0}
                      className="rounded-[12px] bg-[#2752f4] px-[24px] py-[12px] text-[16px] font-semibold text-[#fefefe] transition-colors hover:bg-[#1e42d4] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Import
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
