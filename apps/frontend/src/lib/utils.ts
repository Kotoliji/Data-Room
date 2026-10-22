import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1048576) return `${(size / 1024).toFixed(0)} KB`
  return `${(size / 1048576).toFixed(1)} MB`
}

/** Server timestamps are UTC but serialized without an offset — parse them as UTC. */
export function parseServerDate(dateStr: string): Date {
  return new Date(/(?:[zZ]|[+-]\d\d:\d\d)$/.test(dateStr) ? dateStr : `${dateStr}Z`)
}

export function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = parseServerDate(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return parseServerDate(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m ${seconds % 60}s`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}
