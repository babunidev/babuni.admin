import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './app/AdminLayout'
import { ContentPage } from './features/morkahja/pages/ContentPage'
import { DashboardPage } from './features/morkahja/pages/DashboardPage'
import { PlayersPage } from './features/morkahja/pages/PlayersPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="players/:playerId" element={<PlayersPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="content/:kind/:itemKey" element={<ContentPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
