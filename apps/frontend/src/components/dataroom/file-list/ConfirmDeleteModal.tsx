import { X } from "lucide-react"

export function ConfirmDeleteModal({ fileName, permanent, onConfirm, onCancel }: { fileName: string; permanent: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,23,24,0.75)]" onClick={onCancel}>
      <div
        className="relative mx-4 flex w-full max-w-[420px] flex-col gap-[24px] rounded-[24px] bg-[#fefefe] p-[24px] font-[Inter,sans-serif] md:p-[32px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onCancel} className="absolute right-[16px] top-[16px] rounded-full bg-[#f3f5f7] p-[6px]">
          <X size={18} className="text-[#141718]" />
        </button>

        <div className="flex flex-col gap-[8px]">
          <h3 className="text-[18px] font-bold leading-[28px] text-[#141718]">
            {permanent ? "Delete permanently?" : "Move to Trash?"}
          </h3>
          <p className="text-[14px] leading-[20px] text-[#6c7275]">
            <span className="font-semibold text-[#141718]">{fileName}</span>
            {permanent
              ? " will be permanently deleted. This action cannot be undone."
              : " will be moved to Trash. You can restore it later."}
          </p>
        </div>

        <div className="flex justify-end gap-[12px]">
          <button
            onClick={onCancel}
            className="rounded-[12px] border-2 border-[#e8ecef] px-[20px] py-[10px] text-[14px] font-semibold text-[#141718] transition-colors hover:bg-[#f3f5f7]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-[12px] bg-red-500 px-[20px] py-[10px] text-[14px] font-semibold text-white transition-colors hover:bg-red-600"
          >
            {permanent ? "Delete" : "Move to Trash"}
          </button>
        </div>
      </div>
    </div>
  )
}
