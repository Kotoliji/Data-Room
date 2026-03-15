import { Search } from "lucide-react"

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="px-4 py-4 md:px-[40px] md:py-[32px]">
      <div className="flex items-center gap-[12px] overflow-clip rounded-[12px] border-2 border-[var(--dr-main-search-border)] p-[12px] transition-colors focus-within:border-[var(--dr-main-search-text)]">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search documents by name..."
          className="flex-1 bg-transparent font-[Karla,sans-serif] text-[17px] text-[var(--dr-main-search-text)] placeholder:opacity-75 outline-none"
        />
        <div className="flex items-center justify-center overflow-hidden rounded-xl p-2">
          <Search size={24} className="text-[var(--dr-main-search-text)]" />
        </div>
      </div>
    </div>
  )
}
