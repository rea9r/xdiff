import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import { App } from './App'
import { AppErrorBoundary } from './ui/AppErrorBoundary'
import { CodeFontScaleProvider } from './useCodeFontScale'
import { AISetupProvider } from './features/ai/AISetupProvider'
import { appTheme } from './theme'
import './style.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MantineProvider theme={appTheme} defaultColorScheme="auto">
      <Notifications position="bottom-right" />
      <AppErrorBoundary>
        <CodeFontScaleProvider>
          <AISetupProvider>
            <App />
          </AISetupProvider>
        </CodeFontScaleProvider>
      </AppErrorBoundary>
    </MantineProvider>
  </React.StrictMode>,
)
