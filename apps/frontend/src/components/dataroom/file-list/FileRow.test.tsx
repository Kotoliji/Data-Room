import { describe, expect, it, vi } from "vitest"
import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FileRow, type ListedFile } from "./FileRow"

const pdf: ListedFile = {
  id: 7, name: "q3.pdf", original_name: "Q3 Report.pdf", mime_type: "application/pdf", size: 2048,
  folder_id: "all", status: "uploaded", created_at: "2026-10-20T10:00:00", insight: null,
}

/** Mirrors how FileListView owns the rename state */
function Harness({ file, onRename = vi.fn(), onOpen = vi.fn(), onDelete = vi.fn() }: {
  file: ListedFile; onRename?: (name: string) => void; onOpen?: () => void; onDelete?: () => void
}) {
  const [value, setValue] = useState<string | null>(null)
  return (
    <FileRow
      file={file}
      renameValue={value}
      onRenameValueChange={setValue}
      onRenameSubmit={(name) => { onRename(name); setValue(null) }}
      onRenameCancel={() => setValue(null)}
      onStartRename={setValue}
      onOpen={onOpen}
      onDelete={onDelete}
    />
  )
}

describe("FileRow", () => {
  it("renames without making the user retype the extension", async () => {
    const onRename = vi.fn()
    render(<Harness file={pdf} onRename={onRename} />)
    const user = userEvent.setup()

    await user.click(screen.getByTitle("Rename"))
    const input = screen.getByDisplayValue("Q3 Report")
    expect(screen.getByText(".pdf")).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, "Q3 Board Pack{Enter}")
    expect(onRename).toHaveBeenCalledWith("Q3 Board Pack.pdf")
    expect(screen.queryByDisplayValue("Q3 Board Pack")).not.toBeInTheDocument()
  })

  it("cancels renaming with Escape", async () => {
    const onRename = vi.fn()
    render(<Harness file={pdf} onRename={onRename} />)
    const user = userEvent.setup()
    await user.click(screen.getByTitle("Rename"))
    await user.keyboard("{Escape}")
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByText("Q3 Report.pdf")).toBeInTheDocument()
  })

  it("opens and deletes", async () => {
    const onOpen = vi.fn()
    const onDelete = vi.fn()
    render(<Harness file={pdf} onOpen={onOpen} onDelete={onDelete} />)
    const user = userEvent.setup()
    await user.click(screen.getByText("Q3 Report.pdf"))
    await user.click(screen.getByTitle("Delete"))
    expect(onOpen).toHaveBeenCalledWith(pdf)
    expect(onDelete).toHaveBeenCalled()
  })

  it("offers no actions while a file is still uploading", async () => {
    const onOpen = vi.fn()
    render(<Harness file={{ id: "tmp-1", original_name: "Big.pdf", size: 1, status: "uploading" }} onOpen={onOpen} />)
    await userEvent.setup().click(screen.getByText("Big.pdf"))
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.queryByTitle("Delete")).not.toBeInTheDocument()
    expect(screen.getByText("Big.pdf").closest("[data-file-id]")).toHaveAttribute("draggable", "false")
  })
})
