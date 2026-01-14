import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { SyncProvider } from './context/SyncContext'
import AuthCallback from './pages/AuthCallback'
import DagView from './pages/DagView'
import Home from './pages/Home'
import IssueDetail from './pages/IssueDetail'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SyncProvider>
          <Routes>
            <Route path="/" element={<App />}>
              <Route index element={<Home />} />
              <Route path="repos/:owner/:repo" element={<DagView />} />
              <Route path="issues/:issueId" element={<IssueDetail />} />
            </Route>
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Routes>
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
