import { Lock } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { deleteAccount } from "@/lib/api"

export function DeleteAccountTab() {
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setError(null)
    setLoading(true)
    const userId = (() => { try { const u = localStorage.getItem("user"); return u ? (JSON.parse(u) as { id: number }).id : null } catch { return null } })()
    const res = await deleteAccount(password)
    if (res.data) {
      if (userId) localStorage.removeItem(`dr-folders-${userId}`)
      localStorage.removeItem("auth_token")
      localStorage.removeItem("user")
      navigate("/login")
    } else {
      setError(res.error ?? "Incorrect password")
    }
    setLoading(false)
  }

  return (
    <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleDelete() }} className="flex flex-1 flex-col gap-6 overflow-y-auto">
      {/* Hidden fields to absorb browser autofill */}
      <input type="text" autoComplete="username" className="absolute h-0 w-0 overflow-hidden opacity-0" tabIndex={-1} />
      <input type="password" autoComplete="current-password" className="absolute h-0 w-0 overflow-hidden opacity-0" tabIndex={-1} />

      <h4 className="text-[28px] font-bold leading-[40px] tracking-[-0.28px] text-[#141718]">
        We're sorry to see you go
      </h4>

      <p className="text-[12px] font-medium leading-[20px] tracking-[-0.24px] text-[#6c7275]">
        Warning: Deleting your account will permanently remove all of your data
        and cannot be undone. This includes your profile, chats, comments, and
        any other information associated with your account. Are you sure you want
        to proceed with deleting your account?
      </p>

      {error && (
        <p className="text-[14px] font-medium text-red-500">{error}</p>
      )}

      <div className="flex flex-col gap-3">
        <span className="text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[#232627]">
          Your password
        </span>
        <label className="flex items-center gap-3 rounded-[12px] bg-[#f3f5f7] px-[16px] py-[14px]">
          <Lock size={24} className="shrink-0 text-[#141718]" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium tracking-[-0.14px] text-[#141718] outline-none placeholder:text-[rgba(108,114,117,0.5)]"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={!password || loading}
        className="w-full rounded-[12px] bg-[#d84c10] px-[24px] py-[12px] text-[16px] font-semibold tracking-[-0.32px] text-[#fefefe] disabled:opacity-20"
      >
        {loading ? "Deleting..." : "Delete account"}
      </button>
    </form>
  )
}
