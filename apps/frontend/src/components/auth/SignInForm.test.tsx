import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { SignInForm } from "./SignInForm"
import { login } from "@/lib/api"
import { useAuthConfig } from "@/lib/useAuthConfig"

vi.mock("@/lib/api", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  exchangeGoogleCode: vi.fn(),
  getGoogleLoginUrl: vi.fn(() => "/google"),
}))
vi.mock("@/lib/useAuthConfig", () => ({ useAuthConfig: vi.fn() }))

const loginMock = vi.mocked(login)
const configMock = vi.mocked(useAuthConfig)

function renderSignIn() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<SignInForm />} />
        <Route path="/" element={<p>Data room home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup()
  if (email) await user.type(screen.getByLabelText("Email"), email)
  if (password) await user.type(screen.getByLabelText("Password"), password)
  await user.click(screen.getByRole("button", { name: /sign in with acme corp/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  configMock.mockReturnValue({ google_enabled: false, demo: null })
})

describe("SignInForm", () => {
  it("validates empty fields without calling the API", async () => {
    renderSignIn()
    await fillAndSubmit("", "")
    expect(screen.getByText("Email and password are required")).toBeInTheDocument()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it("shows the server error and stays on the page", async () => {
    loginMock.mockResolvedValue({ data: null, error: "Invalid email or password" })
    renderSignIn()
    await fillAndSubmit("a@acme.io", "wrong-pass")
    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument()
    expect(localStorage.getItem("auth_token")).toBeNull()
  })

  it("stores the session and opens the data room on success", async () => {
    loginMock.mockResolvedValue({ data: { id: 1, name: "Alex", email: "a@acme.io", token: "tok-1" }, error: null })
    renderSignIn()
    await fillAndSubmit("a@acme.io", "password123")

    expect(await screen.findByText("Data room home")).toBeInTheDocument()
    expect(loginMock).toHaveBeenCalledWith({ email: "a@acme.io", password: "password123" })
    // The token stays in the server's HttpOnly cookie; only the profile is kept for the UI
    expect(JSON.stringify({ ...localStorage })).not.toContain("tok-1")
    expect(JSON.parse(localStorage.getItem("user") ?? "{}")).toMatchObject({ id: 1, name: "Alex", email: "a@acme.io" })
  })

  it("signs in with one click when the server offers a demo account", async () => {
    configMock.mockReturnValue({ google_enabled: false, demo: { email: "demo@acmecorp.dev", password: "demo-pass" } })
    loginMock.mockResolvedValue({ data: { id: 1, name: "Demo", email: "demo@acmecorp.dev", token: "t" }, error: null })
    renderSignIn()

    await userEvent.setup().click(screen.getByRole("button", { name: /try the demo account/i }))

    expect(loginMock).toHaveBeenCalledWith({ email: "demo@acmecorp.dev", password: "demo-pass" })
    expect(await screen.findByText("Data room home")).toBeInTheDocument()
  })

  it("only offers Google sign-in when the server has it configured", () => {
    renderSignIn()
    expect(screen.queryByText("Continue with Google")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /try the demo account/i })).not.toBeInTheDocument()
  })

  it("shows Google sign-in when configured", () => {
    configMock.mockReturnValue({ google_enabled: true, demo: null })
    renderSignIn()
    expect(screen.getByText("Continue with Google")).toBeInTheDocument()
  })
})
