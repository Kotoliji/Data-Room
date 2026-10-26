import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { ProtectedRoute } from "./ProtectedRoute"

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<ProtectedRoute><p>Data room</p></ProtectedRoute>} />
        <Route path="/login" element={<p>Sign in page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ProtectedRoute", () => {
  it("redirects anonymous visitors to the sign-in page", () => {
    renderAt("/")
    expect(screen.getByText("Sign in page")).toBeInTheDocument()
    expect(screen.queryByText("Data room")).not.toBeInTheDocument()
  })

  it("requires both the user and the token", () => {
    localStorage.setItem("user", JSON.stringify({ id: 1 }))
    renderAt("/")
    expect(screen.getByText("Sign in page")).toBeInTheDocument()
  })

  it("renders the page for signed-in users", () => {
    localStorage.setItem("user", JSON.stringify({ id: 1 }))
    localStorage.setItem("auth_token", "token")
    renderAt("/")
    expect(screen.getByText("Data room")).toBeInTheDocument()
  })
})
