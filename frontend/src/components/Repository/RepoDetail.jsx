// RepoDetail.jsx
import React from 'react'
import { Tabs, Descriptions, Button, message, Space, Typography, Table, Spin, Popconfirm } from 'antd'
import { Copy, Terminal, History, Settings, Trash2, RefreshCcw } from 'lucide-react'
import { useRepoLog, useDeleteRepository, useSyncActivity } from '../../api/repositories'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const { TabPane } = Tabs
const { Text, Title } = Typography

const RepoDetail = ({ repo }) => {
  const navigate = useNavigate()
  const { data: history = [], isLoading: historyLoading } = useRepoLog(repo.id)
  const deleteMutation = useDeleteRepository()
  const syncMutation = useSyncActivity()

  const copySvnUrl = () => {
    navigator.clipboard.writeText(repo.svn_url)
    message.success('SVN URL copied to clipboard')
  }

  const handleDelete = () => {
    deleteMutation.mutate(repo.id, {
      onSuccess: () => {
        message.success(`Repository ${repo.name} deleted`)
        navigate('/repositories')
      },
      onError: () => message.error('Failed to delete repository'),
    })
  }

  const handleSync = () => {
    syncMutation.mutate(repo.id, {
      onSuccess: (data) => message.success(`Sync complete! ${data?.synced || 0} new commits found.`),
      onError: () => message.error('Failed to sync repository activity.')
    })
  }

  const historyColumns = [
    { 
      title: 'Revision', 
      dataIndex: 'revision', 
      key: 'revision', 
      width: 100,
      render: (rev) => <Text code>r{rev}</Text>
    },
    { title: 'Author', dataIndex: 'author', key: 'author', width: 120 },
    { 
      title: 'Date', 
      dataIndex: 'date', 
      key: 'date', 
      width: 180,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    },
    { title: 'Message', dataIndex: 'message', key: 'message' },
  ]

  return (
    <div className="glass-panel" style={{ padding: '24px', minHeight: '60vh' }}>
      <Descriptions 
        bordered 
        column={1} 
        size="middle"
        labelStyle={{ backgroundColor: 'var(--bg-surface-hover)', color: 'var(--text-main)', width: '200px' }}
        contentStyle={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)' }}
        style={{ marginBottom: 32 }}
      >
        <Descriptions.Item label="Description">
          {repo.description || <Text type="secondary">No description</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="SVN URL">
          <Space>
            <Text code>{repo.svn_url}</Text>
            <Button type="text" icon={<Copy size={16} />} onClick={copySvnUrl} />
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Quick Connect (CLI)">
          <div style={{ padding: '8px', background: 'var(--bg-color)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: 'var(--success-color)', fontFamily: 'monospace' }}>svn checkout {repo.svn_url}</Text>
            <Button type="text" icon={<Terminal size={14} />} onClick={() => {
              navigator.clipboard.writeText(`svn checkout ${repo.svn_url}`)
              message.success('Command copied')
            }}/>
          </div>
        </Descriptions.Item>
      </Descriptions>

      <Tabs 
        defaultActiveKey="history"
        tabBarExtraContent={
          <Button 
            icon={<RefreshCcw size={14} />} 
            onClick={handleSync}
            loading={syncMutation.isPending}
            size="small"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Sync Now
          </Button>
        }
      >
        <TabPane 
          tab={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><History size={16}/> Commit History</span>} 
          key="history"
        >
          {historyLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
          ) : (
            <Table 
              dataSource={history} 
              columns={historyColumns} 
              rowKey="revision"
              pagination={{ pageSize: 15 }}
              rowClassName={() => 'premium-table-row'}
              locale={{ emptyText: 'No commits in this repository yet.' }}
            />
          )}
        </TabPane>
        <TabPane 
          tab={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Settings size={16}/> Settings</span>} 
          key="settings"
        >
          <div style={{ padding: '20px' }}>
            <Title level={5} style={{ color: 'var(--danger-color)', marginBottom: 16 }}>Danger Zone</Title>
            <Space align="start">
              <Popconfirm
                title={`Delete ${repo.name}?`}
                description="This action will permanently remove the repository and all its history from the disk."
                onConfirm={handleDelete}
                okText="Delete"
                okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              >
                <Button danger icon={<Trash2 size={16} />}>Delete Repository</Button>
              </Popconfirm>
              <div style={{ maxWidth: 400 }}>
                <Text type="secondary">
                  Deleting a repository is permanent. All files, history, branches, and permissions associated with this repository will be lost.
                </Text>
              </div>
            </Space>
          </div>
        </TabPane>
      </Tabs>
    </div>
  )
}

export default RepoDetail
