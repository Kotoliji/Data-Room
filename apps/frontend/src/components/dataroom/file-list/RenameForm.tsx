import { Check, X } from "lucide-react"

export function RenameForm({ value, ext, onChange, onSubmit, onCancel }: {
  value: string; ext: string
  onChange: (v: string) => void
  onSubmit: (name: string, ext: string) => void
  onCancel: () => void
}) {
  return (
    <form
      className="flex flex-1 items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim(), ext) }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel() }}
        className="flex-1 rounded-lg border border-[#2752f4] bg-transparent px-2 py-1 font-[Inter,sans-serif] text-[14px] font-semibold text-[var(--dr-main-title)] outline-none"
      />
      {ext && <span className="shrink-0 text-[14px] font-semibold text-[#6c7275]">{ext}</span>}
      <button type="submit" className="rounded-md p-1 text-[#2752f4] hover:bg-[#f3f5f7]">
        <Check className="size-[18px]" />
      </button>
      <button type="button" onClick={onCancel} className="rounded-md p-1 text-[#6c7275] hover:bg-[#f3f5f7]">
        <X className="size-[18px]" />
      </button>
    </form>
  )
}
