import { useCallback, useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getGoogleConnectUrl, getGoogleDriveStatus } from "@/lib/api"

function ConnectIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M16.9045 5.20912C18.2247 3.93402 19.993 3.22846 21.8283 3.24441C23.6637 3.26035 25.4194 3.99654 26.7173 5.29439C28.0151 6.59225 28.7513 8.34794 28.7673 10.1833C28.7832 12.0187 28.0776 13.7869 26.8025 15.1071L26.7883 15.1216L23.2885 18.6214C22.5788 19.3313 21.7248 19.8803 20.7844 20.2311C19.8439 20.5819 18.839 20.7264 17.8378 20.6547C16.8366 20.583 15.8625 20.2968 14.9816 19.8155C14.1008 19.3343 13.3337 18.6692 12.7325 17.8654C12.3465 17.3495 12.4519 16.6183 12.9679 16.2324C13.4838 15.8465 14.215 15.9519 14.6009 16.4678C15.0017 17.0037 15.5131 17.4471 16.1004 17.7679C16.6876 18.0887 17.337 18.2795 18.0045 18.3273C18.6719 18.3751 19.3419 18.2788 19.9688 18.0449C20.5958 17.8111 21.1652 17.4451 21.6383 16.9718L25.1308 13.4792C25.9767 12.5998 26.4446 11.424 26.434 10.2036C26.4234 8.98 25.9326 7.80955 25.0673 6.94431C24.2021 6.07907 23.0317 5.58828 21.8081 5.57765C20.5871 5.56704 19.4108 6.03535 18.5313 6.88192L16.5309 8.87065C16.074 9.32493 15.3353 9.32278 14.881 8.86584C14.4267 8.4089 14.4289 7.67021 14.8858 7.21593L16.8925 5.22093L16.9045 5.20912Z" fill="#8E55EA"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M11.2157 11.7688C12.1562 11.418 13.1611 11.2735 14.1623 11.3452C15.1635 11.4169 16.1375 11.7031 17.0184 12.1844C17.8993 12.6656 18.6664 13.3307 19.2676 14.1345C19.6535 14.6504 19.5481 15.3816 19.0322 15.7675C18.5162 16.1535 17.7851 16.0481 17.3991 15.5321C16.9983 14.9962 16.4869 14.5529 15.8997 14.232C15.3124 13.9112 14.6631 13.7204 13.9956 13.6726C13.3281 13.6248 12.6582 13.7211 12.0312 13.955C11.4042 14.1889 10.8349 14.5548 10.3618 15.0281L6.86922 18.5207C6.02334 19.4001 5.55545 20.5759 5.56605 21.7963C5.57669 23.0199 6.06747 24.1904 6.93271 25.0556C7.79795 25.9208 8.96841 26.4116 10.192 26.4223C11.4124 26.4329 12.5882 25.965 13.4676 25.1191L15.4551 23.1317C15.9107 22.6761 16.6494 22.6761 17.105 23.1317C17.5606 23.5873 17.5606 24.326 17.105 24.7816L15.11 26.7766L15.0955 26.7908C13.7753 28.0659 12.0071 28.7715 10.1717 28.7555C8.33634 28.7396 6.58065 28.0034 5.2828 26.7055C3.98494 25.4077 3.24876 23.652 3.23281 21.8166C3.21686 19.9812 3.92242 18.213 5.19753 16.8928L5.21174 16.8783L8.71159 13.3785C8.71154 13.3785 8.71164 13.3784 8.71159 13.3785C9.4212 12.6687 10.2753 12.1196 11.2157 11.7688Z" fill="#8E55EA"/>
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.0101 2.41005C15.5568 1.86332 16.4432 1.86332 16.9899 2.41005L23.9899 9.41005C24.5367 9.95678 24.5367 10.8432 23.9899 11.3899C23.4432 11.9367 22.5568 11.9367 22.01 11.3899L17.4 6.7799L17.4 20.2C17.4 20.9732 16.7732 21.6 16 21.6C15.2268 21.6 14.6 20.9732 14.6 20.2L14.6 6.7799L9.98995 11.3899C9.44322 11.9367 8.55678 11.9367 8.01005 11.3899C7.46332 10.8432 7.46332 9.95678 8.01005 9.41005L15.0101 2.41005Z" fill="#D84C10"/>
      <path d="M3.4 18.8C4.1732 18.8 4.8 19.4268 4.8 20.2V21.88C4.8 23.0792 4.80109 23.8944 4.85257 24.5245C4.90272 25.1383 4.99362 25.4522 5.10518 25.6712C5.37363 26.198 5.80197 26.6264 6.32883 26.8948C6.54779 27.0064 6.86167 27.0973 7.47545 27.1474C8.10558 27.1989 8.92079 27.2 10.12 27.2H21.88C23.0792 27.2 23.8944 27.1989 24.5245 27.1474C25.1383 27.0973 25.4522 27.0064 25.6712 26.8948C26.198 26.6264 26.6264 26.198 26.8948 25.6712C27.0064 25.4522 27.0973 25.1383 27.1474 24.5245C27.1989 23.8944 27.2 23.0792 27.2 21.88V20.2C27.2 19.4268 27.8268 18.8 28.6 18.8C29.3732 18.8 30 19.4268 30 20.2V21.9379C30 23.0648 30 23.9949 29.9381 24.7526C29.8738 25.5395 29.7358 26.2629 29.3896 26.9423C28.8527 27.9961 27.9961 28.8527 26.9423 29.3896C26.2629 29.7358 25.5395 29.8738 24.7526 29.9381C23.9949 30 23.0648 30 21.9378 30H10.0622C8.93522 30 8.00512 30 7.24745 29.9381C6.46051 29.8738 5.73712 29.7358 5.05766 29.3896C4.00395 28.8527 3.14726 27.9961 2.61037 26.9423C2.26416 26.2629 2.12617 25.5395 2.06187 24.7526C1.99997 23.9949 1.99998 23.0648 2 21.9378V20.2C2 19.4268 2.6268 18.8 3.4 18.8Z" fill="#D84C10"/>
    </svg>
  )
}

function ViewDocsIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M6 4C4.89543 4 4 4.89543 4 6V26C4 27.1046 4.89543 28 6 28H26C27.1046 28 28 27.1046 28 26V6C28 4.89543 27.1046 4 26 4H6ZM8 10C8 9.44772 8.44772 9 9 9H23C23.5523 9 24 9.44772 24 10C24 10.5523 23.5523 11 23 11H9C8.44772 11 8 10.5523 8 10ZM9 15C8.44772 15 8 15.4477 8 16C8 16.5523 8.44772 17 9 17H19C19.5523 17 20 16.5523 20 16C20 15.4477 19.5523 15 19 15H9ZM8 22C8 21.4477 8.44772 21 9 21H15C15.5523 21 16 21.4477 16 22C16 22.5523 15.5523 23 15 23H9C8.44772 23 8 22.5523 8 22Z" fill="#0084FF"/>
    </svg>
  )
}

interface WelcomeScreenProps {
  onImport?: () => void
  hasFilesElsewhere?: boolean
  onViewDocuments?: () => void
}

export function WelcomeScreen({ onImport, hasFilesElsewhere, onViewDocuments }: WelcomeScreenProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [googleConnected, setGoogleConnected] = useState(false)
  const [justConnected, setJustConnected] = useState(false)
  const [connectError, setConnectError] = useState("")

  const isLoggedIn = !!localStorage.getItem("user")

  useEffect(() => {
    if (searchParams.get("google_connected") === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGoogleConnected(true)
      setJustConnected(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (isLoggedIn) {
      getGoogleDriveStatus().then(setGoogleConnected)
    }
  }, [isLoggedIn])

  const handleCardClick = useCallback(async () => {
    if (!isLoggedIn) {
      navigate("/login")
      return
    }
    if (googleConnected) {
      onImport?.()
      return
    }
    const authUrl = await getGoogleConnectUrl()
    if (authUrl) {
      window.location.href = authUrl
    } else {
      setConnectError("Failed to connect to Google Drive. Please try again.")
    }
  }, [navigate, isLoggedIn, googleConnected, onImport])

  return (
    <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-6 px-4 pb-6 md:gap-[40px] md:px-[39px] md:pb-[80px]">
      {justConnected && (
        <div className="w-full max-w-[492px] rounded-[12px] border border-green-200 bg-green-50 px-4 py-3 text-center font-[Inter,sans-serif] text-sm font-medium text-green-800">
          Google Drive connected successfully
        </div>
      )}
      {connectError && (
        <div className="w-full max-w-[492px] rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-center font-[Inter,sans-serif] text-sm font-medium text-red-700">
          {connectError}
        </div>
      )}
      <div className="flex flex-col items-center text-center">
        <h1 className="font-[Inter,sans-serif] text-[28px] font-bold leading-[36px] tracking-[-1px] text-[var(--dr-main-title)] md:text-[40px] md:leading-[64px] md:tracking-[-1.6px]">
          Unlock the power of your Data Room
        </h1>
        <p className="font-[Karla,sans-serif] text-[16px] leading-[24px] tracking-[-0.32px] text-[var(--dr-main-subtitle)] md:text-[24px] md:leading-[36px] md:tracking-[-0.48px]">
          Connect Google Drive, import deal documents, and review them securely in one
          workspace.
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-3 md:w-[492px] md:gap-[20px]">
        <button
          onClick={handleCardClick}
          className="flex w-full items-center gap-4 rounded-[12px] border border-[var(--dr-card-border)] bg-[var(--dr-card-bg)] py-3 pl-3 pr-4 text-left shadow-[0px_0px_16px_4px_rgba(0,0,0,0.04),0px_33px_24px_-17px_rgba(0,0,0,0.12)] transition-all hover:shadow-lg md:gap-[24px] md:py-[16px] md:pl-[16px] md:pr-[24px]"
        >
          <div
            className="flex size-[48px] shrink-0 items-center justify-center rounded-[12px] md:size-[60px]"
            style={{ background: googleConnected ? "rgba(216,76,16,0.2)" : "rgba(142,85,234,0.2)" }}
          >
            {googleConnected ? <UploadIcon /> : <ConnectIcon />}
          </div>
          <div className="flex flex-1 items-center self-stretch">
            <div className="flex flex-1 items-center gap-[4px] h-full">
              <span className="flex-1 font-[Inter,sans-serif] text-[16px] font-semibold leading-[24px] tracking-[-0.32px] text-[var(--dr-main-title)] md:text-[18px] md:leading-[32px] md:tracking-[-0.36px]">
                {googleConnected ? "Import from Google Drive" : "Connect Google Drive"}
              </span>
              <div className="flex items-center justify-center overflow-clip p-[8px] rounded-[40px]">
                <ArrowRight size={24} className="text-[var(--dr-main-title)]" />
              </div>
            </div>
          </div>
        </button>

        {hasFilesElsewhere && (
          <button
            onClick={onViewDocuments}
            className="flex w-full items-center gap-4 rounded-[12px] border border-[var(--dr-card-border)] bg-[var(--dr-card-bg)] py-3 pl-3 pr-4 text-left transition-all hover:shadow-lg md:gap-[24px] md:py-[16px] md:pl-[16px] md:pr-[24px]"
          >
            <div
              className="flex size-[48px] shrink-0 items-center justify-center rounded-[12px] md:size-[60px]"
              style={{ background: "rgba(0,132,255,0.2)" }}
            >
              <ViewDocsIcon />
            </div>
            <div className="flex flex-1 items-center self-stretch">
              <div className="flex flex-1 items-center gap-[4px] h-full">
                <span className="flex-1 font-[Inter,sans-serif] text-[16px] font-semibold leading-[24px] tracking-[-0.32px] text-[var(--dr-main-title)] md:text-[18px] md:leading-[32px] md:tracking-[-0.36px]">
                  View imported documents
                </span>
                <div className="flex items-center justify-center overflow-clip p-[8px] rounded-[40px]">
                  <ArrowRight size={24} className="text-[var(--dr-main-title)]" />
                </div>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}
