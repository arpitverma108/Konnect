import { Layout, Dropdown } from 'antd'
import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import Sidebar from './Sidebar'
import useAppStore from '../../store'

const { Header, Content } = Layout

const AppLayout = () => {
  const { sidebarCollapsed } = useAppStore()
  const navigate = useNavigate()

  
  const user = JSON.parse(localStorage.getItem('user'))

  // 🧠 Format role nicely
  const formatRole = (role) => {
    if (!role) return ''
    return role
      .toLowerCase()
      .replace('_', ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  
  const handleLogout = () => {
    localStorage.clear()
    navigate('/login')
  }

  
  const menuItems = [
    {
      key: 'logout',
      label: (
        <div
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer'
          }}
        >
          <LogOut size={14} />
          Logout
        </div>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />

      <Layout
        style={{
          marginLeft: sidebarCollapsed ? 80 : 240,
          transition: '0.2s',
        }}
      >
        {/*  HEADER */}
        <Header
          style={{
            background: '#161b22',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 24px',
          }}
        >
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <div
              style={{
                color: '#fcfcfc',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {user
                ? `${user.username} (${formatRole(user.role)})`
                : 'Guest'}

              {/*  Dropdown arrow */}
              <span style={{
                 fontSize: 12, 
                 }}>▼</span>
            </div>
          </Dropdown>
        </Header>

        {/*  CONTENT */}
        <Content style={{
          
          margin: 24, }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout