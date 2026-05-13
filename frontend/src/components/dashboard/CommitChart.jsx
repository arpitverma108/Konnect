

import React from 'react'
import dayjs from 'dayjs'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

const CommitChart = ({ data = [], loading = false }) => {

  if (loading) {
    return (
      <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Loading chart...</span>
      </div>
    )
  }

  if (!loading && data.length === 0) {
    return (
      <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>No commit data available</span>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />

        {/* ✅ X Axis */}
        <XAxis
  dataKey="date"
  tickFormatter={(value) => {
    const d = dayjs(value)
    return d.isValid() ? d.format('DD MMM') : ''
  }}
  tick={{ fill: '#9da7b3', fontSize: 12 }}
  axisLine={false}
  tickLine={false}
/>

        {/* ✅ Y Axis */}
        <YAxis
          tick={{ fill: '#9da7b3', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />

        {/* ✅ Tooltip */}
        <Tooltip
labelFormatter={(value) => {
  const d = dayjs(value)
  return d.isValid() ? d.format('DD MMM YYYY') : ''
}}          contentStyle={{
            backgroundColor: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            color: '#e6edf3'
          }}
        />

        {/* ✅ Bars */}
        <Bar
          dataKey="count"
          name="Commits"
          fill="#1E6FD9"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default CommitChart