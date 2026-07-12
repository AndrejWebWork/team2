import { createTheme } from '@mui/material/styles'

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#009688' },
    secondary: { main: '#2979FF' },
    success: { main: '#009688' },
    warning: { main: '#AEEA00', contrastText: '#1f2937' },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Noto Sans, ui-sans-serif, system-ui, sans-serif',
  },
})
