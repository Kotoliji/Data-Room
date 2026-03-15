import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Lock } from "lucide-react"
import { AuthInput } from "./AuthInput"
import { resetPassword } from "@/lib/api"

export function NewPasswordForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!password || !confirmPassword) {
      setError("All fields are required")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (!token) {
      setError("Invalid reset link")
      return
    }

    setLoading(true)
    const res = await resetPassword(token, password)
    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }

    setSuccess(true)
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center self-stretch bg-[#FEFEFE] px-[32px] lg:rounded-[20px] lg:px-[200px] 2xl:px-[376px]">
      <div className="flex w-full max-w-[504px] flex-col gap-[32px]">
        <div className="flex items-center gap-[16px]">
          <button
            type="button"
            onClick={() => navigate("/login")}
            aria-label="Back to sign in"
            className="shrink-0 text-[#141718] transition-colors hover:text-[#6C7275]"
          >
            <ArrowLeft size={24} />
          </button>
          <span className="font-[Inter,sans-serif] text-[24px] font-semibold leading-[40px] tracking-[-0.48px] text-[#141718]">
            Set new password
          </span>
        </div>

        <form
          className="flex w-full flex-col gap-[24px]"
          onSubmit={handleSubmit}
        >
          {error && (
            <div className="rounded-[8px] bg-red-50 px-[16px] py-[12px] font-[Inter,sans-serif] text-[14px] font-medium text-red-600">
              {error}
            </div>
          )}

          {success ? (
            <div className="flex flex-col gap-[24px]">
              <div className="rounded-[8px] bg-green-50 px-[16px] py-[12px] font-[Inter,sans-serif] text-[14px] font-medium text-green-600">
                Password has been reset
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="flex w-full items-center justify-center gap-[8px] rounded-[12px] bg-[#2752F4] px-[24px] py-[14px] transition-colors hover:bg-[#1e44d4]"
              >
                <span className="font-[Inter,sans-serif] text-[16px] font-semibold leading-[24px] tracking-[-0.32px] text-[#FEFEFE]">
                  Back to sign in
                </span>
              </button>
            </div>
          ) : (
            <>
              <div className="flex w-full flex-col gap-[16px]">
                <AuthInput
                  icon={<Lock size={24} className="shrink-0 text-[rgba(108,114,117,0.5)]" />}
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={setPassword}
                />
                <AuthInput
                  icon={<Lock size={24} className="shrink-0 text-[rgba(108,114,117,0.5)]" />}
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-[8px] rounded-[12px] bg-[#2752F4] px-[24px] py-[14px] transition-colors hover:bg-[#1e44d4] disabled:opacity-50"
              >
                <span className="font-[Inter,sans-serif] text-[16px] font-semibold leading-[24px] tracking-[-0.32px] text-[#FEFEFE]">
                  {loading ? "Resetting..." : "Reset password"}
                </span>
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
