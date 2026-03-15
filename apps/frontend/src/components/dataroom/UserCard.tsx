import { LogOut, UserCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { API_BASE } from "@/lib/api"
import type { User } from "@/lib/types"

interface UserCardProps {
  onSettingsClick: () => void
}

export function UserCard({ onSettingsClick }: UserCardProps) {
  const navigate = useNavigate()

  let user: User | null = null
  try {
    const raw = localStorage.getItem("user")
    if (raw) {
      const parsed = JSON.parse(raw) as User
      if (parsed.name && parsed.email) user = parsed
    }
  } catch { /* ignore corrupt data */ }

  if (user) {
    return (
      <div
        onClick={onSettingsClick}
        className="z-[2] flex cursor-pointer items-center gap-3 overflow-hidden rounded-[12px] bg-[var(--dr-sidebar-card-bg)] px-4 py-3 shadow-[0px_20px_24px_0px_rgba(0,0,0,0.5)]"
      >
        {user.avatar_url ? (
          <img src={`${API_BASE}${user.avatar_url}`} alt="" className="size-[32px] shrink-0 rounded-full object-cover 3xl:size-[24px]" />
        ) : (
          <UserCircle size={32} className="shrink-0 text-white/70 3xl:size-[24px]" />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-bold leading-[20px] text-white 3xl:text-[12px]">
            {user.name}
          </span>
          <span className="truncate text-[12px] leading-[16px] text-white/50 3xl:text-[10px]">
            {user.email}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            localStorage.removeItem("user")
            localStorage.removeItem("auth_token")
            navigate("/login")
          }}
          className="shrink-0 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Log out"
        >
          <LogOut size={18} className="3xl:size-[14px]" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => navigate("/login")}
      className="z-[2] flex h-[76px] items-center justify-center overflow-hidden rounded-[12px] bg-[var(--dr-sidebar-card-bg)] p-[10px] shadow-[0px_20px_24px_0px_rgba(0,0,0,0.5)] transition-colors hover:bg-[var(--dr-sidebar-badge-bg)]"
    >
      <span className="text-[16px] font-extrabold leading-[24px] tracking-[-0.32px] text-white 3xl:text-[13px]">
        Sign in / Login
      </span>
    </button>
  )
}
