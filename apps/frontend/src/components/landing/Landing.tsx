import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, Loader2 } from "lucide-react"
import { login } from "@/lib/api"
import { startSession } from "@/lib/session"
import { useAuthConfig } from "@/lib/useAuthConfig"
import { FloatingFiles } from "./FloatingFiles"
import { FolderDesk } from "./FolderDesk"
import { FeatureCards, WatermarkDemo } from "./Showcase"

const REPO = "https://github.com/Kotoliji/Data-Room"
const STACK = ["React 19", "TypeScript", "TanStack Query", "Flask", "Postgres", "Claude API"]

type DemoState = "idle" | "loading" | "slow"

/** One-click entry into the shared demo room; falls back to the sign-in page when the server has no demo. */
function useDemoLogin() {
  const navigate = useNavigate()
  const config = useAuthConfig()
  const [state, setState] = useState<DemoState>("idle")
  const [error, setError] = useState("")

  async function open() {
    const demo = config?.demo
    if (!demo) {
      navigate("/login")
      return
    }
    setState("loading")
    setError("")
    // a free instance can take a while to wake up: say so instead of looking frozen
    const slow = setTimeout(() => setState("slow"), 4000)
    const res = await login({ email: demo.email, password: demo.password })
    clearTimeout(slow)
    if (res.data) {
      startSession(res.data)
      navigate("/")
      return
    }
    setState("idle")
    setError(res.error || "Could not open the demo. Please try again.")
  }

  return { open, state, error }
}

function DemoButton({ demo, size = "lg" }: { demo: ReturnType<typeof useDemoLogin>; size?: "lg" | "md" }) {
  const busy = demo.state !== "idle"
  return (
    <button
      type="button"
      onClick={demo.open}
      disabled={busy}
      className={`group flex items-center justify-center gap-2 rounded-[14px] bg-[#3E90F0] font-[Inter,sans-serif] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(62,144,240,0.7)] transition hover:bg-[#2F7FDC] disabled:opacity-80 ${size === "lg" ? "px-6 py-3.5 text-[16px]" : "px-4 py-2 text-[14px]"}`}
    >
      {busy && <Loader2 size={16} className="animate-spin" />}
      {demo.state === "slow" ? "Waking the free server…" : busy ? "Opening the demo…" : "Try the live demo"}
      {!busy && <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
    </button>
  )
}

export function Landing() {
  const demo = useDemoLogin()

  return (
    <div className="min-h-screen bg-[#0E1011] text-white">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0E1011]/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-4">
          <span className="font-['Noto_Sans',sans-serif] text-[22px] font-bold">Acme Corp</span>
          <div className="flex items-center gap-2 md:gap-4">
            <a href={REPO} target="_blank" rel="noreferrer" className="hidden font-[Inter,sans-serif] text-[14px] font-medium text-[#9BA1A6] hover:text-white sm:block">
              GitHub
            </a>
            <Link to="/login" className="rounded-[10px] px-3 py-2 font-[Inter,sans-serif] text-[14px] font-semibold text-[#E8ECEF] hover:bg-white/5">
              Sign in
            </Link>
            <Link to="/register" className="rounded-[10px] bg-white px-4 py-2 font-[Inter,sans-serif] text-[14px] font-semibold text-[#141718] hover:bg-[#E8ECEF]">
              Create account
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <FloatingFiles />
          <div aria-hidden className="pointer-events-none absolute left-[-10%] top-[-20%] size-[700px] rounded-full bg-[radial-gradient(circle,rgba(142,85,234,0.18)_0%,transparent_65%)]" />
          <div aria-hidden className="pointer-events-none absolute right-[-10%] top-[10%] size-[700px] rounded-full bg-[radial-gradient(circle,rgba(62,144,240,0.14)_0%,transparent_65%)]" />

          <div className="relative mx-auto grid max-w-[1240px] items-center gap-6 px-6 pb-20 pt-12 lg:grid-cols-[1fr_auto] lg:gap-10 lg:pb-28 lg:pt-16">
            <div className="max-w-[640px]">
              <p className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-[Inter,sans-serif] text-[12px] font-medium text-[#B4BAC0]">
                Virtual data room for M&A due diligence
              </p>
              <h1 className="mt-5 font-[Inter,sans-serif] text-balance text-[44px] font-bold leading-[1.05] tracking-[-1.5px] md:text-[54px]">
                Share the deal room.
                <span className="block bg-gradient-to-r from-[#8E55EA] to-[#3E90F0] bg-clip-text text-transparent">Know who read what.</span>
              </h1>
              <p className="mt-6 max-w-[560px] font-[Karla,sans-serif] text-[19px] leading-[30px] text-[#B4BAC0]">
                Import documents from Google Drive, share them through watermarked links, and see the time spent on every page. Claude sorts the room, checks it against a due-diligence list and drafts answers to buyer questions.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <DemoButton demo={demo} />
                <Link to="/register" className="rounded-[14px] border border-white/15 px-6 py-3.5 font-[Inter,sans-serif] text-[16px] font-semibold text-white hover:bg-white/5">
                  Create an account
                </Link>
              </div>
              <p className="mt-3 min-h-5 font-[Karla,sans-serif] text-[14px] text-[#6C7275]" role={demo.error ? "alert" : undefined}>
                {demo.error || "No sign-up needed for the demo. It resets on every restart, so click anything."}
              </p>
              <ul className="mt-8 flex flex-wrap gap-2" aria-label="Built with">
                {STACK.map((s) => (
                  <li key={s} className="rounded-[8px] bg-white/[0.05] px-2.5 py-1 font-[Inter,sans-serif] text-[12px] font-medium text-[#9BA1A6]">{s}</li>
                ))}
              </ul>
            </div>
            <FolderDesk />
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-6 py-20">
          <FeatureCards />
        </section>

        <section className="border-y border-white/5 bg-white/[0.015]">
          <div className="mx-auto max-w-[1240px] px-6 py-20">
            <WatermarkDemo />
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-6 py-24 text-center">
          <h2 className="font-[Inter,sans-serif] text-[32px] font-bold tracking-[-0.6px] md:text-[44px]">See it with a real deal</h2>
          <p className="mx-auto mt-4 max-w-[520px] font-[Karla,sans-serif] text-[18px] leading-7 text-[#B4BAC0]">
            The demo room holds a mock acquisition: four folders of documents, an investor link with viewing history and a buyer question waiting for an answer.
          </p>
          <div className="mt-8 flex justify-center">
            <DemoButton demo={demo} />
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-6 py-6 font-[Karla,sans-serif] text-[14px] text-[#6C7275]">
          <span>Acme Corp Data Room · portfolio project</span>
          <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-white">Source on GitHub</a>
        </div>
      </footer>
    </div>
  )
}
