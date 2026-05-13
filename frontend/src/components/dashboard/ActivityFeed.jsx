import React from 'react'
import { Avatar, Spin } from 'antd'
import { GitCommit } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const ActivityFeed = ({
  data = [],
  loading = false,
  title = "Recent Activity",
}) => {

  return (
    <div className="premium-card">

      <h3
        style={{
          marginBottom: 16,
          color: 'var(--text-main)',
        }}
      >
        {title}
      </h3>

      {loading && (
        <div
          style={{
            textAlign: 'center',
            padding: 40,
          }}
        >
          <Spin />
        </div>
      )}

      {!loading && data.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 0',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}
        >
          No activity found
        </div>
      )}

      {!loading && data.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >

          {data.map((act, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 12,
              }}
            >

              <Avatar
                size={32}
                icon={<GitCommit size={16} />}
                style={{
                  background: '#1f6feb',
                }}
              />

              <div style={{ flex: 1 }}>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--text-main)',
                    }}
                  >
                    {act.category || 'System'}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                    }}
                  >
                    {dayjs(
                      act.time || act.committed_at
                    ).fromNow()}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 4,
                    color: 'var(--text-main)',
                  }}
                >
                  {act.message}
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {act.author}
                </div>

              </div>

            </div>
          ))}

        </div>
      )}

    </div>
  )
}

export default ActivityFeed