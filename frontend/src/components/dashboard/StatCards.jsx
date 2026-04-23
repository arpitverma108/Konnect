import React from 'react'
import { Row, Col } from 'antd'
import { FolderTree, Users, Webhook, Activity } from 'lucide-react'

const STAT_CONFIG = [
  {
    key: 'repositories',
    title: 'Total Repositories',
    icon: <FolderTree size={22} color="#1E6FD9" />,
    bg: 'rgba(30, 111, 217, 0.08)',
    value: 13,
    trend: '+2 this week',
  },
  {
    key: 'users',
    title: 'Active Users',
    icon: <Users size={22} color="#16a34a" />,
    bg: 'rgba(22, 163, 74, 0.08)',
    value: 76,
    trend: '+6 new users',
  },
  {
    key: 'groups',
    title: 'Groups',
    icon: <Webhook size={22} color="#d97706" />,
    bg: 'rgba(217, 119, 6, 0.08)',
    value: 3,
    trend: 'No change',
  },
  {
    key: 'commits',
    title: 'Commits Today',
    icon: <Activity size={22} color="#dc2626" />,
    bg: 'rgba(220, 38, 38, 0.08)',
    value: 68,
    trend: '+7 today',
  },
]

const StatCards = () => {
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
              color: '#111827',
              fontSize: 14,
              fontWeight: 600
            }}>
              {item.title}
            </div>

            {/* VALUE */}
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#000',
              margin: '6px 0'
            }}>
              {item.value}
            </div>

            {/* TREND */}
            <div style={{
              color: '#4b5563',
              fontSize: 13
            }}>
              {item.trend}
            </div>

          </div>
          
        </Col>
      ))}
    </Row>
  )
}

export default StatCards