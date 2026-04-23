import React from 'react'
import { Breadcrumb, Typography } from 'antd'
import { useLocation, Link } from 'react-router-dom'
import { Home } from 'lucide-react'

const { Text } = Typography

const BreadcrumbNav = () => {
  const location = useLocation()
  const pathnames = location.pathname.split('/').filter((x) => x)

  const breadcrumbItems = [
    {
      title: (
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Home size={14} />
          <span>Home</span>
        </Link>
      ),
      key: 'home',
    },
    ...pathnames.map((value, index) => {
      const last = index === pathnames.length - 1
      const to = `/${pathnames.slice(0, index + 1).join('/')}`

      // Beautify names: 'repositories' -> 'Repositories', 'groups' -> 'Groups', etc.
      const name = value.charAt(0).toUpperCase() + value.slice(1)

      return {
        title: last ? (
          <Text strong style={{ color: 'var(--text-main)' }}>{name}</Text>
        ) : (
          <Link to={to} style={{ textTransform: 'capitalize' }}>{name}</Link>
        ),
        key: to,
      }
    }),
  ]

  if (pathnames.length === 0 || pathnames[0] === 'dashboard') {
    return null // Don't show on dashboard home
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <Breadcrumb items={breadcrumbItems} separator="/" />
    </div>
  )
}

export default BreadcrumbNav
