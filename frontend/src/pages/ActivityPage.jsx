import React, { useEffect, useState } from 'react'
import ActivityFeed from '../components/dashboard/ActivityFeed'

const ActivityPage = () => {

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setData([
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
    <div style={{ padding: 24 }}>

      {/* 🔥 FIXED HEADER */}
      <h2 style={{ 
        marginBottom: 20, 
        color: '#111827',
        fontWeight: 600 
      }}>
        Activity
      </h2>

      <ActivityFeed 
        data={data} 
        loading={loading} 
        title="All Activity" 
      />

    </div>
  )
}

export default ActivityPage