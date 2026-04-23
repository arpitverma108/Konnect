// HookEditor.jsx
import React, { useState, useEffect } from 'react'
import { Button, Select, Space, Typography, Tag, Divider, Tooltip, message } from 'antd'
import { Save, RotateCcw, Trash2, Copy, Terminal } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { useSaveHook, useDeleteHook, useHookTemplates } from '../../api/hooks'

const { Text, Title } = Typography
const { Option } = Select

// Default bash shebang + helpful comment for new hooks
const DEFAULT_SCRIPT = `#!/bin/bash
# SVN Hook Script
# Exit with 0 to allow the operation, non-zero to reject it.

REPOS="$1"
REV="$2"
USER="$3"

exit 0
`

const MONACO_OPTIONS = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontLigatures: true,
  minimap: { enabled: false },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  padding: { top: 16, bottom: 16 },
  scrollbar: { verticalScrollbarSize: 6 },
  renderLineHighlight: 'all',
}

const HookEditor = ({ repoId, hook }) => {
  const [content, setContent] = useState(hook.content || DEFAULT_SCRIPT)
  const [isDirty, setIsDirty] = useState(false)

  const { data: templates = [] } = useHookTemplates()
  const saveMutation = useSaveHook()
  const deleteMutation = useDeleteHook()

  // Reset editor content when hook changes
  useEffect(() => {
    setContent(hook.content || DEFAULT_SCRIPT)
    setIsDirty(false)
  }, [hook.hook_name, hook.repo_id])

  const handleEditorChange = (value) => {
    setContent(value || '')
    setIsDirty(true)
  }

  const handleSave = () => {
    saveMutation.mutate(
      { repoId, hookName: hook.hook_name, content },
      {
        onSuccess: () => {
          message.success(`${hook.hook_name} saved successfully`)
          setIsDirty(false)
        },
        onError: () => message.error('Failed to save hook'),
      }
    )
  }

  const handleReset = () => {
    setContent(hook.content || DEFAULT_SCRIPT)
    setIsDirty(false)
  }

  const handleDelete = () => {
    deleteMutation.mutate(
      { repoId, hookName: hook.hook_name },
      {
        onSuccess: () => message.success(`${hook.hook_name} deleted`),
        onError: () => message.error('Failed to delete hook'),
      }
    )
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    message.success('Script copied to clipboard')
  }

  const handleLoadTemplate = (templateName) => {
    // Just set a placeholder — in real usage backend returns template content
    setContent(`#!/bin/bash\n# Template: ${templateName}\n# TODO: Implement hook logic\n\nexit 0\n`)
    setIsDirty(true)
    message.info(`Loaded template: ${templateName}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'rgba(24, 144, 255, 0.1)', padding: 8, borderRadius: 8, display: 'flex' }}>
            <Terminal size={20} color="var(--primary-color)" />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {hook.hook_name}
              {isDirty && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f5a623', display: 'inline-block', marginLeft: 8 }} />
              )}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Bash shell script · {hook.is_enabled ? (
                <Tag color="success" style={{ fontSize: 10, marginLeft: 4 }}>Enabled</Tag>
              ) : (
                <Tag color="default" style={{ fontSize: 10, marginLeft: 4 }}>Disabled</Tag>
              )}
            </Text>
          </div>
        </div>

        <Space>
          {templates.length > 0 && (
            <Select
              placeholder="Load template..."
              style={{ width: 180 }}
              onChange={handleLoadTemplate}
              value={null}
            >
              {templates.map(t => (
                <Option key={t} value={t}>{t}</Option>
              ))}
            </Select>
          )}
          <Tooltip title="Copy script"><Button icon={<Copy size={16} />} onClick={handleCopy} /></Tooltip>
          <Tooltip title="Reset changes"><Button icon={<RotateCcw size={16} />} onClick={handleReset} disabled={!isDirty} /></Tooltip>
          <Button
            danger
            icon={<Trash2 size={16} />}
            onClick={handleDelete}
            loading={deleteMutation.isPending}
          >
            Delete
          </Button>
          <Button
            type="primary"
            icon={<Save size={16} />}
            onClick={handleSave}
            loading={saveMutation.isPending}
            disabled={!isDirty}
          >
            Save Hook
          </Button>
        </Space>
      </div>

      <Divider style={{ margin: '0 0 16px' }} />

      {/* Monaco Editor */}
      <div style={{ 
        flex: 1, 
        minHeight: 420, 
        border: '1px solid var(--border-color)', 
        borderRadius: 8, 
        overflow: 'hidden',
        background: '#0d1117'
      }}>
        <Editor
          height="100%"
          defaultLanguage="shell"
          value={content}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={MONACO_OPTIONS}
        />
      </div>
    </div>
  )
}

export default HookEditor
