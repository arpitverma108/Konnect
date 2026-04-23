import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import dayjs from 'dayjs'

const data = Array.from({ length: 7 }).map((_, i) => ({
  name: dayjs().subtract(6 - i, 'day').format('MMM DD'),
  Repo1: Math.floor(Math.random() * 10),
  Repo2: Math.floor(Math.random() * 10),
}))

const CommitChart = () => {
  return (
    <div className="premium-card" style={{ height: 320 }}>
      <h3 style={{ marginBottom: 16 }}>Commit Activity</h3>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />

          <XAxis
            dataKey="name"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tick={{ fill: '#6b7280', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}
          />

          <Legend />

          <Bar dataKey="Repo1" stackId="a" fill="#1E6FD9" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Repo2" stackId="a" fill="#16a34a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default CommitChart