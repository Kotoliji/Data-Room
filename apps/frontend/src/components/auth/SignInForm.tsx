import { useState, useEffect } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Mail, Lock, X } from "lucide-react"
import { AuthLogo } from "./AuthLogo"
import { AuthTabToggle } from "./AuthTabToggle"
import { SocialButtons } from "./SocialButtons"
import { OrDivider } from "./OrDivider"
import { AuthInput } from "./AuthInput"
import { login, exchangeGoogleCode } from "@/lib/api"

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  account_exists: "An account with this email already exists. Please sign in.",
  no_account: "No account found with this Google email. Please register first.",
  invalid_state: "Google login session expired. Please try again.",
  token_exchange_failed: "Failed to connect with Google. Please try again.",
  verification_failed: "Could not verify your Google account. Please try again.",
  no_email: "Could not get email from Google. Please try again.",
}

export function SignInForm() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Handle Google login callback
  useEffect(() => {
    const googleCode = searchParams.get("google_code")
    const googleError = searchParams.get("google_error")

    if (googleCode) {
      setSearchParams({}, { replace: true })
      exchangeGoogleCode(googleCode).then((res) => {
        if (res.data && typeof res.data.token === "string" && typeof res.data.id === "number") {
          const { token, ...user } = res.data
          localStorage.setItem("auth_token", token)
          localStorage.setItem("user", JSON.stringify(user))
          // Full page reload to reinitialize app state after login
          window.location.href = "/"
        } else {
          setError(res.error || "Google login failed")
        }
      }).catch(() => setError("Network error. Please try again."))
    } else if (googleError) {
      setError(GOOGLE_ERROR_MESSAGES[googleError] || `Google login error: ${googleError}`)
      setSearchParams({}, { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Email and password are required")
      return
    }

    setLoading(true)
    const res = await login({ email, password })
    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }

    if (res.data) {
      const { token, ...user } = res.data
      localStorage.setItem("auth_token", token)
      localStorage.setItem("user", JSON.stringify(user))
      navigate("/")
    }
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center self-stretch bg-[#FEFEFE] px-[32px] lg:rounded-[20px] lg:px-[200px] 2xl:px-[376px]">
      <button
        type="button"
        aria-label="Close"
        onClick={() => navigate("/")}
        className="absolute right-[24px] top-[24px] flex items-center justify-center rounded-full bg-[#F3F5F7] p-[8px] transition-colors hover:bg-[#E8ECEF]"
      >
        <X size={24} className="text-[#141718]" aria-hidden="true" />
      </button>

      <div className="flex w-full max-w-[504px] flex-col items-center gap-[32px]">
        <AuthLogo />
        <AuthTabToggle activeTab="signin" />
        <SocialButtons mode="login" />
        <OrDivider />

        <form
          className="flex w-full flex-col gap-[24px]"
          onSubmit={handleSubmit}
        >
          {error && (
            <div className="rounded-[8px] bg-red-50 px-[16px] py-[12px] font-[Inter,sans-serif] text-[14px] font-medium text-red-600">
              {error}
            </div>
          )}

          <div className="flex w-full flex-col gap-[16px]">
            <AuthInput
              icon={<Mail size={24} className="shrink-0 text-[rgba(108,114,117,0.5)]" />}
              placeholder="Email"
              value={email}
              onChange={setEmail}
            />
            <div className="flex w-full flex-col gap-[8px]">
              <AuthInput
                icon={<Lock size={24} className="shrink-0 text-[rgba(108,114,117,0.5)]" />}
                type="password"
                placeholder="Password"
                value={password}
                onChange={setPassword}
              />
              <Link
                to="/forgot-password"
                className="font-[Inter,sans-serif] text-[14px] font-medium leading-[24px] tracking-[-0.14px] text-[#2752F4]"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-[8px] rounded-[12px] bg-[#2752F4] px-[24px] py-[14px] transition-colors hover:bg-[#1e44d4] disabled:opacity-50"
          >
            <span className="font-[Inter,sans-serif] text-[16px] font-semibold leading-[24px] tracking-[-0.32px] text-[#FEFEFE]">
              {loading ? "Signing in..." : "Sign in with Acme Corp"}
            </span>
          </button>
        </form>
      </div>
    </div>
  )
}
