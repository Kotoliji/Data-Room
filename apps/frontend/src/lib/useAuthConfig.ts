import { useEffect, useState } from "react"
import { getAuthConfig, type AuthConfig } from "./api"

const FALLBACK: AuthConfig = { google_enabled: false, demo: null }
let cached: Promise<AuthConfig> | null = null

/** Deployment capabilities (Google OAuth, demo login), fetched once per page load. */
export function useAuthConfig(): AuthConfig | null {
  const [config, setConfig] = useState<AuthConfig | null>(null)
  useEffect(() => {
    cached ??= getAuthConfig().then((res) => res.data ?? FALLBACK)
    cached.then(setConfig)
  }, [])
  return config
}
