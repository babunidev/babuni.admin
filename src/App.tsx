import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './app/AdminLayout'
import { OverviewPage } from './features/babuni-dev/pages/OverviewPage'
import { DocumentsPage } from './features/babuni-dev/pages/DocumentsPage'
import { RepositoriesPage } from './features/babuni-dev/pages/RepositoriesPage'
import { ContentPage } from './features/morkahja/pages/ContentPage'
import { DashboardPage } from './features/morkahja/pages/DashboardPage'
import { ReadOnlyDashboardPage } from './features/morkahja/pages/ReadOnlyDashboardPage'
import { PlayersPage } from './features/morkahja/pages/PlayersPage'
import { ConnectionsPage } from './pages/ConnectionsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<ReadOnlyDashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="read-only" element={<ReadOnlyDashboardPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="players/:playerId" element={<PlayersPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="content/:kind/:itemKey" element={<ContentPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="babuni-dev" element={<OverviewPage />} />
          <Route path="babuni-dev/documents" element={<DocumentsPage />} />
          <Route path="babuni-dev/repositories" element={<RepositoriesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
