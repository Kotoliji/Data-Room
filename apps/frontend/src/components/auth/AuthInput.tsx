interface AuthInputProps {
  icon: React.ReactNode
  type?: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

export function AuthInput({ icon, type = "text", placeholder, value, onChange }: AuthInputProps) {
  return (
    <div className="flex w-full items-center gap-[12px] overflow-clip rounded-[12px] bg-[#F3F5F7] px-[16px] py-[14px] focus-within:ring-2 focus-within:ring-[#2752F4]/25">
      {icon}
      <input
        type={type}
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent font-[Inter,sans-serif] text-[14px] font-medium leading-[24px] tracking-[-0.14px] text-[#141718] outline-none placeholder:text-[rgba(108,114,117,0.5)]"
      />
    </div>
  )
}
