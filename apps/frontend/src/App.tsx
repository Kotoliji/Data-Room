import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/dataroom/Layout'
import { SignIn } from '@/components/auth/SignIn'
import { CreateAccount } from '@/components/auth/CreateAccount'
import { ResetPassword } from '@/components/auth/ResetPassword'
import { NewPassword } from '@/components/auth/NewPassword'
import { ThemeProvider } from '@/lib/theme'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Landing } from '@/components/landing/Landing'
import { PublicShare } from '@/components/share/PublicShare'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProtectedRoute fallback={<Landing />}><Layout /></ProtectedRoute>} />
          <Route path="/login" element={<SignIn />} />
          <Route path="/register" element={<CreateAccount />} />
          <Route path="/forgot-password" element={<ResetPassword />} />
          <Route path="/reset-password" element={<NewPassword />} />
          <Route path="/s/:token" element={<PublicShare />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
