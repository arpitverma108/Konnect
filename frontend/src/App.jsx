import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'

// Pages
import RegisterPage from './pages/RegisterPage'
import ActivityPage from './pages/ActivityPage'
import DashboardPage from './pages/DashboardPage'
import RepositoriesPage from './pages/RepositoriesPage'
import RepoDetailPage from './pages/RepoDetailPage'
import UsersPage from './pages/UsersPage'
import UserDetailPage from './pages/UserDetailPage'
import GroupsPage from './pages/GroupsPage'
import PermissionsPage from './pages/PermissionsPage'
import HooksPage from './pages/HooksPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'

//  Protected Route
import ProtectedRoute from './routes/ProtectedRoute'

function App() {
  return (
    <Routes>

      {/* PUBLIC ROUTE */}
      <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      {/* PROTECTED ROUTES */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppLayout />}>

          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="repositories" element={<RepositoriesPage />} />
          <Route path="repositories/:id" element={<RepoDetailPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:id" element={<UserDetailPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="permissions" element={<PermissionsPage />} />
          <Route path="hooks" element={<HooksPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="activity" element={<ActivityPage />} />

          <Route path="*" element={
            <div style={{ padding: 24, color: 'var(--text-muted)' }}>
              404 – Page not found
            </div>
          } />

        </Route>
      </Route>

    </Routes>
  )
}

export default App