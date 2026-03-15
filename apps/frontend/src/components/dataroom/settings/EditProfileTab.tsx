import { User as UserIcon, Mail, UserCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { API_BASE, getProfile, updateProfile, uploadAvatar } from "@/lib/api"

export function EditProfileTab() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [location, setLocation] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getProfile().then((res) => {
      if (res.data) {
        setName(res.data.name)
        setEmail(res.data.email)
        setLocation(res.data.location ?? "")
        setAvatarUrl(res.data.avatar_url ?? null)
      } else {
        setError(res.error)
      }
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)

    const res = await updateProfile({ name, email, location })
    if (res.data) {
      const stored = localStorage.getItem("user")
      if (stored) {
        const user = JSON.parse(stored)
        localStorage.setItem("user", JSON.stringify({ ...user, name: res.data.name, email: res.data.email, location: res.data.location }))
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } else {
      setError(res.error)
    }
    setSaving(false)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB")
      return
    }

    setError(null)
    setUploading(true)
    const res = await uploadAvatar(file)
    if (res.data) {
      setAvatarUrl(res.data.avatar_url)
      const raw = localStorage.getItem("user")
      if (raw) {
        const user = JSON.parse(raw)
        user.avatar_url = res.data.avatar_url
        localStorage.setItem("user", JSON.stringify(user))
      }
    } else {
      setError(res.error)
    }
    setUploading(false)

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-[14px] text-[#6c7275]">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
      <h4 className="text-[28px] font-bold leading-[40px] tracking-[-0.28px] text-[#141718]">
        Edit profile
      </h4>

      {error && (
        <p className="text-[14px] font-medium text-red-500">{error}</p>
      )}

      {/* Avatar */}
      <div className="flex flex-col gap-3">
        <span className="text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[#232627]">
          Avatar
        </span>
        <div className="flex items-center gap-6">
          {avatarUrl ? (
            <img
              src={`${API_BASE}${avatarUrl}`}
              alt="Avatar"
              className="h-[112px] w-[112px] shrink-0 rounded-full object-cover"
            />
          ) : (
            <UserCircle size={112} className="shrink-0 text-[#b5e4ca]" />
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`rounded-[12px] border-2 border-[#e8ecef] px-[24px] py-[12px] text-[16px] font-semibold tracking-[-0.32px] text-[#141718] transition-colors ${uploading ? "cursor-wait opacity-50" : "cursor-pointer hover:bg-[#f3f5f7] active:bg-[#e8ecef]"}`}
            >
              {uploading ? "Uploading..." : "Upload new image"}
            </button>
            <p className="text-[12px] font-medium leading-[20px] tracking-[-0.24px] text-[#6c7275]">
              At least 800×800 px recommended.
              <br />
              JPG or PNG and GIF is allowed
            </p>
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-3">
        <span className="text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[#232627]">
          Name
        </span>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 rounded-[12px] bg-[#f3f5f7] px-[16px] py-[14px]">
            <UserIcon size={24} className="shrink-0 text-[#141718]" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[14px] font-medium tracking-[-0.14px] text-[#141718] outline-none placeholder:text-[rgba(108,114,117,0.5)]"
            />
          </label>
          <label className="flex items-center gap-3 rounded-[12px] bg-[#f3f5f7] px-[16px] py-[14px]">
            <Mail size={24} className="shrink-0 text-[#141718]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[14px] font-medium tracking-[-0.14px] text-[#141718] outline-none placeholder:text-[rgba(108,114,117,0.5)]"
            />
          </label>
        </div>
      </div>

      {/* Region */}
      <div className="flex flex-col gap-3">
        <span className="text-[14px] font-semibold leading-[24px] tracking-[-0.28px] text-[#232627]">
          Region
        </span>
        <div className="flex gap-3">
          {([
            { value: "europe", label: "EU", icon: (
              <svg width="20" height="20" viewBox="0 0 512 512" className="shrink-0">
                <rect width="512" height="512" rx="64" fill="#003399" />
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = (i * 30 - 90) * (Math.PI / 180)
                  const cx = 256 + 140 * Math.cos(angle)
                  const cy = 256 + 140 * Math.sin(angle)
                  return <polygon key={i} points={[...Array(5)].map((_, j) => {
                    const a = (j * 144 - 90) * (Math.PI / 180)
                    return `${cx + 18 * Math.cos(a)},${cy + 18 * Math.sin(a)}`
                  }).join(" ")} fill="#FFCC00" />
                })}
              </svg>
            ) },
            { value: "usa", label: "US", icon: (
              <svg width="20" height="20" viewBox="0 0 60 60" className="shrink-0">
                <rect width="60" height="60" rx="8" fill="#B22234" />
                {[1, 3, 5, 7, 9, 11].map((i) => (
                  <rect key={i} y={i * 4.615} width="60" height="4.615" fill="#fff" />
                ))}
                <rect width="24" height="32.3" fill="#3C3B6E" />
                <g fill="#fff">{[0, 1, 2, 3, 4].map((r) =>
                  [0, 1, 2, 3, 4, 5].map((c) => {
                    if (r % 2 === 0 && c > 4) return null
                    const cx = r % 2 === 0 ? 4 + c * 4.8 : 1.6 + c * 4.8
                    return <circle key={`${r}-${c}`} cx={cx} cy={3.2 + r * 6.4} r="1.2" />
                  })
                )}</g>
              </svg>
            ) },
          ] as const).map((region) => (
            <button
              key={region.value}
              type="button"
              onClick={() => setLocation(location === region.value ? "" : region.value)}
              className={`flex items-center gap-3 rounded-[12px] border-2 px-[16px] py-[14px] cursor-pointer transition-colors ${
                location === region.value
                  ? "border-[#2752f4] bg-[#f0f3ff] text-[#141718]"
                  : "border-[rgba(232,236,239,0.5)] bg-white text-[#6c7275] hover:border-[#e8ecef] hover:bg-[#f3f5f7]"
              }`}
            >
              {region.icon}
              <span className="text-[14px] font-semibold tracking-[-0.14px]">{region.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-[12px] bg-[#2752f4] px-[24px] py-[12px] text-[16px] font-semibold tracking-[-0.32px] text-[#fefefe] disabled:opacity-50"
      >
        {saving ? "Saving..." : success ? "Saved!" : "Save changes"}
      </button>
    </div>
  )
}
