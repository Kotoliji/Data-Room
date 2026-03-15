import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Mail, Lock, User, X } from "lucide-react"
import { AuthLogo } from "./AuthLogo"
import { AuthTabToggle } from "./AuthTabToggle"
import { SocialButtons } from "./SocialButtons"
import { OrDivider } from "./OrDivider"
import { AuthInput } from "./AuthInput"
import { register, API_BASE } from "@/lib/api"

export function CreateAccountForm() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [googlePrefilled, setGooglePrefilled] = useState(false)

  // Prefill from signed Google registration token
  useEffect(() => {
    const regToken = searchParams.get("google_reg")
    if (regToken) {
      setSearchParams({}, { replace: true })
      const controller = new AbortController()
      fetch(`${API_BASE}/api/v1/auth/google/verify?token=${encodeURIComponent(regToken)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.data && typeof res.data.email === "string") {
            if (typeof res.data.name === "string") setName(res.data.name)
            setEmail(res.data.email)
            setGooglePrefilled(true)
          } else {
            setError("Verification expired. Please try again.")
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") setError("Failed to verify account.")
        })
      return () => controller.abort()
    }
  }, [searchParams, setSearchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!name || !email || !password || !confirmPassword) {
      setError("All fields are required")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)
    const res = await register({ name, email, password })
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
        <AuthTabToggle activeTab="register" />
        <SocialButtons mode="register" />
        <OrDivider />

        <form
          className="flex w-full flex-col gap-[24px]"
          onSubmit={handleSubmit}
        >
          {googlePrefilled && (
            <div className="rounded-[8px] bg-blue-50 px-[16px] py-[12px] font-[Inter,sans-serif] text-[14px] font-medium text-blue-700">
              Google account detected. Please set a password to complete registration.
            </div>
          )}

          {error && (
            <div className="rounded-[8px] bg-red-50 px-[16px] py-[12px] font-[Inter,sans-serif] text-[14px] font-medium text-red-600">
              {error}
            </div>
          )}

          <div className="flex w-full flex-col gap-[16px]">
            <AuthInput
              icon={<User size={24} className="shrink-0 text-[rgba(108,114,117,0.5)]" />}
              placeholder="Name"
              value={name}
              onChange={setName}
            />
            <AuthInput
              icon={<Mail size={24} className="shrink-0 text-[rgba(108,114,117,0.5)]" />}
              type="email"
              placeholder="Email"
              value={email}
              onChange={setEmail}
            />
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
              {loading ? "Creating..." : "Create account"}
            </span>
          </button>

          <p className="w-full text-center font-[Inter,sans-serif] text-[12px] font-medium leading-[20px] tracking-[-0.24px] text-[#6C7275]">
            By creating an account, you agree to our{" "}
            <a href="/terms" className="text-[#343839] underline-offset-2 hover:underline">Terms of Service</a> and{" "}
            <a href="/privacy" className="text-[#343839] underline-offset-2 hover:underline">Privacy &amp; Cookie Statement</a>.
          </p>
        </form>
      </div>
    </div>
  )
}
