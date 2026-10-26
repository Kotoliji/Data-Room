import type { AuthResponse } from "./types"
import { logout } from "./api"
import { queryClient } from "./queries"

/**
 * The session token stays in an HttpOnly cookie set by the server. Only the public profile is
 * kept for the UI, picked field by field so the token can never end up in localStorage.
 */
export function startSession({ id, name, email, location, avatar_url, session_id }: AuthResponse): void {
  queryClient.clear()  // never show the previous account's cached data
  localStorage.setItem("user", JSON.stringify({ id, name, email, location, avatar_url, session_id }))
}

/** Forget the session locally (the server already ended it, e.g. revoked or account deleted). */
export function clearLocalSession(): void {
  queryClient.clear()
  localStorage.removeItem("user")
  localStorage.removeItem("auth_token")  // left behind by versions that stored the token here
}

/** Sign out: end the session on the server, then locally. */
export async function endSession(): Promise<void> {
  await logout()
  clearLocalSession()
}
