
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'

import App from './App'
import { authCallbackPath } from './lib/authRedirect'
import './index.css'

const callbackPath = authCallbackPath(window.location.hash)
if (callbackPath && window.location.pathname !== callbackPath) {
  window.history.replaceState(null, '', `${callbackPath}${window.location.search}${window.location.hash}`)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
    },
  },
})

ReactDOM.createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
