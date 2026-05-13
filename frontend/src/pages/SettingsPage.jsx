
import React from 'react'
import {
  Typography,
  Row,
  Col,
  Descriptions,
  Tag,
  Alert,
} from 'antd'

import {
  Server,
  Shield,
  Database,
  HardDrive,
} from 'lucide-react'

import { useRepositories } from '../api/repositories'
import { useUsers } from '../api/users'

import {
  normalizeList,
} from '../utils/normalize'

const { Title, Text } = Typography

const InfoCard = ({
  icon,
  title,
  children,
}) => (
  <div
    className="premium-card"
    style={{
      padding: '20px',
      height: '100%',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          background:
            'rgba(24, 144, 255, 0.1)',

          padding: 8,
          borderRadius: 8,
          display: 'flex',
        }}
      >
        {icon}
      </div>

      <Title
        level={5}
        style={{ margin: 0 }}
      >
        {title}
      </Title>
    </div>

    {children}
  </div>
)

const SettingsPage = () => {

  const { data: reposResponse } =
    useRepositories()

  const { data: usersResponse } =
    useUsers()

  const repos =
    normalizeList(reposResponse)

  const users =
    normalizeList(usersResponse)

  const descStyle = {
    labelStyle: {
      backgroundColor:
        'var(--bg-surface-hover)',

      color: 'var(--text-muted)',
      width: 180,
    },

    contentStyle: {
      backgroundColor:
        'var(--bg-surface)',

      color: 'var(--text-main)',
    },
  }

  return (
    <div style={{ paddingBottom: 32 }}>

      <div style={{ marginBottom: 28 }}>
        <Title
          level={2}
          style={{ margin: 0 }}
        >
          System Settings
        </Title>

        <Text type="secondary">
          View system information and
          backend-managed configuration.
        </Text>
      </div>

      <Alert
        type="info"
        showIcon
        message="Configuration is managed securely by the backend"
        description="Sensitive infrastructure details are hidden from the frontend."
        style={{ marginBottom: 28 }}
      />

      <Row gutter={[24, 24]}>

        <Col xs={24} lg={12}>
          <InfoCard
            icon={
              <Server
                size={18}
                color="var(--primary-color)"
              />
            }

            title="System Overview"
          >
            <Descriptions
              bordered
              column={1}
              size="small"
              {...descStyle}
            >

              <Descriptions.Item label="Environment">
                <Tag color="green">
                  Active
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Repositories">
                <Text strong>
                  {repos.length}
                </Text>

                <Text type="secondary">
                  {' '}total
                </Text>
              </Descriptions.Item>

              <Descriptions.Item label="Users">
                <Text strong>
                  {
                    users.filter(
                      (u) => u.is_active
                    ).length
                  }
                </Text>

                <Text type="secondary">
                  {' '}active
                </Text>
              </Descriptions.Item>

            </Descriptions>
          </InfoCard>
        </Col>

        <Col xs={24} lg={12}>
          <InfoCard
            icon={
              <HardDrive
                size={18}
                color="#722ed1"
              />
            }

            title="SVN Configuration"
          >
            <Descriptions
              bordered
              column={1}
              size="small"
              {...descStyle}
            >

              <Descriptions.Item label="Repository Storage">
                <Tag color="blue">
                  Configured
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="SVN Tools">
                <Tag color="green">
                  Available
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Repository Access">
                <Tag color="purple">
                  Managed by Backend
                </Tag>
              </Descriptions.Item>

            </Descriptions>
          </InfoCard>
        </Col>

        <Col xs={24} lg={12}>
          <InfoCard
            icon={
              <Shield
                size={18}
                color="#52c41a"
              />
            }

            title="Authentication & Permissions"
          >
            <Descriptions
              bordered
              column={1}
              size="small"
              {...descStyle}
            >

              <Descriptions.Item label="Authentication">
                <Tag color="green">
                  Enabled
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Authorization">
                <Tag color="blue">
                  Active
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Permission Sync">
                <Tag color="purple">
                  Automatic
                </Tag>
              </Descriptions.Item>

            </Descriptions>

            <Alert
              style={{ marginTop: 16 }}
              type="info"
              showIcon
              message="Permissions are automatically synchronized"
              description="Changes to users, groups, repositories, and permissions are applied automatically by the backend."
            />
          </InfoCard>
        </Col>

        <Col xs={24} lg={12}>
          <InfoCard
            icon={
              <Database
                size={18}
                color="#faad14"
              />
            }

            title="Database"
          >
            <Descriptions
              bordered
              column={1}
              size="small"
              {...descStyle}
            >

              <Descriptions.Item label="Database Status">
                <Tag color="green">
                  Connected
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Credential Storage">
                <Tag color="blue">
                  Protected
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Password Security">
                <Tag color="purple">
                  bcrypt Enabled
                </Tag>
              </Descriptions.Item>

            </Descriptions>
          </InfoCard>
        </Col>

      </Row>
    </div>
  )
}

export default SettingsPage