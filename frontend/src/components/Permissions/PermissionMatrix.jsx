// PermissionMatrix.jsx
import React, { useState, useRef } from 'react'
import { Table, Radio, Tag, Input, Typography, Button, Spin, Alert, message, Space } from 'antd'
import { Users, User, Search, Save } from 'lucide-react'
import { usePermissions, useSavePermission } from '../../api/permissions'

const { Text } = Typography

const PermissionMatrix = ({ repoId, path }) => {
  const [searchTerm, setSearchTerm] = useState('')
  // Local overrides until saved: { [subjectKey]: permValue }
  const [localChanges, setLocalChanges] = useState({})

  const { data: permissions = [], isLoading, isError, refetch } = usePermissions(repoId)
  const saveMutation = useSavePermission(repoId)

  const filteredPerms = permissions.filter(p =>
    (p.subject_name || p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getSubjectKey = (record) => `${record.subject_type || record.type}_${record.subject_name || record.name}`

  const handlePermissionChange = (record, value) => {
    const key = getSubjectKey(record)
    setLocalChanges(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    const entries = Object.entries(localChanges)
    if (entries.length === 0) return

    // For each changed permission, save via API
    const promises = filteredPerms
      .filter(p => localChanges[getSubjectKey(p)] !== undefined)
      .map(p => {
        const newPerm = localChanges[getSubjectKey(p)]
        return saveMutation.mutateAsync({
          repo_id: repoId,
          path,
          subject_type: p.subject_type || p.type,
          subject_name: p.subject_name || p.name,
          permission: newPerm,
        })
      })

    Promise.all(promises)
      .then(() => {
        message.success(`Saved ${entries.length} permission change${entries.length > 1 ? 's' : ''}`)
        setLocalChanges({})
        refetch()
      })
      .catch(() => message.error('Failed to save some permissions'))
  }

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
  }

  if (isError) {
    return <Alert type="error" message="Failed to load permissions" showIcon />
  }

  const hasChanges = Object.keys(localChanges).length > 0

  const columns = [
    {
      title: 'Subject',
      key: 'name',
      render: (_, record) => {
        const name = record.subject_name || record.name
        const type = record.subject_type || record.type
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {type === 'group' ? (
              <Tag color="cyan" icon={<Users size={12} style={{ marginRight: 4 }} />}>@{name}</Tag>
            ) : (
              <Tag color="default" icon={<User size={12} style={{ marginRight: 4 }} />}>{name}</Tag>
            )}
          </span>
        )
      },
    },
    {
      title: 'Type',
      key: 'type',
      width: 100,
      render: (_, record) => (
        <Text type="secondary" style={{ textTransform: 'capitalize' }}>
          {record.subject_type || record.type}
        </Text>
      ),
    },
    {
      title: 'Access Level',
      key: 'permission',
      width: 310,
      render: (_, record) => {
        const key = getSubjectKey(record)
        const currentValue = localChanges[key] !== undefined
          ? localChanges[key]
          : (record.permission || '')
        return (
          <Radio.Group
            value={currentValue}
            onChange={e => handlePermissionChange(record, e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="small"
          >
            <Radio.Button value="">None</Radio.Button>
            <Radio.Button value="r">Read</Radio.Button>
            <Radio.Button value="rw">Read / Write</Radio.Button>
          </Radio.Group>
        )
      },
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Input
          placeholder="Filter users or groups..."
          prefix={<Search size={16} color="var(--text-muted)" />}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ maxWidth: 300, backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
        />
        {hasChanges && (
          <Button
            type="primary"
            icon={<Save size={16} />}
            onClick={handleSave}
            loading={saveMutation.isPending}
          >
            Save Changes ({Object.keys(localChanges).length})
          </Button>
        )}
      </div>
      <Table
        columns={columns}
        dataSource={filteredPerms}
        rowKey={(r) => getSubjectKey(r)}
        pagination={false}
        rowClassName={(record) => {
          const key = getSubjectKey(record)
          return localChanges[key] !== undefined ? 'premium-table-row table-row-changed' : 'premium-table-row'
        }}
        locale={{ emptyText: 'No permission rules for this path and repository.' }}
      />
    </div>
  )
}

export default PermissionMatrix
