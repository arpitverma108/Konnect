import React from 'react'
import { Typography, Card, Button } from 'antd'
import { Webhook, Clock3 } from 'lucide-react'

const { Title, Text } = Typography

const HooksPage = () => {
  return (
    <div style={{ paddingBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            SVN Hooks
          </Title>

          <Text type="secondary">
            Manage SVN repository hook scripts.
          </Text>
        </div>
      </div>

      <Card
        className="glass-panel"
        style={{
          minHeight: '65vh',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
        }}
        bodyStyle={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 40,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            maxWidth: 520,
          }}
        >
          <div
            style={{
              width: 90,
              height: 90,
              margin: '0 auto 24px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(24,144,255,0.12)',
              border: '1px solid rgba(24,144,255,0.25)',
            }}
          >
            <Webhook size={42} color="#1890ff" />
          </div>

          <Title level={2} style={{ marginBottom: 12 }}>
            Hooks Management Coming Soon
          </Title>

          <Text
            type="secondary"
            style={{
              fontSize: 16,
              lineHeight: 1.7,
              display: 'block',
              marginBottom: 28,
            }}
          >
            Advanced SVN hook management, script editing,
            automation workflows, and repository event
            triggers will be available in an upcoming release.
          </Text>

          <Button
            type="primary"
            size="large"
            icon={<Clock3 size={18} />}
          >
            Under Development
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default HooksPage