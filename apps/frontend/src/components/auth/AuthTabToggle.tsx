import { Link } from "react-router-dom"

interface AuthTabToggleProps {
  activeTab: "signin" | "register"
}

const activeClass = "flex flex-1 items-center justify-center rounded-[10px] bg-[#FEFEFE] p-[8px] shadow-[0px_2px_2px_0px_rgba(0,0,0,0.07),inset_0px_4px_2px_0px_white]"
const inactiveClass = "flex flex-1 items-center justify-center rounded-[10px] p-[8px]"
const activeLabelClass = "font-[Inter,sans-serif] text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[#232627]"
const inactiveLabelClass = "font-[Inter,sans-serif] text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[#6C7275]"

export function AuthTabToggle({ activeTab }: AuthTabToggleProps) {
  return (
    <div className="flex w-full items-center justify-center overflow-clip rounded-[12px] bg-[#F3F5F7] p-[4px]">
      {activeTab === "signin" ? (
        <div className={activeClass}>
          <span className={activeLabelClass}>Sign in</span>
        </div>
      ) : (
        <Link to="/login" className={inactiveClass}>
          <span className={inactiveLabelClass}>Sign in</span>
        </Link>
      )}

      {activeTab === "register" ? (
        <div className={activeClass}>
          <span className={activeLabelClass}>Create account</span>
        </div>
      ) : (
        <Link to="/register" className={inactiveClass}>
          <span className={inactiveLabelClass}>Create account</span>
        </Link>
      )}
    </div>
  )
}
