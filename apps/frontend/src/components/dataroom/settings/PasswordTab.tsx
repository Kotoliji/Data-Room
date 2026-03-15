import { Lock } from "lucide-react"
import { useState } from "react"
import { changePassword } from "@/lib/api"

export function PasswordTab() {
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const canSubmit = !saving && oldPassword && newPassword && confirmPassword

  async function handleSubmit() {
    setError(null)
    setSuccess(false)

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("All fields are required")
      return
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setSaving(true)
    const res = await changePassword(oldPassword, newPassword)
    if (res.data) {
      setSuccess(true)
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setSuccess(false), 2000)
    } else {
      setError(res.error)
    }
    setSaving(false)
  }

  return (
    <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="flex flex-1 flex-col gap-6 overflow-y-auto">
      {/* Hidden fields to absorb browser autofill */}
      <input type="text" autoComplete="username" className="absolute h-0 w-0 overflow-hidden opacity-0" tabIndex={-1} />
      <input type="password" autoComplete="current-password" className="absolute h-0 w-0 overflow-hidden opacity-0" tabIndex={-1} />

      <h4 className="text-[28px] font-bold leading-[40px] tracking-[-0.28px] text-[#141718]">
        Password
      </h4>

      {error && (
        <p className="text-[14px] font-medium text-red-500">{error}</p>
      )}

      <div className="flex flex-col gap-3">
        <span className="text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[#232627]">
          Old password
        </span>
        <label className="flex items-center gap-3 rounded-[12px] bg-[#f3f5f7] px-[16px] py-[14px]">
          <Lock size={24} className="shrink-0 text-[#141718]" />
          <input
            type="password"
            placeholder="Password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium tracking-[-0.14px] text-[#141718] outline-none placeholder:text-[rgba(108,114,117,0.5)]"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[#232627]">
          New password
        </span>
        <label className="flex items-center gap-3 rounded-[12px] bg-[#f3f5f7] px-[16px] py-[14px]">
          <Lock size={24} className="shrink-0 text-[#141718]" />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium tracking-[-0.14px] text-[#141718] outline-none placeholder:text-[rgba(108,114,117,0.5)]"
          />
        </label>
        <span className="text-[12px] font-medium leading-[20px] tracking-[-0.24px] text-[#6c7275]">
          Minimum 8 characters
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[#232627]">
          Confirm new password
        </span>
        <label className="flex items-center gap-3 rounded-[12px] bg-[#f3f5f7] px-[16px] py-[14px]">
          <Lock size={24} className="shrink-0 text-[#141718]" />
          <input
            type="password"
            placeholder="Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium tracking-[-0.14px] text-[#141718] outline-none placeholder:text-[rgba(108,114,117,0.5)]"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-[12px] bg-[#2752f4] px-[24px] py-[12px] text-[16px] font-semibold tracking-[-0.32px] text-[#fefefe] disabled:opacity-50"
      >
        {saving ? "Changing..." : success ? "Password changed!" : "Change password"}
      </button>
    </form>
  )
}
