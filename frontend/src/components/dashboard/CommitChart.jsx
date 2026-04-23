import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const CommitChart = ({ data = [], loading = false }) => {

  
  if (loading) {
    return (
      <div className="premium-card" style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Loading chart...</span>
      </div>
    )
  }

  
  if (!loading && data.length === 0) {
    return (
      <div className="premium-card" style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>No commit data available</span>
      </div>
    )
  }

  return (
    <div className="premium-card" style={{ height: 320 }}>
      <h3 style={{ marginBottom: 16, color: 'var(--text-main)' }}>
        Commit Activity
      </h3>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />

          <XAxis
            dataKey="name"
            tick={{ fill: '#9da7b3', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tick={{ fill: '#9da7b3', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 8,
              color: '#e6edf3'
            }}
          />

          <Legend />

          <Bar dataKey="repo1" stackId="a" fill="#1E6FD9" radius={[4, 4, 0, 0]} />
          <Bar dataKey="repo2" stackId="a" fill="#16a34a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default CommitChart