import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { PublicShare } from "./PublicShare"
import { getPublicShare, getShareContents, unlockShare } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  getPublicShare: vi.fn(),
  unlockShare: vi.fn(),
  getShareContents: vi.fn(),
  sharedFileUrl: vi.fn((token: string, _access: string, id: number) => `/files/${token}/${id}`),
  sharedFilePagesUrl: vi.fn(() => "/pages"),
  getMyQuestions: vi.fn(),
  askQuestion: vi.fn(),
}))

const info = { name: "Project Falcon", owner_name: "Alex Morgan", requires_password: true, allow_download: false, expires_at: null }
const contents = {
  path: [],
  folders: [{ id: 3, name: "Legal", color: "#3e90f0" }],
  files: [{ id: 7, name: "Deck.pdf", size: 2048, mime_type: "application/pdf", created_at: "2026-10-20T10:00:00", viewable: true }],
}

function renderShare() {
  render(
    <MemoryRouter initialEntries={["/s/falcon"]}>
      <Routes>
        <Route path="/s/:token" element={<PublicShare />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe("PublicShare", () => {
  it("asks for email and password, then shows the shared folder", async () => {
    vi.mocked(getPublicShare).mockResolvedValue({ data: info, error: null })
    vi.mocked(unlockShare).mockResolvedValue({ data: { access_token: "acc" }, error: null })
    vi.mocked(getShareContents).mockResolvedValue({ data: contents, error: null })
    renderShare()

    expect(await screen.findByText(/Alex Morgan shared documents with you/)).toBeInTheDocument()
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText("you@company.com"), "lp@fund.com")
    await user.type(screen.getByPlaceholderText("Password"), "s3cret")
    await user.click(screen.getByRole("button", { name: /open data room/i }))

    expect(unlockShare).toHaveBeenCalledWith("falcon", "lp@fund.com", "s3cret")
    expect(await screen.findByText("Deck.pdf")).toBeInTheDocument()
    expect(screen.getByText("Legal")).toBeInTheDocument()
    expect(getShareContents).toHaveBeenCalledWith("falcon", "acc", undefined)
    // View-only link: no download control
    expect(screen.queryByLabelText("Download Deck.pdf")).not.toBeInTheDocument()
  })

  it("shows the server error for a wrong password", async () => {
    vi.mocked(getPublicShare).mockResolvedValue({ data: info, error: null })
    vi.mocked(unlockShare).mockResolvedValue({ data: null, error: "Incorrect password" })
    renderShare()

    const user = userEvent.setup()
    await user.type(await screen.findByPlaceholderText("you@company.com"), "lp@fund.com")
    await user.type(screen.getByPlaceholderText("Password"), "nope")
    await user.click(screen.getByRole("button", { name: /open data room/i }))

    expect(await screen.findByText("Incorrect password")).toBeInTheDocument()
    expect(getShareContents).not.toHaveBeenCalled()
  })

  it("explains when a link has expired or was revoked", async () => {
    vi.mocked(getPublicShare).mockResolvedValue({ data: null, error: "This link has expired" })
    renderShare()
    expect(await screen.findByText("Link unavailable")).toBeInTheDocument()
    expect(screen.getByText("This link has expired")).toBeInTheDocument()
  })

  it("sends a returning viewer back to the email gate when access has expired", async () => {
    sessionStorage.setItem("share_access:falcon", "stale")
    vi.mocked(getPublicShare).mockResolvedValue({ data: { ...info, requires_password: false }, error: null })
    vi.mocked(getShareContents).mockResolvedValue({ data: null, error: "Access expired — please open the link again" })
    renderShare()

    expect(await screen.findByRole("button", { name: /open data room/i })).toBeInTheDocument()
    expect(sessionStorage.getItem("share_access:falcon")).toBeNull()
  })
})
