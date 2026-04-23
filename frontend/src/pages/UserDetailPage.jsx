// UserDetailPage.jsx
import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Typography, Button, Tabs, Tag, Descriptions, Space, Avatar,
  Divider, Switch, message, Form, Input, Popconfirm, Spin, Alert
} from 'antd'
import {
  ArrowLeft, User, Shield, KeyRound, Trash2, Save, Edit3
} from 'lucide-react'
import { useUser, useUpdateUser, useDeleteUser, useResetPassword } from '../api/users'

const { Title, Text } = Typography

const UserDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: user, isLoading, isError } = useUser(id)
  const updateMutation = useUpdateUser()
  const deleteMutation = useDeleteUser()
  const resetPwMutation = useResetPassword()

  const [editForm] = Form.useForm()
  const [pwForm] = Form.useForm()
  const [editing, setEditing] = useState(false)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (isError || !user) {
    return (
      <Alert
        type="error"
        message="User not found"
        description="This user may have been deleted or the ID is invalid."
        showIcon
        style={{ margin: 24 }}
      />
    )
  }

  const handleSaveInfo = () => {
    editForm.validateFields().then(values => {
      updateMutation.mutate(
        { id: user.id, full_name: values.full_name, email: values.email },
        {
          onSuccess: () => {
            message.success('User info updated')
            setEditing(false)
          },
          onError: () => message.error('Failed to update user'),
        }
      )
    }).catch(() => {})
  }

  const handleToggleActive = (checked) => {
    updateMutation.mutate(
      { id: user.id, isActive: checked },
      {
        onSuccess: () => message.success(`User ${checked ? 'activated' : 'deactivated'}`),
        onError: () => message.error('Failed to update status'),
      }
    )
  }

  const handleResetPassword = () => {
    pwForm.validateFields().then(values => {
      resetPwMutation.mutate(
        { id: user.id, newPassword: values.password },
        {
          onSuccess: () => {
            message.success('Password reset successfully')
            pwForm.resetFields()
          },
          onError: () => message.error('Failed to reset password'),
        }
      )
    }).catch(() => {})
  }

  const handleDelete = () => {
    deleteMutation.mutate(user.id, {
      onSuccess: () => {
        message.success(`User "${user.username}" deleted`)
        navigate('/users')
      },
      onError: () => message.error('Failed to delete user'),
    })
  }

  const initialLetter = user.username?.[0]?.toUpperCase() || 'U'

  const tabItems = [
    {
      key: 'info',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><User size={15} /> Profile</span>,
      children: (
        <div style={{ maxWidth: 560 }}>
          {editing ? (
            <Form
              form={editForm}
              layout="vertical"
              initialValues={{ full_name: user.full_name, email: user.email }}
            >
              <Form.Item name="full_name" label={<span style={{ color: 'var(--text-main)' }}>Full Name</span>}>
                <Input style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }} />
              </Form.Item>
              <Form.Item
                name="email"
                label={<span style={{ color: 'var(--text-main)' }}>Email</span>}
                rules={[{ type: 'email', message: 'Invalid email' }]}
              >
                <Input style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }} />
              </Form.Item>
              <Space>
                <Button type="primary" icon={<Save size={14} />} onClick={handleSaveInfo} loading={updateMutation.isPending}>
                  Save Changes
                </Button>
                <Button onClick={() => setEditing(false)}>Cancel</Button>
              </Space>
            </Form>
          ) : (
            <>
              <Descriptions
                bordered
                column={1}
                size="middle"
                labelStyle={{ backgroundColor: 'var(--bg-surface-hover)', color: 'var(--text-muted)', width: 160 }}
                contentStyle={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)' }}
              >
                <Descriptions.Item label="Username">
                  <Text strong>@{user.username}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Full Name">{user.full_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Email">{user.email || '—'}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Tag color={user.is_active ? 'success' : 'default'}>
                      {user.is_active ? 'Active' : 'Disabled'}
                    </Tag>
                    <Switch
                      checked={user.is_active}
                      onChange={handleToggleActive}
                      loading={updateMutation.isPending}
                      size="small"
                    />
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="Groups">
                  <Space size={[0, 8]} wrap>
                    {(user.groups || []).length > 0
                      ? user.groups.map(g => <Tag key={g} color="blue">{g}</Tag>)
                      : <Text type="secondary">No groups</Text>
                    }
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                  {user.created_at ? new Date(user.created_at).toLocaleString() : '—'}
                </Descriptions.Item>
              </Descriptions>
              <Button
                style={{ marginTop: 20 }}
                icon={<Edit3 size={14} />}
                onClick={() => {
                  editForm.setFieldsValue({ full_name: user.full_name, email: user.email })
                  setEditing(true)
                }}
              >
                Edit Profile
              </Button>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'security',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={15} /> Security</span>,
      children: (
        <div style={{ maxWidth: 400 }}>
          <Title level={5} style={{ marginBottom: 16 }}>Reset Password</Title>
          <Form form={pwForm} layout="vertical">
            <Form.Item
              name="password"
              label={<span style={{ color: 'var(--text-main)' }}>New Password</span>}
              rules={[
                { required: true, message: 'Enter a new password' },
                { min: 6, message: 'Must be at least 6 characters' },
              ]}
            >
              <Input.Password style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }} />
            </Form.Item>
            <Button
              type="primary"
              icon={<KeyRound size={14} />}
              onClick={handleResetPassword}
              loading={resetPwMutation.isPending}
            >
              Reset Password
            </Button>
          </Form>

          <Divider style={{ margin: '32px 0' }} />
          <Title level={5} style={{ color: 'var(--danger-color)', marginBottom: 16 }}>Danger Zone</Title>
          <Popconfirm
            title={`Delete user @${user.username}?`}
            description="This action cannot be undone and will remove the user from all permissions."
            onConfirm={handleDelete}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<Trash2 size={14} />} loading={deleteMutation.isPending}>
              Delete User
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, gap: 16 }}>
        <Button
          type="text"
          icon={<ArrowLeft size={20} color="var(--text-main)" />}
          onClick={() => navigate('/users')}
          style={{ padding: '4px 8px' }}
        />
        <Avatar
          size={56}
          style={{ backgroundColor: '#1890ff', fontSize: 22, fontWeight: 700, flexShrink: 0 }}
        >
          {initialLetter}
        </Avatar>
        <div>
          <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.username}
            <Tag color={user.is_active ? 'success' : 'default'} style={{ fontSize: 13 }}>
              {user.is_active ? 'Active' : 'Disabled'}
            </Tag>
          </Title>
          <Text type="secondary">{user.full_name || user.email || 'No additional info'}</Text>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px', minHeight: '60vh' }}>
        <Tabs items={tabItems} defaultActiveKey="info" />
      </div>
    </div>
  )
}

export default UserDetailPage
