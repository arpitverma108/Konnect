// main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, theme } from 'antd'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConfigProvider
          theme={{
            algorithm: theme.darkAlgorithm,
            token: {
              colorPrimary: '#1890ff',
              colorBgBase: '#0d1117',
              colorBgContainer: '#161b22',
              colorBorder: '#30363d',
              fontFamily: "'Inter', sans-serif",
            },
            components: {
              Layout: {
                headerBg: '#161b22',
                bodyBg: '#0d1117',
                siderBg: '#161b22',
              },
              Menu: {
                darkItemBg: '#161b22',
                darkItemHoverBg: '#21262d',
                darkItemSelectedBg: '#1890ff',
              }
            }
          }}
        >
          <App />
        </ConfigProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
