import { useEffect, useState } from "react"
import { ChevronDown, Copy, Download, Eye, Link2, Loader2, Lock, LogIn, Ban } from "lucide-react"
import type { ShareAccessEntry, ShareLink } from "@/lib/types"
import { getShareAccesses, getShares, revokeShare, shareUrl } from "@/lib/api"
import { timeAgo } from "@/lib/utils"
import { ShareAnalyticsPanel } from "./ShareAnalyticsPanel"

const ACCESS_CONFIG: Record<ShareAccessEntry["action"], { icon: typeof Eye; color: string; label: string }> = {
  opened: { icon: LogIn, color: "text-[#3E90F0]", label: "Opened the link" },
  viewed: { icon: Eye, color: "text-[#8E55EA]", label: "Viewed" },
  downloaded: { icon: Download, color: "text-[#3FDD78]", label: "Downloaded" },
}

function StatusBadge({ link }: { link: ShareLink }) {
  const [label, cls] = link.revoked
    ? ["Revoked", "bg-red-500/10 text-red-500"]
    : link.expired
      ? ["Expired", "bg-amber-500/10 text-amber-600"]
      : ["Active", "bg-[#3FDD78]/15 text-[#1f9d55]"]
  return <span className={`rounded-full px-[8px] py-[2px] text-[11px] font-semibold ${cls}`}>{label}</span>
}

function AccessTrail({ linkId }: { linkId: number }) {
  const [entries, setEntries] = useState<ShareAccessEntry[] | null>(null)

  useEffect(() => {
    getShareAccesses(linkId).then((res) => setEntries(res.data?.accesses ?? []))
  }, [linkId])

  if (entries === null) {
    return <Loader2 size={18} className="mx-auto my-3 animate-spin text-[var(--dr-main-subtitle)]" />
  }
  if (entries.length === 0) {
    return <p className="px-4 py-3 font-[Karla,sans-serif] text-[13px] text-[var(--dr-main-subtitle)]">Nobody has opened this link yet</p>
  }
  return (
    <div className="flex flex-col">
      {entries.map((e) => {
        const cfg = ACCESS_CONFIG[e.action]
        const Icon = cfg.icon
        return (
          <div key={e.id} className="flex items-center gap-3 px-4 py-2">
            <Icon size={15} className={`shrink-0 ${cfg.color}`} />
            <span className="min-w-0 flex-1 truncate font-[Karla,sans-serif] text-[13px] text-[var(--dr-main-title)]">
              <span className="font-semibold">{e.viewer_email}</span>
              <span className="text-[var(--dr-main-subtitle)]"> · {cfg.label}{e.file_name ? ` ${e.file_name}` : ""}</span>
            </span>
            <span className="shrink-0 font-[Karla,sans-serif] text-[12px] text-[var(--dr-main-subtitle)]">{timeAgo(e.created_at)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function SharingView() {
  const [links, setLinks] = useState<ShareLink[] | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [panel, setPanel] = useState<"Analytics" | "Access log">("Analytics")

  useEffect(() => {
    getShares().then((res) => setLinks(res.data?.shares ?? []))
  }, [])

  const handleCopy = async (link: ShareLink) => {
    await navigator.clipboard.writeText(shareUrl(link.token))
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRevoke = async (link: ShareLink) => {
    const res = await revokeShare(link.id)
    if (res.data) {
      const updated = res.data
      setLinks((prev) => prev?.map((l) => (l.id === updated.id ? updated : l)) ?? null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-6 pb-10 md:px-[40px] md:pt-[40px]">
      <div className="mb-6">
        <h2 className="font-[Inter,sans-serif] text-[20px] font-bold tracking-[-0.4px] text-[var(--dr-main-title)] md:text-[28px]">
          Sharing
        </h2>
        <p className="mt-1 font-[Karla,sans-serif] text-[14px] text-[var(--dr-main-subtitle)]">
          Links you gave to investors and advisors, and who opened what
        </p>
      </div>

      {links === null ? (
        <div className="flex flex-1 items-center justify-center pb-[80px]">
          <Loader2 size={28} className="animate-spin text-[var(--dr-main-subtitle)]" />
        </div>
      ) : links.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 pb-[80px] text-center">
          <p className="font-[Inter,sans-serif] text-[18px] font-semibold text-[var(--dr-main-title)]">No shared links yet</p>
          <p className="max-w-[360px] font-[Karla,sans-serif] text-[15px] text-[var(--dr-main-subtitle)]">
            Open a folder in the Data Room and click <span className="font-semibold">Share</span> to give external parties secure access
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {links.map((link) => {
            const live = !link.revoked && !link.expired
            const isOpen = expanded === link.id
            return (
              <div key={link.id} className="overflow-hidden rounded-[14px] border border-[var(--dr-card-border)]">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--dr-card-border)]">
                    <Link2 size={18} className="text-[#3E90F0]" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-[Inter,sans-serif] text-[14px] font-semibold text-[var(--dr-main-title)]">{link.name}</span>
                      <StatusBadge link={link} />
                    </div>
                    <span className="flex flex-wrap items-center gap-x-2 font-[Karla,sans-serif] text-[13px] text-[var(--dr-main-subtitle)]">
                      {link.folder_name ?? "Entire Data Room"}
                      {link.has_password && <Lock size={12} />}
                      <span>· {link.allow_download ? "downloads allowed" : "view only"}</span>
                      <span>· {link.viewer_count} viewer{link.viewer_count === 1 ? "" : "s"}</span>
                      {link.last_access_at && <span>· last opened {timeAgo(link.last_access_at)}</span>}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {live && (
                      <>
                        <button
                          onClick={() => handleCopy(link)}
                          className="flex items-center gap-1 rounded-[10px] border border-[var(--dr-card-border)] px-3 py-[6px] font-[Inter,sans-serif] text-[12px] font-semibold text-[var(--dr-main-title)] hover:bg-[var(--dr-card-border)]/40"
                        >
                          <Copy size={13} /> {copiedId === link.id ? "Copied" : "Copy link"}
                        </button>
                        <button
                          onClick={() => handleRevoke(link)}
                          className="flex items-center gap-1 rounded-[10px] border border-[var(--dr-card-border)] px-3 py-[6px] font-[Inter,sans-serif] text-[12px] font-semibold text-[var(--dr-main-subtitle)] hover:border-red-300 hover:text-red-500"
                        >
                          <Ban size={13} /> Revoke
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpanded(isOpen ? null : link.id)}
                      aria-label="Show analytics"
                      className="rounded-full p-[6px] text-[var(--dr-main-subtitle)] hover:bg-[var(--dr-card-border)]/40"
                    >
                      <ChevronDown size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-[var(--dr-card-border)]">
                    <div className="flex gap-1 px-4 pt-3">
                      {(["Analytics", "Access log"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setPanel(t)}
                          className={`rounded-[8px] px-3 py-[5px] font-[Inter,sans-serif] text-[12px] font-semibold transition-colors ${
                            panel === t ? "bg-[var(--dr-card-border)] text-[var(--dr-main-title)]" : "text-[var(--dr-main-subtitle)] hover:text-[var(--dr-main-title)]"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    {panel === "Analytics" ? <ShareAnalyticsPanel linkId={link.id} /> : <div className="py-1"><AccessTrail linkId={link.id} /></div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
