import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { ChevronRight, Download, Eye, FileText, Folder, Loader2, Lock, MessageCircleQuestion, ShieldCheck } from "lucide-react"
import type { PublicShareContents, PublicShareFile, PublicShareInfo } from "@/lib/types"
import { getPublicShare, getShareContents, sharedFilePagesUrl, sharedFileUrl, unlockShare } from "@/lib/api"
import { LazyPdfViewer as PdfViewer } from "@/components/viewer/LazyPdfViewer"
import { QuestionsPanel, type QuestionContext } from "./QuestionsPanel"
import { formatSize } from "@/lib/utils"

const isPdf = (f: PublicShareFile) => f.mime_type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")

const storageKey = (token: string) => `share_access:${token}`

function readAccess(token: string): string | null {
  try { return sessionStorage.getItem(storageKey(token)) } catch { return null }
}

function writeAccess(token: string, access: string | null) {
  try {
    if (access) sessionStorage.setItem(storageKey(token), access)
    else sessionStorage.removeItem(storageKey(token))
  } catch { /* private mode — access just won't survive a reload */ }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--dr-shell-bg)] px-4 py-8 md:py-14">
      <div className="mb-6 font-['Noto_Sans',sans-serif] text-[24px] font-bold text-[var(--dr-sidebar-title)]">Acme Corp</div>
      <div className="w-full max-w-[880px] rounded-[20px] border border-[var(--dr-main-border)] bg-[var(--dr-main-bg)] p-5 md:p-8" style={{ boxShadow: "var(--dr-main-shadow)" }}>
        {children}
      </div>
      <p className="mt-6 flex items-center gap-2 font-[Karla,sans-serif] text-[12px] text-[var(--dr-sidebar-text-muted)]">
        <ShieldCheck size={14} /> Access to this Data Room is logged
      </p>
    </div>
  )
}

function Gate({ info, onUnlock }: { info: PublicShareInfo; onUnlock: (email: string, password: string) => Promise<string | null> }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputClass = "w-full rounded-[12px] border-2 border-[var(--dr-card-border)] bg-transparent px-[14px] py-[10px] font-[Inter,sans-serif] text-[14px] text-[var(--dr-main-title)] outline-none focus:border-[#3e90f0]"

  return (
    <form
      className="mx-auto flex max-w-[380px] flex-col gap-4 py-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(await onUnlock(email, password))
        setBusy(false)
      }}
    >
      <div>
        <h1 className="font-[Inter,sans-serif] text-[22px] font-bold text-[var(--dr-main-title)]">{info.name}</h1>
        <p className="mt-1 font-[Karla,sans-serif] text-[14px] text-[var(--dr-main-subtitle)]">
          {info.owner_name} shared documents with you. Enter your email to continue.
        </p>
      </div>
      <input className={inputClass} type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      {info.requires_password && (
        <input className={inputClass} type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      )}
      {error && <p className="font-[Karla,sans-serif] text-[13px] text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="flex items-center justify-center gap-2 rounded-[12px] bg-[#141718] py-[12px] font-[Inter,sans-serif] text-[14px] font-semibold text-white hover:bg-[#232627] disabled:opacity-50 dark:bg-[#fefefe] dark:text-[#141718]"
      >
        {info.requires_password && <Lock size={15} />} {busy ? "Opening..." : "Open Data Room"}
      </button>
    </form>
  )
}

