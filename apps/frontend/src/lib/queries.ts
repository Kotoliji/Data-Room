import { QueryClient, useQuery } from "@tanstack/react-query"
import type { ApiResponse } from "./types"
import {
  getActivity, getAllFolders, getDiligence, getFiles, getQuestions, getShareAccesses,
  getShareAnalytics, getSharePreview, getShares, searchContent,
} from "./api"

export const queryClient = new QueryClient({
  defaultOptions: {
    // Show cached data instantly, then refresh in the background whenever a view mounts
    queries: { staleTime: 0, retry: 1, refetchOnWindowFocus: false },
  },
})

/** The API returns {data, error}; React Query wants a value or a thrown error. */
export async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const res = await request
  if (res.error || res.data === null) throw new Error(res.error ?? "Request failed")
  return res.data
}

export const keys = {
  files: ["files"] as const,
  folders: ["folders", "all"] as const,
  search: (q: string) => ["files", "search", q] as const,
  shares: ["shares"] as const,
  shareAnalytics: (id: number) => ["shares", id, "analytics"] as const,
  shareAccesses: (id: number) => ["shares", id, "accesses"] as const,
  sharePreview: (folderId: number | null) => ["shares", "preview", folderId] as const,
  diligence: ["diligence"] as const,
  questions: (status: "open" | "answered") => ["questions", status] as const,
  activity: (folderId?: string) => ["activity", folderId ?? "all"] as const,
}

const POLL_MS = 3000

export function useFiles(enabled: boolean) {
  return useQuery({
    queryKey: keys.files,
    queryFn: () => unwrap(getFiles()).then((d) => d.files),
    enabled,
    // Uploaded documents are classified in the background: poll only while any is pending
    refetchInterval: (query) => (query.state.data?.some((f) => f.insight?.status === "pending") ? POLL_MS : false),
  })
}

export function useAllFolders(enabled: boolean) {
  return useQuery({ queryKey: keys.folders, queryFn: () => unwrap(getAllFolders()).then((d) => d.folders), enabled })
}

export function useContentSearch(q: string) {
  return useQuery({
    queryKey: keys.search(q),
    queryFn: () => unwrap(searchContent(q)).then((d) => Object.fromEntries(d.results.map((r) => [r.file_id, r.snippet]))),
    enabled: q.length >= 3,
    staleTime: 60_000,
  })
}

export function useShares() {
  return useQuery({ queryKey: keys.shares, queryFn: () => unwrap(getShares()).then((d) => d.shares) })
}

export function useShareAnalytics(linkId: number) {
  return useQuery({ queryKey: keys.shareAnalytics(linkId), queryFn: () => unwrap(getShareAnalytics(linkId)) })
}

export function useShareAccesses(linkId: number) {
  return useQuery({ queryKey: keys.shareAccesses(linkId), queryFn: () => unwrap(getShareAccesses(linkId)).then((d) => d.accesses) })
}

export function useSharePreview(folderId: number | null) {
  return useQuery({ queryKey: keys.sharePreview(folderId), queryFn: () => unwrap(getSharePreview(folderId)) })
}

export function useDiligence() {
  return useQuery({
    queryKey: keys.diligence,
    queryFn: () => unwrap(getDiligence()),
    refetchInterval: (query) => (query.state.data?.pending ? POLL_MS : false),
  })
}

export function useQuestions(status: "open" | "answered") {
  return useQuery({ queryKey: keys.questions(status), queryFn: () => unwrap(getQuestions(status)) })
}

export function useActivity(folderId?: string) {
  return useQuery({ queryKey: keys.activity(folderId), queryFn: () => unwrap(getActivity(folderId)).then((d) => d.activity) })
}
