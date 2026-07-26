import { CssBaseline, ThemeProvider } from '@mui/material'
import { Capacitor } from '@capacitor/core'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppProvider } from './context/AppContext'
import './index.css'
import { installIosViewportZoomFix } from './lib/iosViewport'
import { appTheme } from './theme'

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app')
  document.documentElement.dataset.platform = Capacitor.getPlatform()
}

installIosViewportZoomFix()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
