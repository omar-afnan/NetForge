import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ClerkProvider } from '@clerk/react'
import './index.css'

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkKey ? <ClerkProvider publishableKey={clerkKey}><App /></ClerkProvider> : <App />}
  </StrictMode>,
)