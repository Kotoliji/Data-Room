import { useEffect, useState } from "react"
import { FileText, Loader2, Quote, Sparkles } from "lucide-react"
import type { DraftAnswer, OwnerQuestion } from "@/lib/types"
import { answerQuestion, draftAnswer, getQuestions } from "@/lib/api"
import { timeAgo } from "@/lib/utils"

const muted = "font-[Karla,sans-serif] text-[12px] text-[var(--dr-main-subtitle)]"

function QuestionCard({ question, onAnswered }: { question: OwnerQuestion; onAnswered: (q: OwnerQuestion) => void }) {
  const [text, setText] = useState("")
  const [draft, setDraft] = useState<DraftAnswer | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [sending, setSending] = useState(false)

  const handleDraft = async () => {
    setDrafting(true)
    const res = await draftAnswer(question.id)
    setDrafting(false)
    if (res.data) {
      setDraft(res.data)
      setText(res.data.answer)
    }
  }

  const handleSend = async () => {
    setSending(true)
    const res = await answerQuestion(question.id, text.trim())
    setSending(false)
    if (res.data) onAnswered(res.data)
  }

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-[var(--dr-card-border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-[Inter,sans-serif] text-[13px] font-semibold text-[var(--dr-main-title)]">{question.viewer_email}</span>
        <span className={muted}>via “{question.link_name}” · {timeAgo(question.created_at)}</span>
      </div>
      {question.file_name && (
        <span className={`flex items-center gap-1 ${muted}`}>
          <FileText size={13} /> {question.file_name}{question.page ? `, page ${question.page}` : ""}
        </span>
      )}
      <p className="font-[Karla,sans-serif] text-[15px] text-[var(--dr-main-title)]">{question.body}</p>

      {question.answer ? (
        <p className="rounded-[10px] bg-[#3E90F0]/10 px-3 py-2 font-[Karla,sans-serif] text-[14px] text-[var(--dr-main-title)]">
          <span className="font-semibold">Your answer: </span>{question.answer}
        </p>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Write an answer…"
            className="w-full resize-none rounded-[12px] border-2 border-[var(--dr-card-border)] bg-transparent px-3 py-2 font-[Karla,sans-serif] text-[14px] text-[var(--dr-main-title)] outline-none focus:border-[#3e90f0]"
          />
          {draft && (
            <div className="flex flex-col gap-1 rounded-[10px] bg-[var(--dr-card-border)]/40 px-3 py-2">
              <span className={muted}>
                Draft by {draft.source === "claude" ? "Claude" : "keyword search"} from documents this viewer can access ·{" "}
                {draft.citations.length ? `${draft.citations.length} verified citation${draft.citations.length === 1 ? "" : "s"}` : "no supporting passages found"}
              </span>
              {draft.citations.map((c, i) => (
                <span key={i} className="flex gap-2 font-[Karla,sans-serif] text-[12px] text-[var(--dr-main-title)]">
                  <Quote size={12} className="mt-[3px] shrink-0 text-[var(--dr-main-subtitle)]" />
                  <span><span className="italic">“{c.quote}”</span> <span className="text-[var(--dr-main-subtitle)]">— {c.file_name}</span></span>
                </span>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleDraft}
              disabled={drafting}
              className="flex items-center gap-1 rounded-[10px] border border-[var(--dr-card-border)] px-3 py-2 font-[Inter,sans-serif] text-[13px] font-semibold text-[var(--dr-main-title)] hover:bg-[var(--dr-card-border)]/40 disabled:opacity-50"
            >
              {drafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Draft with AI
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="rounded-[10px] bg-[#141718] px-4 py-2 font-[Inter,sans-serif] text-[13px] font-semibold text-white hover:bg-[#232627] disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send answer"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function QAView() {
  const [status, setStatus] = useState<"open" | "answered">("open")
  const [questions, setQuestions] = useState<OwnerQuestion[] | null>(null)
  const [openCount, setOpenCount] = useState(0)

  useEffect(() => {
    getQuestions(status).then((res) => {
      setQuestions(res.data?.questions ?? [])
      setOpenCount(res.data?.open_count ?? 0)
    })
  }, [status])

  const switchTo = (next: "open" | "answered") => {
    setQuestions(null)
    setStatus(next)
  }

  const handleAnswered = (answered: OwnerQuestion) => {
    setQuestions((prev) => prev?.filter((q) => q.id !== answered.id) ?? null)
    setOpenCount((n) => Math.max(0, n - 1))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-6 pb-10 md:px-[40px] md:pt-[40px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[Inter,sans-serif] text-[20px] font-bold tracking-[-0.4px] text-[var(--dr-main-title)] md:text-[28px]">Q&A</h2>
          <p className="mt-1 font-[Karla,sans-serif] text-[14px] text-[var(--dr-main-subtitle)]">Questions from people you shared the data room with</p>
        </div>
        <div className="flex gap-1 rounded-[10px] bg-[var(--dr-card-border)]/50 p-[3px]">
          {(["open", "answered"] as const).map((s) => (
            <button
              key={s}
              onClick={() => switchTo(s)}
              className={`rounded-[8px] px-3 py-[6px] font-[Inter,sans-serif] text-[13px] font-semibold capitalize ${
                status === s ? "bg-[var(--dr-main-bg)] text-[var(--dr-main-title)] shadow-sm" : "text-[var(--dr-main-subtitle)]"
              }`}
            >
              {s}{s === "open" && openCount > 0 ? ` (${openCount})` : ""}
            </button>
          ))}
        </div>
      </div>

      {questions === null ? (
        <Loader2 size={26} className="mx-auto mt-16 animate-spin text-[var(--dr-main-subtitle)]" />
      ) : questions.length === 0 ? (
        <p className="mt-16 text-center font-[Karla,sans-serif] text-[15px] text-[var(--dr-main-subtitle)]">
          {status === "open" ? "No open questions — viewers can ask from any shared link" : "Nothing answered yet"}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q) => <QuestionCard key={q.id} question={q} onAnswered={handleAnswered} />)}
        </div>
      )}
    </div>
  )
}
