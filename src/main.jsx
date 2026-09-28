import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.jsx'
import './index.css'

const container = document.getElementById('root')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * PWA: register the service worker after first paint, and only in a build.
 * In dev it would cache the module graph Vite is busy hot-reloading.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Offline support is unavailable.', error)
    })
  })
}
