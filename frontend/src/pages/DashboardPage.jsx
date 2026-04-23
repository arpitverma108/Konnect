import React, { useEffect, useState } from 'react'
import { Row, Col, Typography } from 'antd'
import StatCards from '../components/dashboard/StatCards'
import ActivityFeed from '../components/dashboard/ActivityFeed'
import CommitChart from '../components/dashboard/CommitChart'

const { Title } = Typography

const DashboardPage = () => {

  const [activity, setActivity] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // No backend yet → stop loading
    setLoading(false)
  }, [])

  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: '24px'
    }}>

      <Title level={2} style={{ marginBottom: 24 }}>
        Dashboard
      </Title>

      <StatCards stats={stats} loading={loading} />

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>

        <Col xs={24} lg={16}>
          <div className="premium-card" style={{ height: '100%' }}>
            <Title level={4} style={{ marginBottom: 20 }}>
              Commit Activity (Last 7 Days)
            </Title>

            <div style={{ height: 320 }}>
              <CommitChart data={[]} loading={loading} />
            </div>
          </div>
        </Col>

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