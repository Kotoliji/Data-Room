import { AuthSidePanel } from "./AuthSidePanel"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex h-screen items-start overflow-clip bg-[#FEFEFE] lg:rounded-[20px] lg:bg-[#141718]">
      <AuthSidePanel />
      <div className="flex flex-1 items-start self-stretch lg:pr-[24px] lg:py-[24px]">
        {children}
      </div>
    </div>
  )
}
