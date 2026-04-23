// DashboardPage.jsx
import React, { useEffect, useState } from 'react'
import { Row, Col, Typography, Skeleton } from 'antd'
import StatCards from '../components/dashboard/StatCards'
import ActivityFeed from '../components/dashboard/ActivityFeed'
import CommitChart from '../components/dashboard/CommitChart'

const { Title } = Typography

const DashboardPage = () => {

  // 🔥 TEMP MOCK STATE (backend-ready structure)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // simulate API call
    setTimeout(() => {
      setActivity([
        {
          repo: 'frontend-app',
          message: 'Updated dashboard UI',
          author: 'Kunal',
          time: new Date(),
        },
        {
          repo: 'backend-api',
          message: 'Added auth middleware',
          author: 'Rahul',
          time: new Date(),
        },
      ])
      setLoading(false)
    }, 600)
  }, [])

  return (
    <div style={{ 
  maxWidth: 1200, 
  margin: '0 auto', 
  padding: '24px' 
}}>
      {/* HEADER */}
      <Title level={2} style={{ marginBottom: 24 }}>
        Dashboard
      </Title>

      {/* STATS */}
      <StatCards />

      {/* MAIN GRID */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>

        {/* CHART */}
        <Col xs={24} lg={16}>
          <div className="premium-card" style={{ height: '100%' }}>
            <Title level={4} style={{ marginBottom: 20 }}>
              Commit Activity (Last 7 Days)
            </Title>

            <div style={{ height: 320 }}>
              <CommitChart />
            </div>
          </div>
        </Col>

        {/* ACTIVITY */}
        <Col xs={24} lg={8}>
          <ActivityFeed
            data={activity}
            loading={loading}
            title="Recent Activity"
          />
        </Col>

      </Row>
    </div>
  )
}

export default DashboardPage