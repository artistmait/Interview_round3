import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SharedStatementPage from './components/SharedStatementPage.jsx'

const sharedStatementMatch = window.location.pathname.match(/^\/shared\/([^/]+)\/?$/)
const app = sharedStatementMatch
  ? <SharedStatementPage token={decodeURIComponent(sharedStatementMatch[1])} />
  : <App />

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {app}
  </StrictMode>,
)
