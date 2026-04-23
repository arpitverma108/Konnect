// GroupsPage.jsx
import React, { useState } from 'react'
import { Table, Tag, Space, Button, Typography, Spin, Alert, Popconfirm, message } from 'antd'
import { Plus, Users, Trash2, Settings } from 'lucide-react'
import { useGroups, useDeleteGroup } from '../api/groups'
import CreateGroupModal from '../components/Groups/CreateGroupModal'
import ManageMembersModal from '../components/Groups/ManageMembersModal'

const { Title, Text } = Typography

const GroupsPage = () => {
  const { data: groups = [], isLoading, isError } = useGroups()
  const deleteMutation = useDeleteGroup()

  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [managingGroup, setManagingGroup] = useState(null) // group object or null

  const handleDelete = (group) => {
    deleteMutation.mutate(group.id, {
      onSuccess: () => message.success(`Group "@${group.name}" deleted`),
      onError: () => message.error('Failed to delete group'),
    })
  }

  const columns = [
    {
      title: 'Group Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Tag color="cyan">@{text}</Tag>
        </span>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (d) => d || <Text type="secondary">—</Text>,
    },
    {
      title: 'Members',
      dataIndex: 'members_count',
      key: 'members_count',
      render: (count) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Users size={14} color="var(--text-muted)" />
          <Text type="secondary">{count ?? '–'}</Text>
        </span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<Settings size={14} />}
            onClick={() => setManagingGroup(record)}
          >
            Manage Members
          </Button>
          <Popconfirm
            title={`Delete @${record.name}?`}
            description="This will remove the group from all permission rules."
            onConfirm={() => handleDelete(record)}
            okText="Delete"
            okButtonProps={{ danger: true }}
            placement="left"
          >
            <Button
              type="text"
              danger
              icon={<Trash2 size={14} />}
              loading={deleteMutation.isPending}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="groups-container" style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Groups Management</Title>
          <Text type="secondary">Define groups to assign permissions globally.</Text>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => setCreateModalVisible(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          Create Group
        </Button>
      </div>

      <div className="glass-panel" style={{ padding: '24px', minHeight: '60vh' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : isError ? (
          <Alert type="error" message="Failed to load groups" showIcon />
        ) : (
          <Table
            columns={columns}
            dataSource={groups}
            rowKey="id"
            pagination={false}
            rowClassName={() => 'premium-table-row'}
            locale={{ emptyText: 'No groups yet. Create one!' }}
          />
        )}
      </div>

      <CreateGroupModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
      />

      <ManageMembersModal
        group={managingGroup}
        onClose={() => setManagingGroup(null)}
      />
    </div>
  )
}

export default GroupsPage
