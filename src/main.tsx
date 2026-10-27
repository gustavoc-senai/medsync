
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'

import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import AppRecovery from './components/AppRecovery'
import { authCallbackPath } from './lib/authRedirect'
import './index.css'

const callbackPath = authCallbackPath(window.location.hash, window.location.pathname)
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
const router = createBrowserRouter([{ path: '*', element: <App />, errorElement: <AppRecovery /> }])

ReactDOM.createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary><RouterProvider router={router} /></AppErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
)
