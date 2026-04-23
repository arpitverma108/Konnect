import React from 'react'
import {
  Typography, Row, Col, Descriptions, Tag, Divider, Button,
  message, Card, Space, Alert, Spin
} from 'antd'
import {
  Server, FolderOpen, Shield, Terminal, RefreshCw,
  Database, HardDrive, FileText
} from 'lucide-react'
import { useRebuildAuthz } from '../api/permissions'
import { useRepositories } from '../api/repositories'
import { useUsers } from '../api/users'

const { Title, Text } = Typography

const InfoCard = ({ icon, title, children }) => (
  <div className="premium-card" style={{ padding: '20px', height: '100%' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <div style={{ background: 'rgba(24, 144, 255, 0.1)', padding: 8, borderRadius: 8, display: 'flex' }}>
        {icon}
      </div>
      <Title level={5} style={{ margin: 0 }}>{title}</Title>
    </div>
    {children}
  </div>
)

const SettingsPage = () => {
  const rebuildMutation = useRebuildAuthz()
  const { data: repos = [] } = useRepositories()
  const { data: users = [] } = useUsers()

  const handleRebuildAuthz = () => {
    rebuildMutation.mutate(undefined, {
      onSuccess: () => message.success('authz file rebuilt and Apache reloaded'),
      onError: () => message.error('Failed to rebuild authz — check Apache config'),
    })
  }

  const descStyle = {
    labelStyle: { backgroundColor: 'var(--bg-surface-hover)', color: 'var(--text-muted)', width: 180 },
    contentStyle: { backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)' },
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <div style={{ marginBottom: 28 }}>
        <Title level={2} style={{ margin: 0 }}>System Settings</Title>
        <Text type="secondary">View and manage server configuration for SVNBridge.</Text>
      </div>

      <Alert
        type="info"
        showIcon
        message="Configuration is managed via environment variables in backend/.env"
        description="Changes to paths or credentials require restarting the backend server."
        style={{ marginBottom: 28 }}
      />

      <Row gutter={[24, 24]}>
        {/* System Overview */}
        <Col xs={24} lg={12}>
          <InfoCard icon={<Server size={18} color="var(--primary-color)" />} title="System Overview">
            <Descriptions bordered column={1} size="small" {...descStyle}>
              <Descriptions.Item label="Backend Port">
                <Tag color="blue">3000</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Environment">
                <Tag color="orange">development</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Repositories">
                <Text strong>{repos.length}</Text> <Text type="secondary">total</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Users">
                <Text strong>{users.filter(u => u.is_active).length}</Text> <Text type="secondary">active</Text>
              </Descriptions.Item>
            </Descriptions>
          </InfoCard>
        </Col>

        {/* SVN Configuration */}
        <Col xs={24} lg={12}>
          <InfoCard icon={<HardDrive size={18} color="#722ed1" />} title="SVN Configuration">
            <Descriptions bordered column={1} size="small" {...descStyle}>
              <Descriptions.Item label="SVN Repos Root">
                <Text code style={{ fontSize: 12 }}>C:/svn-data/repos</Text>
              </Descriptions.Item>
              <Descriptions.Item label="svnadmin">
                <Tag color="green">svnadmin</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="svnlook">
                <Tag color="green">svnlook</Tag>
              </Descriptions.Item>
            </Descriptions>
          </InfoCard>
        </Col>

        {/* Apache / Auth Config */}
        <Col xs={24} lg={12}>
          <InfoCard icon={<Shield size={18} color="#52c41a" />} title="Apache Auth Configuration">
            <Descriptions bordered column={1} size="small" {...descStyle}>
              <Descriptions.Item label="htpasswd Path">
                <Text code style={{ fontSize: 12 }}>C:/svn-data/conf/htpasswd</Text>
              </Descriptions.Item>
              <Descriptions.Item label="authz Path">
                <Text code style={{ fontSize: 12 }}>C:/svn-data/conf/authz</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Apache Reload Cmd">
                <Text code style={{ fontSize: 12 }}>httpd -k graceful</Text>
              </Descriptions.Item>
            </Descriptions>
            <Button
              type="primary"
              ghost
              icon={<RefreshCw size={14} />}
              onClick={handleRebuildAuthz}
              loading={rebuildMutation.isPending}
              style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              Rebuild authz & Reload Apache
            </Button>
          </InfoCard>
        </Col>

        {/* Database */}
        <Col xs={24} lg={12}>
          <InfoCard icon={<Database size={18} color="#faad14" />} title="Database">
            <Descriptions bordered column={1} size="small" {...descStyle}>
              <Descriptions.Item label="Host">
                <Text code style={{ fontSize: 12 }}>localhost:5432</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Database">
                <Text code style={{ fontSize: 12 }}>svnbridge</Text>
              </Descriptions.Item>
              <Descriptions.Item label="User">
                <Text code style={{ fontSize: 12 }}>svnbridge_user</Text>
              </Descriptions.Item>
              <Descriptions.Item label="bcrypt rounds">
                <Tag color="blue">12</Tag>
              </Descriptions.Item>
            </Descriptions>
          </InfoCard>
        </Col>
      </Row>
    </div>
  )
}

export default SettingsPage
