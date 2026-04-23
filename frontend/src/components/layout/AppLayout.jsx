// AppLayout.jsx

import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import useAppStore from '../../store'

const { Header, Content } = Layout

const AppLayout = () => {
  const { sidebarCollapsed } = useAppStore()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />

      <Layout
        style={{
          marginLeft: sidebarCollapsed ? 80 : 240,
          transition: '0.2s',
        }}
      >
        <Header
          style={{
            background: '#161b22',           // ✅ DARK
            borderBottom: '1px solid #30363d',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 24px',
            color: '#e6edf3',                // ✅ TEXT FIX
            fontWeight: 500,
          }}
        >
          Admin User
        </Header>

        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout