import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { queryClient } from './lib/queries'
import { onUnauthorized } from './lib/api'
import { clearLocalSession } from './lib/session'

// Session expired or revoked elsewhere: forget it and go to sign-in
onUnauthorized(() => {
  clearLocalSession()
  if (!window.location.pathname.startsWith('/login')) window.location.assign('/login')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
