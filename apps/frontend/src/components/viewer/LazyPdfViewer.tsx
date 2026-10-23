import { lazy, Suspense, type ComponentProps } from "react"
import type { PdfViewer as PdfViewerType } from "./PdfViewer"

// pdf.js is ~400 kB — load it only when a document is actually opened
const PdfViewer = lazy(() => import("./PdfViewer").then((m) => ({ default: m.PdfViewer })))

export function LazyPdfViewer(props: ComponentProps<typeof PdfViewerType>) {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[60] bg-[rgba(20,23,24,0.96)]" />}>
      <PdfViewer {...props} />
    </Suspense>
  )
}
