import { useEffect, useState } from "react"
import { Check, Copy, Link2, ShieldAlert, X } from "lucide-react"
import type { ShareLink, SharePreview } from "@/lib/types"
import { createShare, getSharePreview, shareUrl } from "@/lib/api"
import { SENSITIVE_LABELS } from "@/lib/labels"
import { parseServerDate } from "@/lib/utils"

interface ShareDialogProps {
  folderId: number | null
  folderName: string
  onClose: () => void
}

const EXPIRY_OPTIONS: { label: string; days: number | null }[] = [
  { label: "Never", days: null },
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
]

const inputClass = "w-full rounded-[12px] border-2 border-[#e8ecef] bg-[#fefefe] px-[14px] py-[10px] text-[14px] text-[#141718] outline-none transition-colors focus:border-[#3e90f0]"

export function ShareDialog({ folderId, folderName, onClose }: ShareDialogProps) {
  const [name, setName] = useState(folderName)
  const [password, setPassword] = useState("")
  const [expiryDays, setExpiryDays] = useState<number | null>(7)
  const [allowDownload, setAllowDownload] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<ShareLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [preview, setPreview] = useState<SharePreview | null>(null)

  useEffect(() => {
    getSharePreview(folderId).then((res) => setPreview(res.data))
  }, [folderId])

  const handleCreate = async () => {
    setSaving(true)
    setError(null)
    const res = await createShare({
      folder_id: folderId,
      name: name.trim() || undefined,
      password: password || undefined,
      expires_in_days: expiryDays,
      allow_download: allowDownload,
    })
    setSaving(false)
    if (res.error || !res.data) {
      setError(res.error ?? "Could not create link")
      return
    }
    setLink(res.data)
  }

  const handleCopy = async () => {
    if (!link) return
    await navigator.clipboard.writeText(shareUrl(link.token))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,23,24,0.75)]" onClick={onClose}>
      <div
        className="relative mx-4 flex w-full max-w-[460px] flex-col gap-[20px] rounded-[24px] bg-[#fefefe] p-[24px] font-[Inter,sans-serif] md:p-[32px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-[16px] top-[16px] rounded-full bg-[#f3f5f7] p-[6px]">
          <X size={18} className="text-[#141718]" />
        </button>

        <div className="flex flex-col gap-[6px] pr-8">
          <h3 className="text-[18px] font-bold leading-[28px] text-[#141718]">Share “{folderName}”</h3>
          <p className="text-[14px] leading-[20px] text-[#6c7275]">
            External viewers enter their email to open the link. Every view and download is recorded.
          </p>
        </div>

        {link ? (
          <div className="flex flex-col gap-[16px]">
            <div className="flex items-center gap-2 rounded-[12px] border-2 border-[#e8ecef] px-[12px] py-[8px]">
              <Link2 size={16} className="shrink-0 text-[#6c7275]" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-[#141718]">{shareUrl(link.token)}</span>
              <button
                onClick={handleCopy}
                className="flex shrink-0 items-center gap-1 rounded-[8px] bg-[#141718] px-[10px] py-[6px] text-[12px] font-semibold text-white hover:bg-[#232627]"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-[13px] text-[#6c7275]">
              {link.has_password ? "Password protected · " : ""}
              {link.allow_download ? "Downloads allowed" : "View only"}
              {link.expires_at ? ` · expires ${parseServerDate(link.expires_at).toLocaleDateString()}` : " · no expiry"}
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="rounded-[12px] bg-[#141718] px-[20px] py-[10px] text-[14px] font-semibold text-white hover:bg-[#232627]">
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-[14px]">
            <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-[#141718]">
              Link name
              <input className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-[#141718]">
              Password <span className="font-normal text-[#6c7275]">(optional)</span>
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={password}
                placeholder="Leave empty for email-only access"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <div className="flex flex-col gap-[6px] text-[13px] font-semibold text-[#141718]">
              Expires
              <div className="grid grid-cols-4 gap-2">
                {EXPIRY_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setExpiryDays(opt.days)}
                    className={`rounded-[10px] border-2 py-[8px] text-[13px] font-semibold transition-colors ${
                      expiryDays === opt.days ? "border-[#141718] bg-[#141718] text-white" : "border-[#e8ecef] text-[#141718] hover:bg-[#f3f5f7]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-[10px] text-[14px] text-[#141718]">
              <input type="checkbox" className="size-[16px] accent-[#141718]" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} />
              Allow viewers to download files
            </label>

            {preview && preview.flagged.length > 0 && (
              <div className="flex flex-col gap-2 rounded-[12px] border border-amber-300 bg-amber-50 px-[14px] py-[10px]">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-amber-700">
                  <ShieldAlert size={15} /> {preview.flagged.length} of {preview.total} documents may contain sensitive data
                </span>
                <ul className="flex flex-col gap-[2px] text-[12px] text-amber-800">
                  {preview.flagged.slice(0, 4).map((f) => (
                    <li key={f.id} className="truncate">
                      <span className="font-semibold">{f.name}</span> — {f.sensitive.map((s) => SENSITIVE_LABELS[s.kind]).join(", ")}
                    </li>
                  ))}
                  {preview.flagged.length > 4 && <li>and {preview.flagged.length - 4} more</li>}
                </ul>
              </div>
            )}

            {error && <p className="text-[13px] text-red-500">{error}</p>}

            <div className="flex justify-end gap-[12px] pt-[4px]">
              <button onClick={onClose} className="rounded-[12px] border-2 border-[#e8ecef] px-[20px] py-[10px] text-[14px] font-semibold text-[#141718] hover:bg-[#f3f5f7]">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="rounded-[12px] bg-[#141718] px-[20px] py-[10px] text-[14px] font-semibold text-white hover:bg-[#232627] disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create link"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
