// App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'

// Pages
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

function App() {
  return (
    <Routes>
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
        <Route path="*" element={<div style={{ padding: 24, color: 'var(--text-muted)' }}>404 – Page not found</div>} />
         <Route path="activity" element={<ActivityPage />} />      
      </Route>
    </Routes>
  )
}

export default App
