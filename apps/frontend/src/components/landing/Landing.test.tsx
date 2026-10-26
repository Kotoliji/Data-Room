import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { Landing } from "./Landing"
import { login } from "@/lib/api"
import { useAuthConfig } from "@/lib/useAuthConfig"

vi.mock("@/lib/api", () => ({ login: vi.fn(), logout: vi.fn() }))
vi.mock("@/lib/useAuthConfig", () => ({ useAuthConfig: vi.fn() }))

const loginMock = vi.mocked(login)
const configMock = vi.mocked(useAuthConfig)
const DEMO = { email: "demo@acmecorp.dev", password: "DataRoomDemo2026" }

function renderLanding() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<p>Sign in page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const demoButton = () => screen.getAllByRole("button", { name: /try the live demo/i })[0]

beforeEach(() => {
  vi.clearAllMocks()
  configMock.mockReturnValue({ google_enabled: false, demo: DEMO })
})

describe("Landing", () => {
  it("signs straight into the demo room", async () => {
    loginMock.mockResolvedValue({ data: { id: 7, name: "Alex", email: DEMO.email, token: "t" }, error: null })
    renderLanding()
    await userEvent.click(demoButton())

    expect(loginMock).toHaveBeenCalledWith(DEMO)
    expect(JSON.parse(localStorage.getItem("user") ?? "{}")).toMatchObject({ id: 7, email: DEMO.email })
  })

  it("shows the error and stays on the page when the demo sign-in fails", async () => {
    loginMock.mockResolvedValue({ data: null, error: "Too many attempts" })
    renderLanding()
    await userEvent.click(demoButton())

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts")
    expect(localStorage.getItem("user")).toBeNull()
  })

  it("sends visitors to sign-in when the server has no demo account", async () => {
    configMock.mockReturnValue({ google_enabled: false, demo: null })
    renderLanding()
    await userEvent.click(demoButton())

    expect(loginMock).not.toHaveBeenCalled()
    expect(screen.getByText("Sign in page")).toBeInTheDocument()
  })

  it("stamps the typed email onto the watermark preview", async () => {
    renderLanding()
    const input = screen.getByLabelText("Viewer email")
    await userEvent.clear(input)
    await userEvent.type(input, "cfo@buyer.com")

    expect(screen.getByTestId("watermark-stamp")).toHaveTextContent(/^cfo@buyer\.com · \d{4}-\d{2}-\d{2}$/)
  })

  it("opens a folder on click and closes it on a second click", async () => {
    const user = userEvent.setup()  // one pointer that stays over the folder between clicks
    renderLanding()
    const hr = screen.getByRole("button", { name: /4\. HR, 3 documents/ })
    await user.click(hr)
    expect(hr).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: /1\. Corporate/ })).toHaveAttribute("aria-expanded", "false")

    await user.click(hr)
    expect(hr).toHaveAttribute("aria-expanded", "false")
  })
})
