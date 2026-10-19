import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

// The Google provider is only mounted when a client id is configured.
const app = googleClientId
  ? <GoogleOAuthProvider clientId={googleClientId}><App /></GoogleOAuthProvider>
  : <App />

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>{app}</ErrorBoundary>
  </StrictMode>,
)
