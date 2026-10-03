import { MotionConfig } from 'framer-motion'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import LandingPage from './LandingPage'
import './page.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      {__WALLET_DEMO__ ? /^\/demo(?:\/|$)/.test(window.location.pathname) ? <App /> : <LandingPage /> : <App />}
    </MotionConfig>
  </React.StrictMode>,
)
