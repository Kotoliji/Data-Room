import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { InsightBadges } from "./InsightBadges"

describe("InsightBadges", () => {
  it("shows the category and a sensitive-data warning naming what was found", () => {
    render(
      <InsightBadges
        insight={{
          status: "ready",
          category: "HR",
          summary: "Payroll for 2026",
          source: "heuristic",
          sensitive: [{ kind: "compensation", detail: "" }, { kind: "bank_details", detail: "" }],
        }}
      />,
    )
    expect(screen.getByText("HR")).toHaveAttribute("title", "Payroll for 2026")
    expect(screen.getByText("Sensitive").closest("span")).toHaveAttribute(
      "title",
      "Contains: Compensation, Bank details — review before sharing",
    )
  })

  it("shows nothing but a spinner while classification is pending", () => {
    render(<InsightBadges insight={{ status: "pending", category: null, summary: null, source: null, sensitive: [] }} />)
    expect(screen.getByTitle("Classifying…")).toBeInTheDocument()
    expect(screen.queryByText("Sensitive")).not.toBeInTheDocument()
  })

  it("tags content-search hits with the matching snippet", () => {
    render(<InsightBadges snippet="…terminate the lease with 90 days notice…" />)
    expect(screen.getByText("in text").closest("span")).toHaveAttribute("title", "…terminate the lease with 90 days notice…")
  })
})
