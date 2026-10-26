import { Navigate, useLocation } from "react-router-dom"

/** Renders `children` for signed-in users; everyone else gets `fallback` or is sent to sign-in. */
export function ProtectedRoute({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  useLocation()  // re-check on every navigation, e.g. right after the demo sign-in
  // The real check is the HttpOnly session cookie on every API call; a 401 sends the user back here
  const isLoggedIn = !!localStorage.getItem("user")
  if (!isLoggedIn) return fallback ?? <Navigate to="/login" replace />
  return <>{children}</>
}
