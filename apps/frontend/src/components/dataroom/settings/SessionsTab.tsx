import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Globe } from "lucide-react"
import { getSessions, revokeSession, revokeAllSessions } from "@/lib/api"
import type { Session, User } from "@/lib/types"
import { ChromeIcon, SafariIcon } from "@/components/icons"

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `Signed in ${d.toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" })}`
}

function getBrowserIcon(device: string) {
  const d = device.toLowerCase()
  if (d.includes("chrome")) return <ChromeIcon className="size-[32px]" />
  if (d.includes("safari")) return <SafariIcon className="size-[32px]" />
  return null
}

function getCurrentSessionId(): number | null {
  try {
    const raw = localStorage.getItem("user")
    if (!raw) return null
    const user = JSON.parse(raw) as User
    return user.session_id ?? null
  } catch {
    return null
  }
}

function logoutAndRedirect(navigate: ReturnType<typeof useNavigate>) {
  localStorage.removeItem("auth_token")
  localStorage.removeItem("user")
  navigate("/login")
}

export function SessionsTab() {
  const navigate = useNavigate()
  const currentSessionId = getCurrentSessionId()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<number | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)

  useEffect(() => {
    getSessions().then((res) => {
      if (res.error) {
        setError(res.error)
      } else {
        setSessions(res.data ?? [])
      }
      setLoading(false)
    })
  }, [])

  async function handleRevoke(id: number) {
    setRevoking(id)
    const res = await revokeSession(id)
    if (res.error) {
      setError(res.error)
    } else {
      if (id === currentSessionId) {
        logoutAndRedirect(navigate)
        return
      }
      setSessions((prev) => prev.filter((s) => s.id !== id))
    }
    setRevoking(null)
  }

  async function handleRevokeAll() {
    setRevokingAll(true)
    const res = await revokeAllSessions()
    if (res.error) {
      setError(res.error)
    } else {
      logoutAndRedirect(navigate)
      return
    }
    setRevokingAll(false)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
      <h4 className="text-[28px] font-bold leading-[40px] tracking-[-0.28px] text-[#141718]">
        Your sessions
      </h4>

      <p className="text-[14px] font-medium leading-[24px] tracking-[-0.14px] text-[#6c7275]">
        This is a list of devices that have logged into your account. Revoke any
        sessions that you do not recognize.
      </p>

      <div className="flex flex-col gap-3">
        <span className="text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[#232627]">
          Devices
        </span>
        <div className="h-px bg-[#e8ecef]" />

        {loading && (
          <p className="text-[14px] text-[#6c7275]">Loading...</p>
        )}

        {error && (
          <p className="text-[14px] text-red-500">{error}</p>
        )}

        {!loading && !error && sessions.length === 0 && (
          <p className="text-[14px] text-[#6c7275]">No active sessions</p>
        )}

        <div className="flex flex-col gap-4">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-4">
              <div className="flex size-[48px] shrink-0 items-center justify-center rounded-full bg-[#f3f5f7]">
                {getBrowserIcon(s.device) ?? <Globe size={32} className="text-[#6c7275]" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[#141718]">
                  {s.device}
                  {s.id === currentSessionId && (
                    <span className="ml-1 text-[12px] font-medium text-[#6c7275]">
                      (this device)
                    </span>
                  )}
                </span>
                <span className="text-[12px] font-medium leading-[20px] tracking-[-0.24px] text-[#6c7275]">
                  {s.ip} &middot; {formatDate(s.created_at)}
                </span>
              </div>
              <button
                disabled={revoking === s.id}
                onClick={() => handleRevoke(s.id)}
                className="shrink-0 rounded-[8px] border-2 border-[#e8ecef] px-[16px] py-[6px] text-[14px] font-semibold tracking-[-0.28px] text-[#141718] disabled:opacity-50"
              >
                {revoking === s.id ? "Revoking..." : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        disabled={revokingAll || sessions.length === 0}
        onClick={handleRevokeAll}
        className="w-full rounded-[12px] bg-[#2752f4] px-[24px] py-[12px] text-[16px] font-semibold tracking-[-0.32px] text-[#fefefe] disabled:opacity-50"
      >
        {revokingAll ? "Signing out..." : "Sign out all devices"}
      </button>
    </div>
  )
}
