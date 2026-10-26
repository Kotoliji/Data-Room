import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { Layout } from "./Layout"
import * as api from "@/lib/api"
import { queryClient } from "@/lib/queries"
import { ThemeProvider } from "@/lib/theme"
import type { UploadedFile } from "@/lib/types"

// Every API call resolves empty unless a test says otherwise
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  const stubs = Object.fromEntries(
    Object.entries(actual).map(([name, value]) => [name, typeof value === "function" ? vi.fn(async () => ({ data: null, error: null })) : value]),
  )
  return { ...stubs, getGoogleDriveStatus: vi.fn(async () => false), getFileViewUrl: vi.fn(async () => null) }
})

const file = (id: number, name: string): UploadedFile => ({
  id, name, original_name: name, mime_type: "application/pdf", size: 2048, folder_id: "all",
  status: "uploaded", created_at: "2026-10-20T10:00:00",
  insight: { status: "ready", category: "Legal", summary: null, sensitive: [], source: "heuristic" },
})

function renderLayout() {
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  queryClient.clear()
  localStorage.setItem("user", JSON.stringify({ id: 1, name: "Alex", email: "a@acme.io" }))
  localStorage.setItem("auth_token", "t")
  vi.mocked(api.getFiles).mockResolvedValue({ data: { files: [file(1, "Office Lease.pdf"), file(2, "Board Minutes.pdf")] }, error: null })
  vi.mocked(api.getAllFolders).mockResolvedValue({ data: { folders: [] }, error: null })
  vi.mocked(api.getFolders).mockResolvedValue({ data: { folders: [] }, error: null })
})

describe("Layout", () => {
  it("shows the documents loaded from the server", async () => {
    renderLayout()
    expect(await screen.findByText("Office Lease.pdf")).toBeInTheDocument()
    expect(screen.getByText("Board Minutes.pdf")).toBeInTheDocument()
  })

  it("finds documents by text inside them, not only by name", async () => {
    vi.mocked(api.searchContent).mockResolvedValue({
      data: { results: [{ file_id: 2, snippet: "…approved the renewal of the lease…" }] }, error: null,
    })
    renderLayout()
    await screen.findByText("Office Lease.pdf")

    await userEvent.setup().type(screen.getByPlaceholderText(/text inside documents/i), "renewal")

    // Name filter hides the lease at once; the content hit arrives after the debounced server search
    await waitFor(() => expect(screen.queryByText("Office Lease.pdf")).not.toBeInTheDocument())
    const row = (await screen.findByText("Board Minutes.pdf")).closest("[data-file-id]") as HTMLElement
    expect(within(row).getByText("in text")).toBeInTheDocument()
    expect(api.searchContent).toHaveBeenCalledWith("renewal")
    expect(api.searchContent).toHaveBeenCalledTimes(1)  // debounced: one request, not one per keystroke
  })
})
