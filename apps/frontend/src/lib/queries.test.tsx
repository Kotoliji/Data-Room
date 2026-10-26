import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { getFiles, logout } from "./api"
import { keys, queryClient, unwrap, useFiles } from "./queries"
import { endSession, startSession } from "./session"
import type { UploadedFile } from "./types"

vi.mock("./api", () => ({ getFiles: vi.fn(), logout: vi.fn(async () => ({ data: { message: "ok" }, error: null })) }))

const file = (status: "pending" | "ready"): UploadedFile => ({
  id: 1, name: "a.pdf", original_name: "a.pdf", mime_type: "application/pdf", size: 1, folder_id: "all",
  status: "uploaded", created_at: "2026-10-20T10:00:00",
  insight: { status, category: status === "ready" ? "Legal" : null, summary: null, sensitive: [], source: null },
})

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>

beforeEach(() => {
  queryClient.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("unwrap", () => {
  it("turns API errors into thrown errors for React Query", async () => {
    await expect(unwrap(Promise.resolve({ data: null, error: "Nope" }))).rejects.toThrow("Nope")
    await expect(unwrap(Promise.resolve({ data: 5, error: null }))).resolves.toBe(5)
  })
})

describe("useFiles", () => {
  it("keeps polling while documents are being classified, then stops", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(getFiles)
      .mockResolvedValueOnce({ data: { files: [file("pending")] }, error: null })
      .mockResolvedValue({ data: { files: [file("ready")] }, error: null })

    const { result } = renderHook(() => useFiles(true), { wrapper })
    await waitFor(() => expect(result.current.data?.[0].insight?.status).toBe("pending"))

    await vi.advanceTimersByTimeAsync(3100)
    await waitFor(() => expect(result.current.data?.[0].insight?.status).toBe("ready"))

    const calls = vi.mocked(getFiles).mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(vi.mocked(getFiles).mock.calls.length).toBe(calls)
  })

  it("does not fetch for signed-out visitors", () => {
    renderHook(() => useFiles(false), { wrapper })
    expect(getFiles).not.toHaveBeenCalled()
  })
})

describe("session helpers", () => {
  it("drop cached data so the next account never sees the previous one's files", async () => {
    queryClient.setQueryData(keys.files, [file("ready")])
    startSession({ id: 2, name: "B", email: "b@acme.io", token: "secret-token" })
    expect(queryClient.getQueryData(keys.files)).toBeUndefined()

    queryClient.setQueryData(keys.files, [file("ready")])
    await endSession()
    expect(logout).toHaveBeenCalled()  // the server-side session is ended too
    expect(queryClient.getQueryData(keys.files)).toBeUndefined()
    expect(localStorage.getItem("user")).toBeNull()
  })

  it("never writes the session token where page scripts can read it", () => {
    startSession({ id: 2, name: "B", email: "b@acme.io", token: "secret-token" })
    expect(JSON.stringify({ ...localStorage })).not.toContain("secret-token")
    expect(JSON.parse(localStorage.getItem("user") ?? "{}")).toMatchObject({ id: 2, email: "b@acme.io" })
  })
})
