import React, { useState } from 'react'
import { Modal, Input, Button, List, Avatar, Tag, Space, Typography, Spin, Divider, message } from 'antd'
import { UserPlus, UserMinus, Users, Search } from 'lucide-react'
import { useGroupMembers, useAddGroupMember, useRemoveGroupMember } from '../../api/groups'
import { useUsers } from '../../api/users'

const { Text, Title } = Typography

const ManageMembersModal = ({ group, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('')

  const { data: members = [], isLoading: membersLoading } = useGroupMembers(group?.id)
  const { data: allUsers = [] } = useUsers()
  const addMutation = useAddGroupMember()
  const removeMutation = useRemoveGroupMember()

  if (!group) return null

  const memberUsernames = new Set(members.map(m => m.username))
  const nonMembers = allUsers.filter(
    u => !memberUsernames.has(u.username) &&
         u.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAdd = (username) => {
    addMutation.mutate(
      { groupId: group.id, username },
      {
        onSuccess: () => message.success(`Added @${username} to @${group.name}`),
        onError: () => message.error('Failed to add member'),
      }
    )
  }

  const handleRemove = (username) => {
    removeMutation.mutate(
      { groupId: group.id, username },
      {
        onSuccess: () => message.success(`Removed @${username} from @${group.name}`),
        onError: () => message.error('Failed to remove member'),
      }
    )
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={20} color="var(--primary-color)" />
          <span style={{ color: 'var(--text-main)', fontSize: '18px' }}>
            Manage Members — <Tag color="cyan">@{group.name}</Tag>
          </span>
        </div>
      }
      open={!!group}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      width={560}
      styles={{
        content: { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)' },
        header: { backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' },
        footer: { borderTop: '1px solid var(--border-color)' },
      }}
    >
      {/* Current Members */}
      <Title level={5} style={{ marginTop: 8, marginBottom: 12 }}>
        Current Members ({members.length})
      </Title>
      {membersLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spin /></div>
      ) : members.length === 0 ? (
        <Text type="secondary">No members yet.</Text>
      ) : (
        <List
          size="small"
          dataSource={members}
          renderItem={(member) => (
            <List.Item
              style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}
              actions={[
                <Button
                  key="remove"
                  type="text"
                  danger
                  size="small"
                  icon={<UserMinus size={14} />}
                  loading={removeMutation.isPending}
                  onClick={() => handleRemove(member.username)}
                />
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar size="small" style={{ backgroundColor: '#1890ff' }}>{member.username[0].toUpperCase()}</Avatar>}
                title={<Text style={{ color: 'var(--text-main)' }}>{member.username}</Text>}
                description={<Text type="secondary" style={{ fontSize: 12 }}>{member.full_name || member.email || ''}</Text>}
              />
            </List.Item>
          )}
        />
      )}

      <Divider style={{ margin: '20px 0 16px' }} />

      {/* Add Members */}
      <Title level={5} style={{ marginBottom: 12 }}>Add Members</Title>
      <Input
        placeholder="Search users to add..."
        prefix={<Search size={16} color="var(--text-muted)" />}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ marginBottom: 12, backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
      />
      {nonMembers.length === 0 ? (
        <Text type="secondary">
          {searchTerm ? `No users matching "${searchTerm}"` : 'All users are already members.'}
        </Text>
      ) : (
        <List
          size="small"
          dataSource={nonMembers.slice(0, 8)}
          renderItem={(user) => (
            <List.Item
              style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}
              actions={[
                <Button
                  key="add"
                  type="primary"
                  ghost
                  size="small"
                  icon={<UserPlus size={14} />}
                  loading={addMutation.isPending}
                  onClick={() => handleAdd(user.username)}
                >
                  Add
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar size="small" style={{ backgroundColor: '#30363d' }}>{user.username[0].toUpperCase()}</Avatar>}
                title={<Text style={{ color: 'var(--text-main)' }}>{user.username}</Text>}
                description={<Text type="secondary" style={{ fontSize: 12 }}>{user.full_name || user.email || ''}</Text>}
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  )
}

export default ManageMembersModal
