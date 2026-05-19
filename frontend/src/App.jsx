import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './routes/ProtectedRoute'
// Lazy pages
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ActivityPage = lazy(() => import('./pages/ActivityPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const RepositoriesPage = lazy(() => import('./pages/RepositoriesPage'))
const RepoDetailPage = lazy(() => import('./pages/RepoDetailPage'))
const CommitDetailPage = lazy(() => import('./pages/CommitDetailPage'))

const UsersPage = lazy(() => import('./pages/UsersPage'))
const UserDetailPage = lazy(() => import('./pages/UserDetailPage'))
const GroupsPage = lazy(() => import('./pages/GroupsPage'))
const PermissionsPage = lazy(() => import('./pages/PermissionsPage'))
const HooksPage = lazy(() => import('./pages/HooksPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function App() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      }
    >
      <Routes>

        {/* PUBLIC ROUTES */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* PROTECTED ROUTES */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<AppLayout />}>

            {/* DEFAULT */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* CORE */}
            <Route path="dashboard" element={<DashboardPage />} />

            <Route path="repositories" element={<RepositoriesPage />} />
            <Route path="repositories/:id" element={<RepoDetailPage />} />

            {/* 🔥 COMMIT VIEWER ROUTE (IMPORTANT) */}
            <Route
              path="repositories/:id/commits/:revision"
              element={<CommitDetailPage />}
            />

            {/* ADMIN + SUPER ADMIN */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin']} />}>
              <Route path="users" element={<UsersPage />} />
              <Route path="users/:id" element={<UserDetailPage />} />
              <Route path="groups" element={<GroupsPage />} />
              <Route path="hooks" element={<HooksPage />} />
            </Route>

            {/* SUPER ADMIN ONLY */}
            <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
              <Route path="permissions" element={<PermissionsPage />} />
            </Route>

            {/* OTHER */}
            <Route path="settings" element={<SettingsPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

      </Routes>
    </Suspense>
  )
}

export default App