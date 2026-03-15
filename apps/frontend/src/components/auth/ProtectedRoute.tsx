import { Navigate } from "react-router-dom"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = !!localStorage.getItem("user") && !!localStorage.getItem("auth_token")
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}
