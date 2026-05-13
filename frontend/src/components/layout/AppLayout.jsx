
import { Layout, Dropdown, Grid, Spin, Button } from 'antd'
import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut, KeyRound } from 'lucide-react'
import { useState } from 'react'

import Sidebar from './Sidebar'
import useAppStore from '../../store'
import { useMe } from '../../api/users'
import NotificationBell from '../NotificationBell'
import ChangePasswordModal from '../common/ChangePasswordModal' // 🔥 NEW
import apiClient from '../../api'
import { logout } from '../../utils/logout'
const { Header, Content } = Layout
const { useBreakpoint } = Grid

const AppLayout = () => {
  const { toggleSidebar } = useAppStore()
  const navigate = useNavigate()

  const screens = useBreakpoint()
  const isMobile = !screens.md

  const { data: me, isLoading } = useMe()

  const [passwordModal, setPasswordModal] = useState(false) // 🔥 NEW

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  const formatRole = (role) => {
    if (!role) return ''
    return role
      .toLowerCase()
      .replace('_', ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const handleLogout = () => {
  logout(navigate)
}

  // 🔥 UPDATED MENU
  const menuItems = [
    {
      key: 'change-password',
      label: (
        <div
          onClick={() => setPasswordModal(true)}
          style={{ display: 'flex', gap: 8 }}
        >
          <KeyRound size={14} />
          Change Password
        </div>
      ),
    },
    {
      key: 'logout',
      label: (
        <div onClick={handleLogout} style={{ display: 'flex', gap: 8 }}>
          <LogOut size={14} />
          Logout
        </div>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar isMobile={isMobile} />

      <Layout>
        <Header
          style={{
            background: '#161b22',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            height: 64,
            overflow: 'visible',
          }}
        >
          {isMobile && (
            <Button type="text" onClick={toggleSidebar}>
              ☰
            </Button>
          )}

          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              height: '100%',
            }}
          >
            <NotificationBell />

            <Dropdown menu={{ items: menuItems }}>
              <div style={{ cursor: 'pointer' }}>
                {me?.username} ({formatRole(me?.role)})
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>

        {/* 🔥 PASSWORD MODAL */}
        <ChangePasswordModal
          open={passwordModal}
          onClose={() => setPasswordModal(false)}
        />
      </Layout>
    </Layout>
  )
}

export default AppLayout