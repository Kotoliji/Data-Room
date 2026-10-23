import { useEffect, useState } from "react"
import { FileText, Loader2, MessageCircleQuestion, X } from "lucide-react"
import type { Question } from "@/lib/types"
import { askQuestion, getMyQuestions } from "@/lib/api"
import { timeAgo } from "@/lib/utils"

export interface QuestionContext {
  fileId: number
  fileName: string
  page?: number
}

interface QuestionsPanelProps {
  token: string
  access: string
  context?: QuestionContext
  onClose: () => void
}

export function QuestionsPanel({ token, access, context, onClose }: QuestionsPanelProps) {
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMyQuestions(token, access).then((res) => setQuestions(res.data?.questions ?? []))
  }, [token, access])

  const handleAsk = async () => {
    setSending(true)
    setError(null)
    const res = await askQuestion(token, access, body.trim(), context?.fileId, context?.page)
    setSending(false)
    if (!res.data) {
      setError(res.error)
      return
    }
    const asked = res.data
    setQuestions((prev) => [asked, ...(prev ?? [])])
    setBody("")
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[rgba(20,23,24,0.6)]" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[440px] flex-col bg-[var(--dr-main-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        aria-label="Questions"
      >
        <div className="flex items-center gap-2 border-b border-[var(--dr-card-border)] px-5 py-4">
          <MessageCircleQuestion size={18} className="text-[#3E90F0]" />
          <h2 className="flex-1 font-[Inter,sans-serif] text-[16px] font-bold text-[var(--dr-main-title)]">Questions</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-[6px] hover:bg-[var(--dr-card-border)]">
            <X size={18} className="text-[var(--dr-main-title)]" />
          </button>
        </div>

        <div className="flex flex-col gap-2 border-b border-[var(--dr-card-border)] px-5 py-4">
          {context && (
            <span className="flex items-center gap-1 font-[Karla,sans-serif] text-[12px] text-[var(--dr-main-subtitle)]">
              <FileText size={13} /> About <span className="font-semibold">{context.fileName}</span>{context.page ? `, page ${context.page}` : ""}
            </span>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Ask the seller a question…"
            className="w-full resize-none rounded-[12px] border-2 border-[var(--dr-card-border)] bg-transparent px-3 py-2 font-[Karla,sans-serif] text-[14px] text-[var(--dr-main-title)] outline-none focus:border-[#3e90f0]"
          />
          {error && <p className="font-[Karla,sans-serif] text-[13px] text-red-500">{error}</p>}
          <button
            onClick={handleAsk}
            disabled={sending || body.trim().length < 3}
            className="self-end rounded-[10px] bg-[#141718] px-4 py-2 font-[Inter,sans-serif] text-[13px] font-semibold text-white hover:bg-[#232627] disabled:opacity-40 dark:bg-[#fefefe] dark:text-[#141718]"
          >
            {sending ? "Sending…" : "Send question"}
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {questions === null ? (
            <Loader2 size={20} className="mx-auto mt-6 animate-spin text-[var(--dr-main-subtitle)]" />
          ) : questions.length === 0 ? (
            <p className="mt-6 text-center font-[Karla,sans-serif] text-[14px] text-[var(--dr-main-subtitle)]">You haven't asked anything yet</p>
          ) : questions.map((q) => (
            <div key={q.id} className="flex flex-col gap-2 rounded-[12px] border border-[var(--dr-card-border)] p-3">
              <div className="flex items-center justify-between gap-2 font-[Karla,sans-serif] text-[11px] text-[var(--dr-main-subtitle)]">
                <span className="truncate">{q.file_name ? `${q.file_name}${q.page ? ` · p. ${q.page}` : ""}` : "General"}</span>
                <span className="shrink-0">{timeAgo(q.created_at)}</span>
              </div>
              <p className="font-[Karla,sans-serif] text-[14px] text-[var(--dr-main-title)]">{q.body}</p>
              {q.answer ? (
                <p className="rounded-[10px] bg-[#3E90F0]/10 px-3 py-2 font-[Karla,sans-serif] text-[13px] text-[var(--dr-main-title)]">
                  <span className="font-semibold">Answer: </span>{q.answer}
                </p>
              ) : (
                <span className="font-[Karla,sans-serif] text-[12px] text-amber-600">Awaiting answer</span>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