export function PublicShare() {
  const { token = "" } = useParams()
  const [info, setInfo] = useState<PublicShareInfo | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const [access, setAccess] = useState<string | null>(() => readAccess(token))
  const [folderId, setFolderId] = useState<number | undefined>(undefined)
  const [contents, setContents] = useState<PublicShareContents | null>(null)
  const [openPdf, setOpenPdf] = useState<PublicShareFile | null>(null)
  const [questions, setQuestions] = useState<{ context?: QuestionContext } | null>(null)

  useEffect(() => {
    getPublicShare(token).then((res) => (res.data ? setInfo(res.data) : setFatal(res.error)))
  }, [token])

  useEffect(() => {
    if (!access) return
    let cancelled = false
    getShareContents(token, access, folderId).then((res) => {
      if (cancelled) return
      if (res.data) {
        setContents(res.data)
      } else {
        writeAccess(token, null)  // expired or revoked — ask for email again
        setAccess(null)
      }
    })
    return () => { cancelled = true }
  }, [token, access, folderId])

  const openFolder = (id: number | undefined) => {
    setContents(null)
    setFolderId(id)
  }

  const handleUnlock = async (email: string, password: string) => {
    const res = await unlockShare(token, email, password)
    if (!res.data) return res.error
    writeAccess(token, res.data.access_token)
    setAccess(res.data.access_token)
    return null
  }

  if (fatal) {
    return (
      <Shell>
        <div className="py-10 text-center">
          <h1 className="font-[Inter,sans-serif] text-[20px] font-bold text-[var(--dr-main-title)]">Link unavailable</h1>
          <p className="mt-2 font-[Karla,sans-serif] text-[15px] text-[var(--dr-main-subtitle)]">{fatal}</p>
        </div>
      </Shell>
    )
  }
  if (!info) {
    return <Shell><Loader2 size={28} className="mx-auto my-10 animate-spin text-[var(--dr-main-subtitle)]" /></Shell>
  }
  if (!access) {
    return <Shell><Gate info={info} onUnlock={handleUnlock} /></Shell>
  }

  return (
    <Shell>
      <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex flex-wrap items-center gap-1 font-[Inter,sans-serif] text-[15px] font-semibold text-[var(--dr-main-subtitle)]">
        <button onClick={() => openFolder(undefined)} className="text-[20px] font-bold text-[var(--dr-main-title)] hover:underline md:text-[24px]">
          {info.name}
        </button>
        {contents?.path.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <ChevronRight size={16} />
            <button onClick={() => openFolder(p.id)} className="hover:text-[var(--dr-main-title)]">{p.name}</button>
          </span>
        ))}
      </div>
        <button
          onClick={() => setQuestions({})}
          className="flex shrink-0 items-center gap-2 rounded-[10px] border border-[var(--dr-card-border)] px-3 py-[6px] font-[Inter,sans-serif] text-[13px] font-semibold text-[var(--dr-main-title)] hover:bg-[var(--dr-card-border)]/40"
        >
          <MessageCircleQuestion size={15} /> Questions
        </button>
      </div>

      {!contents ? (
        <Loader2 size={24} className="mx-auto my-10 animate-spin text-[var(--dr-main-subtitle)]" />
      ) : contents.folders.length === 0 && contents.files.length === 0 ? (
        <p className="py-10 text-center font-[Karla,sans-serif] text-[15px] text-[var(--dr-main-subtitle)]">This folder is empty</p>
      ) : (
        <div className="flex flex-col gap-[2px]">
          {contents.folders.map((f) => (
            <button
              key={`d${f.id}`}
              onClick={() => openFolder(f.id)}
              className="flex items-center gap-4 rounded-[10px] px-3 py-3 text-left transition-colors hover:bg-[var(--dr-card-border)]/40"
            >
              <Folder size={20} style={{ color: f.color }} className="shrink-0" />
              <span className="flex-1 truncate font-[Inter,sans-serif] text-[14px] font-semibold text-[var(--dr-main-title)]">{f.name}</span>
              <ChevronRight size={16} className="text-[var(--dr-main-subtitle)]" />
            </button>
          ))}
          {contents.files.map((f) => (
            <div key={`f${f.id}`} className="flex items-center gap-4 rounded-[10px] px-3 py-3 transition-colors hover:bg-[var(--dr-card-border)]/40">
              <FileText size={20} className="shrink-0 text-[var(--dr-main-subtitle)]" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-[Inter,sans-serif] text-[14px] font-semibold text-[var(--dr-main-title)]">{f.name}</span>
                <span className="font-[Karla,sans-serif] text-[12px] text-[var(--dr-main-subtitle)]">{formatSize(f.size)}</span>
              </div>
              {f.viewable && isPdf(f) ? (
                <button onClick={() => setOpenPdf(f)} aria-label={`View ${f.name}`}
                        className="rounded-full p-[8px] text-[var(--dr-main-subtitle)] hover:bg-[var(--dr-card-border)] hover:text-[var(--dr-main-title)]">
                  <Eye size={17} />
                </button>
              ) : f.viewable && (
                <a href={sharedFileUrl(token, access, f.id)} target="_blank" rel="noreferrer" aria-label={`View ${f.name}`}
                   className="rounded-full p-[8px] text-[var(--dr-main-subtitle)] hover:bg-[var(--dr-card-border)] hover:text-[var(--dr-main-title)]">
                  <Eye size={17} />
                </a>
              )}
              {info.allow_download ? (
                <a href={sharedFileUrl(token, access, f.id, true)} aria-label={`Download ${f.name}`}
                   className="rounded-full p-[8px] text-[var(--dr-main-subtitle)] hover:bg-[var(--dr-card-border)] hover:text-[var(--dr-main-title)]">
                  <Download size={17} />
                </a>
              ) : !f.viewable && (
                <span className="font-[Karla,sans-serif] text-[12px] text-[var(--dr-main-subtitle)]">Preview unavailable</span>
              )}
            </div>
          ))}
        </div>
      )}
      {openPdf && (
        <PdfViewer
          url={sharedFileUrl(token, access, openPdf.id)}
          title={openPdf.name}
          onClose={() => setOpenPdf(null)}
          downloadUrl={info.allow_download ? sharedFileUrl(token, access, openPdf.id, true) : undefined}
          trackUrl={sharedFilePagesUrl(token, access, openPdf.id)}
          onAsk={(page) => setQuestions({ context: { fileId: openPdf.id, fileName: openPdf.name, page } })}
        />
      )}
      {questions && (
        <QuestionsPanel token={token} access={access} context={questions.context} onClose={() => setQuestions(null)} />
      )}
    </Shell>
  )
}
