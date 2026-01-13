import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import App from './App'
import DagView from './pages/DagView'
import IssueDetail from './pages/IssueDetail'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<DagView />} />
          <Route path="issues/:issueId" element={<IssueDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
