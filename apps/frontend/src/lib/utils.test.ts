import { afterEach, describe, expect, it, vi } from "vitest"
import { formatDuration, formatSize, parseServerDate, timeAgo } from "./utils"

afterEach(() => {
  vi.useRealTimers()
})

describe("parseServerDate", () => {
  it("treats timestamps without an offset as UTC", () => {
    expect(parseServerDate("2026-10-22T12:00:00").toISOString()).toBe("2026-10-22T12:00:00.000Z")
  })

  it("keeps explicit offsets untouched", () => {
    expect(parseServerDate("2026-10-22T12:00:00Z").toISOString()).toBe("2026-10-22T12:00:00.000Z")
    expect(parseServerDate("2026-10-22T14:00:00+02:00").toISOString()).toBe("2026-10-22T12:00:00.000Z")
  })
})

describe("timeAgo", () => {
  it("measures from UTC regardless of the browser timezone", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-22T12:05:00Z"))
    expect(timeAgo("2026-10-22T12:04:30")).toBe("just now")
    expect(timeAgo("2026-10-22T12:00:00")).toBe("5m ago")
    expect(timeAgo("2026-10-22T09:05:00")).toBe("3h ago")
    expect(timeAgo("2026-10-19T12:05:00")).toBe("3d ago")
  })
})

describe("formatters", () => {
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45s")
    expect(formatDuration(125)).toBe("2m 5s")
    expect(formatDuration(3720)).toBe("1h 2m")
  })

  it("formats file sizes", () => {
    expect(formatSize(512)).toBe("512 B")
    expect(formatSize(2048)).toBe("2 KB")
    expect(formatSize(5 * 1048576)).toBe("5.0 MB")
  })
})
