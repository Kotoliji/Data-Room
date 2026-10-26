import { Navigate } from "react-router-dom"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // The real check is the HttpOnly session cookie on every API call; a 401 sends the user back here
  const isLoggedIn = !!localStorage.getItem("user")
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}
