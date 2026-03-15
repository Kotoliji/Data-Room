export function AuthSidePanel() {
  return (
    <div className="relative hidden h-screen w-[640px] shrink-0 overflow-hidden bg-[#141718] lg:block">
      {/* Background gradients (decorative, from Figma) */}
      <div className="pointer-events-none absolute left-[50px] top-[544px] size-[541px] opacity-[0.05] mix-blend-screen">
        <div className="absolute inset-[-23.66%] rounded-full bg-[radial-gradient(circle,rgba(142,85,234,0.6)_0%,transparent_70%)]" />
      </div>
      <div className="pointer-events-none absolute left-[136px] top-[222px] size-[369px] opacity-[0.02] mix-blend-screen">
        <div className="absolute inset-[-34.69%] rounded-full bg-[radial-gradient(circle,rgba(62,144,240,0.6)_0%,transparent_70%)]" />
      </div>

      {/* Text block */}
      <div className="absolute left-[80px] top-[80px] flex w-[405px] flex-col gap-[16px]">
        <h1 className="font-[Inter,sans-serif] text-[48px] font-bold leading-[56px] tracking-[-0.96px] text-[#FEFEFE]">
          Unlock the power of your Data Room
        </h1>
        <p className="font-[Karla,sans-serif] text-[24px] font-normal leading-[36px] tracking-[-0.48px] text-[#E8ECEF]">
          Securely import documents from Google Drive, organize them in one place, and run due
          diligence with confidence.
        </p>
      </div>
    </div>
  )
}
