import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Mail } from "lucide-react"
import { AuthInput } from "./AuthInput"
import { forgotPassword } from "@/lib/api"

export function ResetPasswordForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!email) {
      setError("Email is required")
      return
    }

    setLoading(true)
    const res = await forgotPassword(email)
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
            Reset your password
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

          {success && (
            <div className="rounded-[8px] bg-green-50 px-[16px] py-[12px] font-[Inter,sans-serif] text-[14px] font-medium text-green-600">
              Check your email for a reset link
            </div>
          )}

          {!success && (
            <>
              <AuthInput
                icon={<Mail size={24} className="shrink-0 text-[rgba(108,114,117,0.5)]" />}
                type="email"
                placeholder="Email"
                value={email}
                onChange={setEmail}
              />

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-[8px] rounded-[12px] bg-[#2752F4] px-[24px] py-[14px] transition-colors hover:bg-[#1e44d4] disabled:opacity-50"
              >
                <span className="font-[Inter,sans-serif] text-[16px] font-semibold leading-[24px] tracking-[-0.32px] text-[#FEFEFE]">
                  {loading ? "Sending..." : "Reset password"}
                </span>
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
