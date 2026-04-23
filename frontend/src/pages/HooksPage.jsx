// HooksPage.jsx
import React, { useState } from 'react'
import { Typography, Select, Row, Col, Spin, Alert, Empty } from 'antd'
import { Webhook } from 'lucide-react'
import { useRepositories } from '../api/repositories'
import { useRepoHooks } from '../api/hooks'
import HookList from '../components/Hooks/HookList'
import HookEditor from '../components/Hooks/HookEditor'

const { Title, Text } = Typography
const { Option } = Select

const HooksPage = () => {
  const { data: repos = [], isLoading: reposLoading } = useRepositories()
  const [selectedRepoId, setSelectedRepoId] = useState(null)
  const [selectedHookName, setSelectedHookName] = useState(null)

  // Set first repo once loaded
  React.useEffect(() => {
    if (repos.length > 0 && !selectedRepoId) {
      setSelectedRepoId(repos[0].id)
    }
  }, [repos, selectedRepoId])

  const { data: hooks = [], isLoading: hooksLoading } = useRepoHooks(selectedRepoId)

  const handleRepoChange = (id) => {
    setSelectedRepoId(id)
    setSelectedHookName(null)
  }

  const handleSelectHook = (hookName) => {
    setSelectedHookName(hookName)
  }

  const selectedHook = hooks.find(h => h.hook_name === selectedHookName) || null

  return (
    <div className="hooks-container" style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>SVN Hooks</Title>
          <Text type="secondary">Manage pre-commit, post-commit, and other SVN hook scripts.</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text type="secondary">Repository:</Text>
          {reposLoading ? (
            <Spin size="small" />
          ) : (
            <Select
              value={selectedRepoId}
              onChange={handleRepoChange}
              style={{ width: 220 }}
              placeholder="Select a repository..."
            >
              {repos.map(r => (
                <Option key={r.id} value={r.id}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Webhook size={14} />
                    {r.name}
                  </span>
                </Option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {!selectedRepoId ? (
        <div className="glass-panel" style={{ padding: 40 }}>
          <Empty description="Select a repository to manage its hooks." />
        </div>
      ) : (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={7}>
            <div className="glass-panel" style={{ padding: '20px', minHeight: '65vh' }}>
              <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Available Hooks</Title>
              {hooksLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Spin />
                </div>
              ) : (
                <HookList
                  repoId={selectedRepoId}
                  hooks={hooks}
                  selectedHookName={selectedHookName}
                  onSelectHook={handleSelectHook}
                />
              )}
            </div>
          </Col>
          <Col xs={24} lg={17}>
            <div className="glass-panel" style={{ padding: '20px', minHeight: '65vh' }}>
              {selectedHook ? (
                <HookEditor
                  repoId={selectedRepoId}
                  hook={selectedHook}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, flexDirection: 'column', gap: 16 }}>
                  <Webhook size={48} color="var(--text-muted)" />
                  <Text type="secondary">Select a hook from the left to edit its script.</Text>
                </div>
              )}
            </div>
          </Col>
        </Row>
      )}
    </div>
  )
}

export default HooksPage
