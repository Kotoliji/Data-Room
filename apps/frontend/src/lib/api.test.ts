import { afterEach, describe, expect, it, vi } from "vitest"
import { getProfile, login } from "./api"

function stubFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("API client", () => {
  it("sends the stored session token as a Bearer header", async () => {
    localStorage.setItem("auth_token", "abc123")
    const fetchMock = stubFetch(async () => json({ data: { id: 1, name: "A", email: "a@a.io" }, error: null }))

    const res = await getProfile()

    expect(res.data?.email).toBe("a@a.io")
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/auth\/me$/)
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer abc123")
  })

  it("sends no Authorization header when signed out", async () => {
    const fetchMock = stubFetch(async () => json({ data: null, error: null }))
    await getProfile()
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.headers).not.toHaveProperty("Authorization")
  })

  it("returns the server's error message on a failed request", async () => {
    stubFetch(async () => json({ data: null, error: "Invalid email or password" }, 401))
    const res = await login({ email: "a@a.io", password: "wrong" })
    expect(res).toEqual({ data: null, error: "Invalid email or password" })
  })

  it("falls back to the status code when the error body is not JSON", async () => {
    stubFetch(async () => new Response("<html>Bad gateway</html>", { status: 502 }))
    const res = await login({ email: "a@a.io", password: "x" })
    expect(res.error).toBe("Request failed (502)")
  })

  it("reports network failures instead of throwing", async () => {
    stubFetch(async () => { throw new TypeError("Failed to fetch") })
    const res = await getProfile()
    expect(res.data).toBeNull()
    expect(res.error).toMatch(/server is unavailable/i)
  })
})
