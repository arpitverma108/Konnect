import React from 'react'
import { List, Switch, Tag, Tooltip, Typography, Badge } from 'antd'
import { Terminal, CheckCircle2, Circle } from 'lucide-react'
import { useToggleHook } from '../../api/hooks'
import { message } from 'antd'

const { Text } = Typography

// Human-readable descriptions for each hook name
const HOOK_META = {
  'pre-commit':        { color: '#f5a623', desc: 'Runs before a commit is accepted.' },
  'post-commit':       { color: '#7ed321', desc: 'Runs after a successful commit.' },
  'pre-revprop-change':{ color: '#9b59b6', desc: 'Runs before a revision property is changed.' },
  'post-revprop-change':{ color: '#3498db', desc: 'Runs after a revision property is changed.' },
  'start-commit':      { color: '#e74c3c', desc: 'Runs before the commit transaction starts.' },
}

const HookList = ({ repoId, hooks, selectedHookName, onSelectHook }) => {
  const toggleMutation = useToggleHook()

  const handleToggle = (e, hook) => {
    // Prevent row click when toggling the switch
    e.stopPropagation()
    toggleMutation.mutate(
      { repoId, hookName: hook.hook_name, isEnabled: !hook.is_enabled },
      {
        onSuccess: () => message.success(`${hook.hook_name} ${!hook.is_enabled ? 'enabled' : 'disabled'}`),
        onError: () => message.error('Failed to toggle hook'),
      }
    )
  }

  return (
    <List
      dataSource={hooks}
      split={false}
      renderItem={(hook) => {
        const isSelected = hook.hook_name === selectedHookName
        const meta = HOOK_META[hook.hook_name] || { color: '#8b949e', desc: 'SVN hook script.' }
        const hasContent = hook.content && hook.content.trim().length > 0

        return (
          <List.Item
            key={hook.hook_name}
            onClick={() => onSelectHook(hook.hook_name)}
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              marginBottom: 6,
              cursor: 'pointer',
              background: isSelected ? 'rgba(24, 144, 255, 0.12)' : 'transparent',
              border: isSelected
                ? '1px solid rgba(24, 144, 255, 0.4)'
                : '1px solid transparent',
              transition: 'all 0.15s ease',
            }}
            className="hook-list-item"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <div style={{ 
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                backgroundColor: hook.is_enabled ? '#238636' : 'var(--text-muted)' 
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text strong style={{ fontSize: 13, color: 'var(--text-main)' }}>
                    {hook.hook_name}
                  </Text>
                  {hasContent && (
                    <Tag color="geekblue" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', marginRight: 0 }}>
                      script
                    </Tag>
                  )}
                </div>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                  {meta.desc}
                </Text>
              </div>
              <Tooltip title={hook.is_enabled ? 'Disable' : 'Enable'}>
                <Switch
                  size="small"
                  checked={hook.is_enabled}
                  loading={toggleMutation.isPending}
                  onClick={(_, e) => handleToggle(e, hook)}
                />
              </Tooltip>
            </div>
          </List.Item>
        )
      }}
    />
  )
}

export default HookList
