import React from 'react'
import { Avatar } from 'antd'
import { GitCommit } from 'lucide-react'
import dayjs from 'dayjs'

import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const ActivityFeed = ({ data = [], loading = false, title = "Recent Activity" }) => {

  return (
    <div className="premium-card">

      {/* TITLE */}
      <h3 style={{ marginBottom: 16, color: 'var(--text-main)' }}>
        {title}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {data.map((act, i) => (
          <div key={i} style={{ display: 'flex', gap: 12 }}>

            {/* ICON */}
            <Avatar
              size={32}
              icon={<GitCommit size={16} />}
              style={{ background: '#1f6feb' }}  // better blue for dark UI
            />

            {/* CONTENT */}
            <div style={{ flex: 1 }}>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <div style={{ 
                  fontWeight: 600,
                  color: 'var(--text-main)'     
                }}>
                  {act.repo}
                </div>

                <div style={{ 
                  fontSize: 12, 
                  color: 'var(--text-muted)'    
                }}>
                  {dayjs(act.time).fromNow()}
                </div>
              </div>

              <div style={{ 
                marginTop: 4,
                color: 'var(--text-main)'      
              }}>
                {act.message}
              </div>

              <div style={{
                marginTop: 6,
                fontSize: 13,
                color: 'var(--text-secondary)'  
              }}>
                {act.author}
              </div>

            </div>

          </div>
        ))}

      </div>

    </div>
  )
}

export default ActivityFeed