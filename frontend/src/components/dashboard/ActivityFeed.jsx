import React from 'react'
import { Avatar, Spin, Tag } from 'antd'
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  KeyRound,
  LogIn,
  RefreshCw,
  Tag as TagIcon,
  UserPlus,
  FolderPlus,
} from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  getEventTypeColor,
  getEventTypeLabel,
} from '../../utils/activityModel'

dayjs.extend(relativeTime)

const ActivityFeed = ({
  data = [],
  loading = false,
  title = "Recent Activity",
  emptyText = "No recent activity",
}) => {
  const getIcon=(eventType)=>{
    switch(eventType){
      case 'commit':
        return <GitCommit size={16}/>
      case 'branch_create':
        return <GitBranch size={16}/>
      case 'tag_create':
        return <TagIcon size={16}/>
      case 'permission_update':
      case 'permission':
        return <KeyRound size={16}/>
      case 'user_create':
      case 'user':
        return <UserPlus size={16}/>
      case 'repo_create':
      case 'repository':
      case 'repo':
        return <FolderPlus size={16}/>
      case 'login':
      case 'auth':
        return <LogIn size={16}/>
      case 'sync':
        return <RefreshCw size={16}/>
      default:
        return <GitPullRequest size={16}/>
    }
  }

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
          {emptyText}
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

          {data.map((act, i) => {
            const eventType=
              act.eventType ||
              act.event_type ||
              'system'

            const repoName=
              act.repoName ||
              act.repo_name

            const actor=
              act.actor ||
              act.author

            return (
            <div
              key={
                act.id ||
                act.audit_id ||
                act.revision ||
                `${act.eventType || 'activity'}-${act.time || i}`
              }
              style={{
                display: 'flex',
                gap: 12,
              }}
            >

              <Avatar
                size={32}
                icon={getIcon(eventType)}
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
                    <Tag
                      color={act.eventColor || getEventTypeColor(eventType)}
                      style={{ marginInlineEnd: 0 }}
                    >
                      {act.category || getEventTypeLabel(eventType)}
                    </Tag>
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

                {(actor||repoName)&&(
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {actor&&(
                      <Tag style={{marginInlineEnd:6}}>
                        {actor}
                      </Tag>
                    )}

                    {repoName&&(
                      <span>
                        {repoName}
                      </span>
                    )}
                  </div>
                )}

              </div>

            </div>
          )})}

        </div>
      )}

    </div>
  )
}

export default ActivityFeed
