import {
  Check,
  ChevronDown,
  PlusCircle,
  X,
} from "lucide-react"
import { DataRoomIcon, ActivityIcon, SettingsIcon, SearchIcon } from "@/components/icons"
import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import type { FolderItem } from "@/lib/types"
import { getFolders, createFolder as apiCreateFolder, updateFolder as apiUpdateFolder, deleteFolder as apiDeleteFolder } from "@/lib/api"
import { SettingsModal } from "./SettingsModal"
import { UserCard } from "./UserCard"
import { ThemeToggle } from "./ThemeToggle"
import { DeleteFolderModal } from "./DeleteFolderModal"

const mainMenu = [
  { icon: DataRoomIcon, label: "Data Room", color: "text-[#3E90F0]" },
  { icon: ActivityIcon, label: "Activity", color: "text-[#D84C10]" },
  { icon: SettingsIcon, label: "Settings", color: "text-[#8E55EA]" },
]

const defaultFolders = [
  { label: "All documents", color: "rgba(108,114,117,0.5)" },
  { label: "Recently imported", color: "#8E55EA" },
  { label: "Trash", color: "#D84C10" },
]

const FOLDER_COLORS = ["#3e90f0", "#8c6584", "#7ece18", "#f0c93e", "#e05297", "#4fc1b0"]

