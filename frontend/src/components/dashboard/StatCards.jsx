import React from 'react'
import { Row, Col, Skeleton } from 'antd'
import { FolderTree, Users, Webhook, Activity } from 'lucide-react'

const StatCards = ({ stats, loading }) => {

  const STAT_CONFIG = [
    {
      key: 'repositories',
      title: 'Total Repositories',
      icon: <FolderTree size={22} color="#1E6FD9" />,
      bg: 'rgba(30, 111, 217, 0.08)',
      value: stats?.repositories,
      trend: stats?.repoTrend || '',
    },
    {
      key: 'users',
      title: 'Active Users',
      icon: <Users size={22} color="#16a34a" />,
      bg: 'rgba(22, 163, 74, 0.08)',
      value: stats?.users,
      trend: stats?.userTrend || '',
    },
    {
      key: 'groups',
      title: 'Groups',
      icon: <Webhook size={22} color="#d97706" />,
      bg: 'rgba(217, 119, 6, 0.08)',
      value: stats?.groups,
      trend: stats?.groupTrend || '',
    },
    {
      key: 'commits',
      title: 'Commits Today',
      icon: <Activity size={22} color="#dc2626" />,
      bg: 'rgba(220, 38, 38, 0.08)',
      value: stats?.commitsToday,
      trend: stats?.commitTrend || '',
    },
  ]

  return (
    <Row gutter={[20, 20]}>
      {STAT_CONFIG.map((item) => (
        <Col xs={24} sm={12} lg={6} key={item.key}>
          <div className="premium-card">

            {/* ICON */}
            <div
              style={{
                background: item.bg,
                padding: 10,
                borderRadius: 10,
                width: 'fit-content',
                marginBottom: 14,
              }}
            >
              {item.icon}
            </div>

            {/* TITLE */}
            <div style={{
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 600
            }}>
              {item.title}
            </div>

            {/* VALUE */}
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--text-main)',
              margin: '6px 0'
            }}>
              {loading
                ? <Skeleton.Input active size="small" style={{ width: 60 }} />
                : item.value ?? 0}
            </div>

            {/* TREND */}
            <div style={{
              color: 'var(--text-muted)',
              fontSize: 13
            }}>
              {loading
                ? <Skeleton.Input active size="small" style={{ width: 80 }} />
                : item.trend}
            </div>

          </div>
        </Col>
      ))}
    </Row>
  )
}

export default StatCards