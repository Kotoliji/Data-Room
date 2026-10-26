import type { User } from "./types"
import { queryClient } from "./queries"

/** Every sign-in and sign-out drops cached server data so one account never sees another's. */
export function startSession(token: string, user: User): void {
  queryClient.clear()
  localStorage.setItem("auth_token", token)
  localStorage.setItem("user", JSON.stringify(user))
}

export function endSession(): void {
  queryClient.clear()
  localStorage.removeItem("auth_token")
  localStorage.removeItem("user")
}
