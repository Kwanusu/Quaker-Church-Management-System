import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { PLATFORM } from './config'

// Set here rather than in index.html so it follows VITE_PLATFORM_NAME without a placeholder.
document.title = `${PLATFORM.name} (${PLATFORM.subtitle})`

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
