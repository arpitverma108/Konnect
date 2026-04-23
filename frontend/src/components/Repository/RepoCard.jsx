// RepoCard.jsx
import React from 'react'
import { Card, Typography, Tag, Space, Tooltip, Button } from 'antd'
import { FolderGit2, GitBranch, Shield, Clock, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const { Text, Title } = Typography

const RepoCard = ({ repo }) => {
  const navigate = useNavigate()

  return (
    <Card 
      className="premium-card"
      hoverable
      style={{ 
        height: '100%', 
        background: 'var(--bg-surface)', 
        borderColor: 'var(--border-color)',
        cursor: 'pointer',
      }}
      bodyStyle={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}
      onClick={() => navigate(`/repositories/${repo.id}`)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            background: 'rgba(24, 144, 255, 0.1)', 
            padding: '10px', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FolderGit2 size={24} color="#1890ff" />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontSize: '18px' }}>{repo.name}</Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Created {dayjs(repo.created_at).fromNow()}
            </Text>
          </div>
        </div>
        {repo.is_active ? (
          <Tag color="success" style={{ margin: 0 }}>Active</Tag>
        ) : (
          <Tag color="error" style={{ margin: 0 }}>Inactive</Tag>
        )}
      </div>

      <Text style={{ flexGrow: 1, color: 'var(--text-muted)', marginBottom: 20 }}>
        {repo.description || "No description provided."}
      </Text>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
        <Space size="large" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Tooltip title="Total Commits">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <History size={16} />
              <Text type="secondary">{repo.commit_count || 0}</Text>
            </span>
          </Tooltip>
          
          <Tooltip title="SVN URL">
            <span 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(repo.svn_url || '');
                message.success('SVN URL copied');
              }}
            >
              <ExternalLink size={16} color="var(--primary-color)" />
              <Text type="secondary" style={{ color: 'var(--primary-color)', fontSize: '12px' }}>Copy URL</Text>
            </span>
          </Tooltip>
          
          <Tooltip title="Last Updated">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <Clock size={16} />
              <Text type="secondary">{repo.updated_at ? dayjs(repo.updated_at).format('MMM D') : dayjs(repo.created_at).format('MMM D')}</Text>
            </span>
          </Tooltip>
        </Space>
      </div>
    </Card>
  )
}

export default RepoCard
