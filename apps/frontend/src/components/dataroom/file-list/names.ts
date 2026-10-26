export function getExt(name: string): string {
  const d = name.lastIndexOf(".")
  return d > 0 ? name.slice(d) : ""
}

export function stripExt(name: string): string {
  const d = name.lastIndexOf(".")
  return d > 0 ? name.slice(0, d) : name
}
