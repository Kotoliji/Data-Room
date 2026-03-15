import { Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="z-[1] flex overflow-hidden rounded-[12px] border border-[var(--dr-sidebar-toggle-border)] bg-[var(--dr-sidebar-toggle-bg)] p-[4px]">
      <button
        onClick={() => setTheme("light")}
        className={cn(
          "flex flex-1 items-center justify-center gap-3 rounded-[10px] px-4 py-2 text-sm font-semibold leading-6 tracking-[-0.28px] transition-colors 3xl:gap-1 3xl:px-2 3xl:py-1 3xl:text-xs",
          theme === "light"
            ? "overflow-hidden bg-[var(--dr-sidebar-toggle-active-bg)] text-[var(--dr-sidebar-toggle-active-text)]"
            : "text-[var(--dr-sidebar-toggle-inactive-text)]"
        )}
      >
        <Sun size={24} className="3xl:size-[16px]" />
        Light
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={cn(
          "flex flex-1 items-center justify-center gap-3 rounded-[10px] px-4 py-2 text-sm font-semibold leading-6 tracking-[-0.28px] transition-colors 3xl:gap-1 3xl:px-2 3xl:py-1 3xl:text-xs",
          theme === "dark"
            ? "overflow-hidden bg-[var(--dr-sidebar-toggle-active-bg)] text-[var(--dr-sidebar-toggle-active-text)]"
            : "text-[var(--dr-sidebar-toggle-inactive-text)]"
        )}
      >
        <Moon size={24} className="3xl:size-[16px]" />
        Dark
      </button>
    </div>
  )
}
