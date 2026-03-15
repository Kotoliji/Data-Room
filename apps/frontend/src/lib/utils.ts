import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1048576) return `${(size / 1024).toFixed(0)} KB`
  return `${(size / 1048576).toFixed(1)} MB`
}
