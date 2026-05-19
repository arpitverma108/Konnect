
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

const healthTone = {
  healthy: 'green',
  configured: 'blue',
  managed: 'purple',
  protected: 'purple',
  unknown: 'default',
}

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

const HealthDescriptions = ({
  items = [],
  descStyle,
}) => (
  <Descriptions
    bordered
    column={1}
    size="small"
    {...descStyle}
  >
    {items.map((item) => (
      <Descriptions.Item
        key={item.label}
        label={item.label}
      >
        <Tag
          color={
            healthTone[item.status] ||
            healthTone.unknown
          }
        >
          {item.value}
        </Tag>
      </Descriptions.Item>
    ))}
  </Descriptions>
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

  const healthSections = [
    {
      title: 'SVN Configuration',
      icon: (
        <HardDrive
          size={18}
          color="#722ed1"
        />
      ),
      items: [
        {
          label: 'Repository Storage',
          value: 'Configured',
          status: 'configured',
        },
        {
          label: 'SVN Tools',
          value: 'Available',
          status: 'healthy',
        },
        {
          label: 'Repository Access',
          value: 'Managed by Backend',
          status: 'managed',
        },
      ],
    },
    {
      title: 'Authentication & Permissions',
      icon: (
        <Shield
          size={18}
          color="#52c41a"
        />
      ),
      items: [
        {
          label: 'Authentication',
          value: 'Enabled',
          status: 'healthy',
        },
        {
          label: 'Authorization',
          value: 'Active',
          status: 'configured',
        },
        {
          label: 'Permission Sync',
          value: 'Automatic',
          status: 'managed',
        },
      ],
      footer: (
        <Alert
          style={{ marginTop: 16 }}
          type="info"
          showIcon
          message="Permissions are automatically synchronized"
          description="Changes to users, groups, repositories, and permissions are applied automatically by the backend."
        />
      ),
    },
    {
      title: 'Database',
      icon: (
        <Database
          size={18}
          color="#faad14"
        />
      ),
      items: [
        {
          label: 'Database Status',
          value: 'Connected',
          status: 'healthy',
        },
        {
          label: 'Credential Storage',
          value: 'Protected',
          status: 'configured',
        },
        {
          label: 'Password Security',
          value: 'bcrypt Enabled',
          status: 'protected',
        },
      ],
    },
  ]

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

        {healthSections.map((section) => (
          <Col
            key={section.title}
            xs={24}
            lg={12}
          >
            <InfoCard
              icon={section.icon}
              title={section.title}
            >
              <HealthDescriptions
                items={section.items}
                descStyle={descStyle}
              />

              {section.footer}
            </InfoCard>
          </Col>
        ))}

      </Row>
    </div>
  )
}

export default SettingsPage
