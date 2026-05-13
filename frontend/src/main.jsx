import React from 'react'

import ReactDOM from 'react-dom/client'

import {
  BrowserRouter,
} from 'react-router-dom'

import {
  QueryClientProvider,
} from '@tanstack/react-query'

import {
  ConfigProvider,
  theme,
} from 'antd'

import App from './App'

import './index.css'

import useAppStore from './store'

import {
  queryClient,
} from './lib/queryClient'

import ErrorBoundary from './components/common/ErrorBoundary'

useAppStore
  .getState()
  .hydrateAuth()

ReactDOM
  .createRoot(
    document.getElementById('root')
  )
  .render(

    <React.StrictMode>

      <ErrorBoundary>

        <QueryClientProvider
          client={queryClient}
        >

          <BrowserRouter>

            <ConfigProvider
              theme={{
                algorithm:
                  theme.darkAlgorithm,
              }}
            >

              <App />

            </ConfigProvider>

          </BrowserRouter>

        </QueryClientProvider>

      </ErrorBoundary>

    </React.StrictMode>
  )