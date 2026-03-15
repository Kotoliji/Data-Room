import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Menu, X, AlertTriangle } from "lucide-react"
import { Sidebar } from "./Sidebar"
import { WelcomeScreen } from "./WelcomeScreen"
import { FileListView } from "./FileListView"
import { ActivityView } from "./ActivityView"
import type { UploadedFile, FolderItem } from "@/lib/types"
import { SearchBar } from "./SearchBar"
import { ImportFilesModal } from "./ImportFilesModal"
import { getFiles, deleteFile, uploadFiles, moveFile, renameFile, importDriveFiles, getFolders, getAllFolders, createFolder, deleteFolder as apiDeleteFolder, getFolderPath, updateFolder } from "@/lib/api"
import type { DriveFile } from "@/lib/types"

const TOAST_DURATION_MS = 5000

type UploadingFile = { id: string; original_name: string; size: number; status: "uploading" }

export function Layout() {
  const [search, setSearch] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [activeFolder, setActiveFolder] = useState("All documents")
  const [activeTab, setActiveTab] = useState("Data Room")
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const [subfolders, setSubfolders] = useState<FolderItem[]>([])
  const [allUserFolders, setAllUserFolders] = useState<FolderItem[]>([])
  const [folderPath, setFolderPath] = useState<FolderItem[]>([])
  const [currentSubfolder, setCurrentSubfolder] = useState<number | null>(null)
  const [activeFolderName, setActiveFolderName] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }, [])

  const isLoggedIn = !!localStorage.getItem("user")

  const fetchFiles = useCallback(async () => {
    if (!isLoggedIn) return
    const res = await getFiles()
    if (res.data) setUploadedFiles(res.data.files)
  }, [isLoggedIn])

  const fetchAllFolders = useCallback(async () => {
    if (!isLoggedIn) return
    const res = await getAllFolders()
    if (res.data) setAllUserFolders(res.data.folders)
  }, [isLoggedIn])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFiles()
    fetchAllFolders()
  }, [fetchFiles, fetchAllFolders])

  // Parse the numeric folder id from activeFolder (e.g. "folder:5" -> 5)
  const activeFolderNumericId = useMemo(() => {
    if (activeFolder.startsWith("folder:")) {
      return Number(activeFolder.split(":")[1])
    }
    return null
  }, [activeFolder])

  // The deepest folder we're viewing: either a subfolder inside content, or the sidebar folder
  const deepestFolderId = currentSubfolder ?? activeFolderNumericId

  const loadSubfolders = useCallback(async () => {
    if (!isLoggedIn) return
    if (deepestFolderId != null) {
      const res = await getFolders(deepestFolderId)
      if (res.data) setSubfolders(res.data.folders)
    } else if (activeFolder === "All documents") {
      // "All documents" shows root-level folders
      const res = await getFolders()
      if (res.data) setSubfolders(res.data.folders)
    } else {
      setSubfolders([])
    }
  }, [isLoggedIn, deepestFolderId, activeFolder])

  const loadBreadcrumb = useCallback(async () => {
    if (!isLoggedIn) return
    if (currentSubfolder != null) {
      const res = await getFolderPath(currentSubfolder)
      if (res.data) {
        // Filter path to only show items below the top-level sidebar folder
        if (activeFolderNumericId != null) {
          const idx = res.data.path.findIndex((p) => p.id === activeFolderNumericId)
          setFolderPath(idx >= 0 ? res.data.path.slice(idx + 1) : res.data.path)
        } else {
          setFolderPath(res.data.path)
        }
      }
    } else {
      setFolderPath([])
    }
  }, [isLoggedIn, currentSubfolder, activeFolderNumericId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSubfolders()
    loadBreadcrumb()
  }, [loadSubfolders, loadBreadcrumb])

  // Reset subfolder navigation when sidebar folder changes + load folder name
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentSubfolder(null)
    setFolderPath([])
    setSubfolders([])
    if (activeFolderNumericId != null) {
      getFolderPath(activeFolderNumericId).then((res) => {
        if (res.data && res.data.path.length > 0) {
          setActiveFolderName(res.data.path[res.data.path.length - 1].name)
        }
      })
    } else {
      setActiveFolderName(null)
    }
  }, [activeFolder, activeFolderNumericId])

  const handleNavigateFolder = useCallback(async (folderId: string) => {
    if (folderId === "root") {
      setCurrentSubfolder(null)
    } else if (folderId.startsWith("folder:")) {
      const id = Number(folderId.split(":")[1])
      // If navigating to the sidebar folder itself, reset to root
      if (id === activeFolderNumericId) {
        setCurrentSubfolder(null)
      } else {
        setCurrentSubfolder(id)
      }
    }
  }, [activeFolderNumericId])

  const handleNavigateUp = useCallback(() => {
    if (folderPath.length > 1) {
      setCurrentSubfolder(folderPath[folderPath.length - 2].id)
    } else {
      setCurrentSubfolder(null)
    }
  }, [folderPath])

  const handleCreateSubfolder = useCallback(async (name: string) => {
    const parentId = deepestFolderId
    const res = await createFolder(name, parentId ?? undefined)
    if (res.data) {
      setSubfolders((prev) => [...prev, res.data!])
      setAllUserFolders((prev) => [...prev, res.data!])
    } else if (res.error) {
      showToast(res.error)
    }
  }, [deepestFolderId, showToast])

  const handleDeleteSubfolder = useCallback(async (folderId: number) => {
    const res = await apiDeleteFolder(folderId)
    if (!res.error) {
      setSubfolders((prev) => prev.filter((f) => f.id !== folderId))
      setAllUserFolders((prev) => prev.filter((f) => f.id !== folderId))
    } else {
      showToast(res.error)
    }
  }, [showToast])

  const handleRenameSubfolder = useCallback(async (folderId: number, name: string) => {
    const res = await updateFolder(folderId, { name })
    if (res.data) {
      setSubfolders((prev) => prev.map((f) => f.id === folderId ? { ...f, name } : f))
    } else if (res.error) {
      showToast(res.error)
    }
  }, [showToast])

  const handleMoveFileToSubfolder = useCallback(async (fileId: number, folderId: string) => {
    const res = await moveFile(fileId, folderId)
    if (res.data) {
      setUploadedFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, folder_id: folderId } : f))
    } else if (res.error) {
      showToast(res.error)
    }
  }, [showToast])

  const handleMoveFolderToFolder = useCallback(async (folderId: number, targetKey: string) => {
    const targetId = targetKey.startsWith("folder:") ? Number(targetKey.split(":")[1]) : null
    if (targetId == null || targetId === folderId) return
    const res = await updateFolder(folderId, { parent_id: targetId })
    if (res.data) {
      // Remove from current view if visible
      setSubfolders((prev) => prev.filter((f) => f.id !== folderId))
      // Update allUserFolders so fileCounts recalculate
      setAllUserFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, parent_id: targetId } : f))
    }
  }, [])

  const handleDriveImport = async (driveFiles: DriveFile[], folderId?: string) => {
    const placeholders: UploadingFile[] = driveFiles.map((f, i) => ({
      id: `importing-${Date.now()}-${i}`,
      original_name: f.name,
      size: Number(f.size || 0),
      status: "uploading",
    }))
    setUploadingFiles(placeholders)

    const res = await importDriveFiles(driveFiles, folderId)

    setUploadingFiles([])
    if (res.error) {
      showToast(res.error)
    } else if (res.data) {
      setUploadedFiles((prev) => [...res.data!.files, ...prev])
      if (res.data.errors.length > 0) {
        showToast(`${res.data.errors.length} file(s) failed to import: ${res.data.errors.map((e) => e.name).join(", ")}`)
      }
    }
  }

  const handleImportApply = async (rawFiles: File[], folderId?: string) => {
    const placeholders: UploadingFile[] = rawFiles.map((f, i) => ({
      id: `uploading-${Date.now()}-${i}`,
      original_name: f.name,
      size: f.size,
      status: "uploading",
    }))
    setUploadingFiles(placeholders)

    const res = await uploadFiles(rawFiles, folderId)

    setUploadingFiles([])
    if (res.error) {
      showToast(res.error)
    } else if (res.data) {
      setUploadedFiles((prev) => [...res.data!.files, ...prev])
      if (res.data.skipped.length > 0) {
        showToast(`${res.data.skipped.length} file(s) skipped: ${res.data.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}`)
      }
    }
  }

  const handleMoveFile = handleMoveFileToSubfolder

  const handleRenameFile = async (fileId: number, newName: string) => {
    const res = await renameFile(fileId, newName)
    if (res.data) {
      setUploadedFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, original_name: newName } : f))
    } else if (res.error) {
      showToast(res.error)
    }
  }

  const handleDeleteFile = async (fileId: number) => {
    const res = await deleteFile(fileId)
    if (!res.error) {
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
    } else {
      showToast(res.error)
    }
  }

  const fileCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    // Count files per folder
    for (const f of uploadedFiles) {
      counts[f.folder_id] = (counts[f.folder_id] || 0) + 1
    }
    // Add direct subfolder counts
    for (const folder of allUserFolders) {
      const parentKey = folder.parent_id != null ? `folder:${folder.parent_id}` : null
      if (parentKey) {
        counts[parentKey] = (counts[parentKey] || 0) + 1
      }
    }
    // "All documents" = all files (except Trash) + root folders
    const allFiles = uploadedFiles.filter((f) => f.folder_id !== "Trash").length
    const rootFolders = allUserFolders.filter((f) => f.parent_id == null).length
    counts["All documents"] = allFiles + rootFolders
    return counts
  }, [uploadedFiles, allUserFolders])

  // Filter files by the deepest folder we're in
  const effectiveFolderId = currentSubfolder != null ? `folder:${currentSubfolder}` : activeFolder

  const filteredUploaded = activeFolder === "All documents" && currentSubfolder == null
    ? uploadedFiles.filter((f) => f.folder_id !== "Trash")
    : uploadedFiles.filter((f) => f.folder_id === effectiveFolderId)

  const searchFiltered = search.trim()
    ? filteredUploaded.filter((f) => f.original_name.toLowerCase().includes(search.toLowerCase()))
    : filteredUploaded

  const displayFiles = [...uploadingFiles, ...searchFiltered]

  // Show subfolder features only for folder-type views (not "All documents", "Trash", etc.)
  const canHaveSubfolders = activeFolderNumericId != null || currentSubfolder != null || activeFolder === "All documents"

  // Resolve display name: "folder:5" → actual folder name
  const folderDisplayName = useMemo(() => {
    if (currentSubfolder != null && folderPath.length > 0) {
      return folderPath[folderPath.length - 1].name
    }
    if (activeFolderName) return activeFolderName
    return activeFolder
  }, [activeFolder, currentSubfolder, folderPath, activeFolderName])

  return (
    <div className="flex h-screen items-start overflow-clip bg-[var(--dr-shell-bg)] md:rounded-[20px]">
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed right-4 top-4 z-50 flex size-10 items-center justify-center rounded-lg bg-[var(--dr-sidebar-card-bg)] text-white md:hidden"
      >
        <Menu size={24} />
      </button>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onFolderChange={setActiveFolder}
        activeFolder={activeFolder}
        fileCounts={fileCounts}
        onMoveFile={handleMoveFile}
        onMoveFolder={handleMoveFolderToFolder}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onDeleteFolder={(folder) => {
          setUploadedFiles((prev) => prev.map((f) => f.folder_id === folder ? { ...f, folder_id: "Trash" } : f))
        }}
      />

      <div className="flex h-full w-full flex-[1_0_0] overflow-clip md:rounded-[20px] md:py-[24px] md:pr-[24px]">
        <main
          className="z-[1] flex h-full w-full flex-[1_0_0] flex-col justify-between overflow-clip border-[var(--dr-main-border)] bg-[var(--dr-main-bg)] md:rounded-bl-[20px] md:rounded-tl-[20px] md:border"
          style={{ boxShadow: "var(--dr-main-shadow)" }}
        >
          {activeTab === "Activity" ? (
            <ActivityView folderId={effectiveFolderId} />
          ) : displayFiles.length > 0 || subfolders.length > 0 || canHaveSubfolders ? (
            <FileListView
              folderName={folderDisplayName}
              files={displayFiles}
              onImport={() => setImportOpen(true)}
              onDeleteFile={handleDeleteFile}
              onTrashFile={(fileId) => handleMoveFile(fileId, "Trash")}
              onRenameFile={handleRenameFile}
              subfolders={canHaveSubfolders ? subfolders : []}
              folderPath={folderPath}
              onNavigateFolder={handleNavigateFolder}
              onNavigateUp={handleNavigateUp}
              onCreateSubfolder={canHaveSubfolders ? handleCreateSubfolder : undefined}
              onDeleteSubfolder={handleDeleteSubfolder}
              onRenameSubfolder={handleRenameSubfolder}
              onMoveFileToSubfolder={handleMoveFileToSubfolder}
              currentFolderId={effectiveFolderId}
            />
          ) : (
            <WelcomeScreen
              onImport={() => setImportOpen(true)}
              hasFilesElsewhere={uploadedFiles.length > 0 && displayFiles.length === 0}
              onViewDocuments={() => setActiveFolder("All documents")}
            />
          )}
          {activeTab !== "Activity" && <SearchBar value={search} onChange={setSearch} />}
        </main>
      </div>
      <ImportFilesModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onApply={handleImportApply}
        onImportDrive={handleDriveImport}
        folderId={effectiveFolderId}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex max-w-[500px] -translate-x-1/2 items-center gap-3 rounded-[12px] bg-[#141718] px-5 py-3 shadow-lg">
          <AlertTriangle size={18} className="shrink-0 text-amber-400" />
          <span className="flex-1 text-[13px] leading-5 text-white">{toast}</span>
          <button onClick={() => setToast(null)} className="shrink-0 text-white/50 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
