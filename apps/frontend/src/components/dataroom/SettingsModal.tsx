import { X, ChevronsUpDown } from "lucide-react"
import { EditProfileIcon, PasswordIcon, SessionsIcon } from "@/components/icons"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { EditProfileTab } from "./settings/EditProfileTab"
import { PasswordTab } from "./settings/PasswordTab"
import { SessionsTab } from "./settings/SessionsTab"
import { DeleteAccountTab } from "./settings/DeleteAccountTab"

type Tab = "profile" | "password" | "sessions" | "delete"

type IconComponent = React.ComponentType<{ className?: string }>

const menuItems: { id: Tab; icon: IconComponent; label: string }[] = [
  { id: "profile", icon: EditProfileIcon, label: "Edit profile" },
  { id: "password", icon: PasswordIcon, label: "Password" },
  { id: "sessions", icon: SessionsIcon, label: "Sessions" },
]

const allTabs: { id: Tab; icon: IconComponent; label: string }[] = [
  ...menuItems,
  { id: "delete", icon: X, label: "Delete account" },
]

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("profile")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [dropdownOpen])

  if (!isOpen) return null

  const activeItem = allTabs.find((t) => t.id === activeTab)!

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      {/* Desktop */}
      <div
        className="relative hidden max-h-[85vh] w-full max-w-[768px] gap-[48px] overflow-hidden rounded-[24px] bg-[#fefefe] p-[48px] font-[Inter,sans-serif] md:flex"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-6 top-6 text-[#6c7275] hover:text-[#141718]"
        >
          <X size={24} />
        </button>

        <nav className="flex w-[212px] shrink-0 flex-col gap-1">
          {menuItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 px-[16px] py-[8px] text-[14px] font-semibold leading-[24px] tracking-[-0.28px]",
                activeTab === id
                  ? "rounded-[48px] border-2 border-[#2752f4] text-[#141718]"
                  : "text-[#6c7275]"
              )}
            >
              <Icon className="size-[16px] shrink-0" />
              {label}
            </button>
          ))}

          <div className="my-2 h-px bg-[#e8ecef]" />

          <button
            onClick={() => setActiveTab("delete")}
            className={cn(
              "flex items-center gap-2 px-[16px] py-[8px] text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[#d84c10]",
              activeTab === "delete" && "rounded-[48px] border-2 border-[#d84c10]"
            )}
          >
            <X className="size-[16px] shrink-0" />
            Delete account
          </button>
        </nav>

        {activeTab === "profile" && <EditProfileTab />}
        {activeTab === "password" && <PasswordTab />}
        {activeTab === "sessions" && <SessionsTab />}
        {activeTab === "delete" && <DeleteAccountTab />}
      </div>

      {/* Mobile */}
      <div
        className="relative flex max-h-[90vh] w-full max-w-[375px] flex-col gap-[32px] overflow-y-auto rounded-[20px] bg-[#fefefe] px-[20px] pt-[64px] pb-[20px] font-[Inter,sans-serif] md:hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-[20px] top-[20px]"
        >
          <X size={24} className="text-[#141718]" />
        </button>

        {/* Tab dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex w-full items-center justify-between rounded-[12px] border-2 border-[#e8ecef] px-[16px] py-[12px]"
          >
            <div className="flex items-center gap-[12px]">
              <activeItem.icon
                className={cn(
                  "size-[20px] shrink-0",
                  activeTab === "delete" ? "text-[#d84c10]" : "text-[#141718]"
                )}
              />
              <span
                className={cn(
                  "text-[16px] font-semibold leading-[24px] tracking-[-0.32px]",
                  activeTab === "delete" ? "text-[#d84c10]" : "text-[#141718]"
                )}
              >
                {activeItem.label}
              </span>
            </div>
            <ChevronsUpDown size={24} className="shrink-0 text-[#141718]" />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-[12px] border-2 border-[#e8ecef] bg-[#fefefe]">
              {allTabs.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => {
                    setActiveTab(id)
                    setDropdownOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-[12px] px-[16px] py-[12px] text-left",
                    id === "delete" ? "text-[#d84c10]" : "text-[#141718]",
                    activeTab === id && "bg-[#f3f5f7]"
                  )}
                >
                  <Icon className="size-[20px] shrink-0" />
                  <span className="text-[16px] font-semibold leading-[24px] tracking-[-0.32px]">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTab === "profile" && <EditProfileTab />}
        {activeTab === "password" && <PasswordTab />}
        {activeTab === "sessions" && <SessionsTab />}
        {activeTab === "delete" && <DeleteAccountTab />}
      </div>
    </div>
  )
}
