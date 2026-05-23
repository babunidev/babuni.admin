import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './layouts/AdminLayout'
import { DashboardPage } from './pages/DashboardPage'
import { LogsPage } from './pages/LogsPage'
import { PlayersPage } from './pages/PlayersPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorldStatePage } from './pages/WorldStatePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="world-state" element={<WorldStatePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