function highlightFolder(text: string, query: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-white">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])
  return matches
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onFolderChange?: (folder: string) => void
  activeFolder?: string
  fileCounts?: Record<string, number>
  onMoveFile?: (fileId: number, folderId: string) => void
  onMoveFolder?: (folderId: number, targetFolderKey: string) => void
  onDeleteFolder?: (folder: string) => void
  onFolderCreated?: (folder: FolderItem) => void
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export function Sidebar({ isOpen, onClose, onFolderChange, activeFolder: activeFolderProp = "All documents", fileCounts = {}, onMoveFile, onMoveFolder, onDeleteFolder, onFolderCreated, activeTab = "Data Room", onTabChange }: SidebarProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const navigate = useNavigate()

  const [customFolders, setCustomFolders] = useState<FolderItem[]>([])
  const [foldersOpen, setFoldersOpen] = useState(true)
  const activeFolder = activeFolderProp
  const setActiveFolder = (folder: string) => onFolderChange?.(folder)
  const [folderSearch, setFolderSearch] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [newFolderColor, setNewFolderColor] = useState("#3e90f0")
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<FolderItem | null>(null)
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null)
  const [editFolderName, setEditFolderName] = useState("")
  const [editColorFolderId, setEditColorFolderId] = useState<number | null>(null)
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const createFolderRef = useRef<HTMLDivElement>(null)
  const newFolderInputRef = useRef<HTMLInputElement>(null)
  const isMac = navigator.userAgent.includes("Mac")

  const isLoggedIn = !!localStorage.getItem("user")

  const loadFolders = useCallback(async () => {
    if (!isLoggedIn) return
    const res = await getFolders()
    if (res.data) setCustomFolders(res.data.folders)
  }, [isLoggedIn])

  useEffect(() => { loadFolders() }, [loadFolders])

  type DisplayFolder =
    | { kind: "default"; label: string; color: string }
    | { kind: "custom"; folder: FolderItem }

  const allFolders: DisplayFolder[] = [
    ...defaultFolders.map((f) => ({ kind: "default" as const, label: f.label, color: f.color })),
    ...customFolders.map((f) => ({ kind: "custom" as const, folder: f })),
  ]

  const getFolderKey = (f: DisplayFolder) => f.kind === "default" ? f.label : `folder:${f.folder.id}`
  const getFolderLabel = (f: DisplayFolder) => f.kind === "default" ? f.label : f.folder.name
  const getFolderColor = (f: DisplayFolder) => f.kind === "default" ? f.color : f.folder.color

  const filteredFolders = folderSearch.trim()
    ? allFolders.filter((f) =>
        getFolderLabel(f).toLowerCase().includes(folderSearch.toLowerCase())
      )
    : allFolders

  async function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) return
    const res = await apiCreateFolder(name, undefined, newFolderColor)
    if (res.data) {
      setCustomFolders((prev) => [...prev, res.data!])
      const key = `folder:${res.data.id}`
      setActiveFolder(key)
      onFolderCreated?.(res.data)
    }
    setNewFolderName("")
    setNewFolderColor("#3e90f0")
    setColorPickerOpen(false)
    setCreatingFolder(false)
  }

  function cancelCreate() {
    setCreatingFolder(false)
    setNewFolderName("")
    setNewFolderColor("#3e90f0")
    setColorPickerOpen(false)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "f") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isMac])

  // Close on Escape (but not if creating a folder — let the input handle it)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !creatingFolder) onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, onClose, creatingFolder])

  useEffect(() => {
    if (creatingFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus()
    }
  }, [creatingFolder])

  const newFolderNameRef = useRef(newFolderName)
  // eslint-disable-next-line react-hooks/refs
  newFolderNameRef.current = newFolderName

  useEffect(() => {
    if (!creatingFolder) return
    // Use mousedown instead of click to avoid the race condition where
    // the click event from the "New folder" button bubbles to document
    // and immediately cancels the creation.
    function handleClickOutside(e: MouseEvent) {
      if (createFolderRef.current && !createFolderRef.current.contains(e.target as Node)) {
        if (!newFolderNameRef.current.trim()) {
          cancelCreate()
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [creatingFolder])

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [isOpen])

  const sidebarContent = (
    <aside
      className={cn(
        "relative z-[2] flex h-full shrink-0 flex-col justify-between overflow-hidden bg-[var(--dr-sidebar-bg)] font-[Inter,sans-serif]",
        // Desktop: visible, fixed width
        "w-[280px] 3xl:w-[180px]"
      )}
    >
      {/* Top: logo + menus + folders */}
      <div className="sidebar-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* Logo */}
        <div className="px-6 py-10 3xl:px-4 3xl:py-6">
          <span className="font-['Noto_Sans',sans-serif] text-[36px] font-bold text-[var(--dr-sidebar-title)] 3xl:text-[24px]">
            Acme Corp
          </span>
        </div>

        {/* Main menu */}
        <nav className="flex flex-col border-b border-[var(--dr-sidebar-border)] p-4 3xl:p-2">
          {mainMenu.map(({ icon: Icon, label, color }) => {
            const isActive = label === activeTab
            const isLoggedIn = !!localStorage.getItem("user")
            return (
              <button
                key={label}
                onClick={
                  !isLoggedIn && label !== "Data Room"
                    ? () => navigate("/login")
                    : label === "Settings"
                      ? () => setSettingsOpen(true)
                      : () => onTabChange?.(label)
                }
                className={cn(
                  "flex w-full items-center gap-5 rounded-lg px-5 py-3 text-sm font-semibold leading-6 tracking-[-0.28px] 3xl:gap-3 3xl:px-3 3xl:py-2 3xl:text-xs",
                  isActive
                    ? "text-[var(--dr-sidebar-active-text)]"
                    : "text-[var(--dr-sidebar-text-inactive)] hover:text-[var(--dr-sidebar-text)]"
                )}
                style={
                  isActive
                    ? {
                        background: "var(--dr-sidebar-menu-active-bg)",
                        boxShadow: "var(--dr-sidebar-menu-active-shadow)",
                      }
                    : undefined
                }
              >
                <Icon className={cn("size-[24px] shrink-0 3xl:size-[18px]", color)} />
                {label}
              </button>
            )
          })}
        </nav>

        {/* Folders section */}
        <div className="flex flex-col p-4 3xl:p-2">
          <label className="flex w-full cursor-text items-center rounded-lg border border-[var(--dr-sidebar-search-border)] px-5 py-3 text-sm font-semibold leading-6 tracking-[-0.28px] text-[var(--dr-sidebar-search-text)] transition-colors focus-within:border-[var(--dr-sidebar-text)] 3xl:px-3 3xl:py-2 3xl:text-xs">
            <SearchIcon className="mr-5 size-[24px] shrink-0 pointer-events-none text-[#3FDD78] 3xl:mr-3 3xl:size-[18px]" />
            <input
              ref={searchRef}
              type="text"
              value={folderSearch}
              onChange={(e) => setFolderSearch(e.target.value)}
              placeholder="Search"
              aria-label="Search folders"
              autoComplete="off"
              name="sidebar-folder-search"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold leading-6 tracking-[-0.28px] text-[var(--dr-sidebar-search-text)] caret-white placeholder:text-[var(--dr-sidebar-search-text)]/50 outline-none 3xl:text-xs"
            />
            {folderSearch && (
              <span
                role="button"
                onClick={() => setFolderSearch("")}
                className="ml-2 shrink-0 cursor-pointer rounded p-0.5 text-[var(--dr-sidebar-search-text)] hover:text-[var(--dr-sidebar-text)]"
              >
                <X size={16} />
              </span>
            )}
          </label>

          <button
            onClick={() => setFoldersOpen(!foldersOpen)}
            className="flex items-center gap-5 px-5 py-3 3xl:gap-3 3xl:px-3 3xl:py-2"
          >
            <ChevronDown
              size={24}
              className={cn(
                "text-[var(--dr-sidebar-text-muted)] transition-transform 3xl:size-[18px]",
                !foldersOpen && "-rotate-90"
              )}
            />
            <span className="text-sm font-medium leading-6 tracking-[-0.14px] text-[var(--dr-sidebar-text-muted)] 3xl:text-xs">
              Folders
            </span>
          </button>

          {foldersOpen && (
            <div className="flex flex-col">
              {filteredFolders.map((item) => {
                const isCustom = item.kind === "custom"
                const key = getFolderKey(item)
                const label = getFolderLabel(item)
                const color = getFolderColor(item)
                const isRenaming = isCustom && editingFolderId === item.folder.id
                const showColorPicker = isCustom && editColorFolderId === item.folder.id

                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (!isRenaming) { setActiveFolder(key) } }}
                    onKeyDown={(e) => {
                      if (!isRenaming && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        setActiveFolder(key)
                      }
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFolder(key) }}
                    onDragLeave={() => setDragOverFolder(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOverFolder(null)
                      const fileId = e.dataTransfer.getData("application/x-file-id")
                      const folderId = e.dataTransfer.getData("application/x-folder-id")
                      if (fileId) onMoveFile?.(Number(fileId), key)
                      if (folderId && key.startsWith("folder:")) {
                        onMoveFolder?.(Number(folderId), key)
                      }
                    }}
                    className={cn(
                      "group relative flex w-full cursor-pointer items-center gap-5 rounded-lg px-5 py-3 text-sm font-semibold leading-6 tracking-[-0.28px] transition-all 3xl:gap-3 3xl:px-3 3xl:py-2 3xl:text-xs",
                      activeFolder === key
                        ? "text-[var(--dr-sidebar-active-text)]"
                        : "text-[var(--dr-sidebar-text-inactive)]",
                      dragOverFolder === key && "ring-2 ring-[#2752f4] ring-inset rounded-lg"
                    )}
                    style={
                      activeFolder === key
                        ? { background: "var(--dr-sidebar-active-bg)" }
                        : undefined
                    }
                  >
                    <div
                      className={cn("relative flex size-6 items-center justify-center 3xl:size-[18px]", isCustom && "cursor-pointer")}
                      onClick={(e) => {
                        if (!isCustom) return
                        e.stopPropagation()
                        setEditColorFolderId(showColorPicker ? null : item.folder.id)
                      }}
                    >
                      <div
                        className={cn("size-3.5 rounded 3xl:size-2.5", isCustom && "hover:ring-2 hover:ring-white/50")}
                        style={{ background: color }}
                      />
                      {showColorPicker && isCustom && (
                        <div className="absolute left-0 top-full z-50 mt-1 flex gap-1 rounded-[10px] border border-[var(--dr-sidebar-border)] bg-[var(--dr-sidebar-bg)] p-1.5 shadow-lg">
                          {FOLDER_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={async (e) => {
                                e.stopPropagation()
                                const res = await apiUpdateFolder(item.folder.id, { color: c })
                                if (res.data) {
                                  setCustomFolders((prev) => prev.map((f) => f.id === item.folder.id ? { ...f, color: c } : f))
                                }
                                setEditColorFolderId(null)
                              }}
                              className={cn("flex size-6 items-center justify-center rounded-full", color === c && "ring-2 ring-white")}
                            >
                              <div className="size-4 rounded-full" style={{ background: c }} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {isRenaming && isCustom ? (
                      <input
                        autoFocus
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && editFolderName.trim()) {
                            const newName = editFolderName.trim()
                            const res = await apiUpdateFolder(item.folder.id, { name: newName })
                            if (res.data) {
                              setCustomFolders((prev) => prev.map((f) => f.id === item.folder.id ? { ...f, name: newName } : f))
                            }
                            setEditingFolderId(null)
                          }
                          if (e.key === "Escape") setEditingFolderId(null)
                        }}
                        onBlur={() => setEditingFolderId(null)}
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-0 flex-1 truncate rounded border border-[#6c7275] bg-transparent px-1 text-sm font-semibold text-[var(--dr-sidebar-active-text)] outline-none"
                      />
                    ) : (
                      <span
                        className="flex-1 text-left"
                        onDoubleClick={(e) => {
                          if (!isCustom) return
                          e.stopPropagation()
                          setEditingFolderId(item.folder.id)
                          setEditFolderName(item.folder.name)
                        }}
                      >
                        {folderSearch.trim() ? highlightFolder(label, folderSearch) : label}
                      </span>
                    )}

                    <span className="flex items-center justify-center overflow-hidden rounded-lg bg-[var(--dr-sidebar-badge-bg)] px-2 text-sm font-semibold leading-6 tracking-[-0.28px] text-[var(--dr-sidebar-badge-text)] 3xl:text-xs">
                      {fileCounts[key] ?? 0}
                    </span>
                    {isCustom && !isRenaming && (
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteFolderTarget(item.folder)
                        }}
                        className="ml-1 shrink-0 rounded-md p-0.5 text-[var(--dr-sidebar-text-inactive)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                      >
                        <X size={14} />
                      </span>
                    )}
                  </div>
                )
              })}

              {creatingFolder ? (
                <div ref={createFolderRef} className="relative flex w-full items-center gap-3 rounded-lg px-5 py-3 3xl:gap-2 3xl:px-3 3xl:py-2">
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setColorPickerOpen(!colorPickerOpen)}
                      className="flex size-6 items-center justify-center 3xl:size-[18px]"
                    >
                      <div
                        className="size-3.5 rounded transition-colors 3xl:size-2.5"
                        style={{ background: newFolderColor }}
                      />
                    </button>
                    {colorPickerOpen && (
                      <div className="absolute left-full top-0 z-50 ml-1 flex flex-col gap-1 rounded-[10px] border border-[var(--dr-sidebar-border)] bg-[var(--dr-sidebar-bg)] p-1.5 shadow-lg">
                        {FOLDER_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => {
                              setNewFolderColor(color)
                              setColorPickerOpen(false)
                            }}
                            className={cn(
                              "rounded-md p-1.5 transition-colors",
                              newFolderColor === color
                                ? "bg-white/10"
                                : "hover:bg-white/5"
                            )}
                          >
                            <div
                              className="size-4 rounded"
                              style={{ background: color }}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    ref={newFolderInputRef}
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newFolderName.trim()) {
                        handleCreateFolder()
                      } else if (e.key === "Escape") {
                        cancelCreate()
                      }
                    }}
                    placeholder="Folder name"
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold leading-6 tracking-[-0.28px] text-[var(--dr-sidebar-text)] placeholder:text-[var(--dr-sidebar-text-inactive)] outline-none 3xl:text-xs"
                  />
                  <button
                    onClick={() => newFolderName.trim() && handleCreateFolder()}
                    className="shrink-0 text-[var(--dr-sidebar-text-inactive)] hover:text-[var(--dr-sidebar-text)]"
                  >
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreatingFolder(true)}
                  className="flex w-full items-center gap-5 rounded-lg px-5 py-3 text-sm font-medium leading-6 tracking-[-0.14px] text-[var(--dr-sidebar-text-inactive)] 3xl:gap-3 3xl:px-3 3xl:py-2 3xl:text-xs"
                >
                  <PlusCircle size={24} className="3xl:size-[18px]" />
                  New folder
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom section */}
      <div className="isolate flex shrink-0 flex-col gap-3 px-4 py-6 3xl:px-2 3xl:py-4">
        <UserCard onSettingsClick={() => setSettingsOpen(true)} />

        <ThemeToggle />
      </div>
    </aside>
  )

  const deleteFolderModal = deleteFolderTarget && (
    <DeleteFolderModal
      folder={deleteFolderTarget}
      onConfirm={async () => {
        const folder = deleteFolderTarget
        const folderKey = `folder:${folder.id}`
        const res = await apiDeleteFolder(folder.id)
        if (res.data) {
          setCustomFolders((prev) => prev.filter((f) => f.id !== folder.id))
          if (activeFolder === folderKey) {
            setActiveFolder("All documents")
          }
          onDeleteFolder?.(folderKey)
        }
        setDeleteFolderTarget(null)
      }}
      onCancel={() => setDeleteFolderTarget(null)}
    />
  )

  if (isDesktop) {
    return (
      <>
        {sidebarContent}
        <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        {deleteFolderModal}
      </>
    )
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50",
          isOpen ? "visible" : "invisible"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/60 transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={onClose}
        />

        {/* Drawer panel */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[min(280px,85vw)] transition-transform duration-300 ease-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-3 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-[var(--dr-sidebar-text-muted)] hover:text-white"
          >
            <X size={20} />
          </button>

          {sidebarContent}
        </div>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {deleteFolderModal}
    </>
  )
}
