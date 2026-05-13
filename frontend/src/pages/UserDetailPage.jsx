import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Typography, Button, Tabs, Tag, Descriptions, Space, Avatar,
  Divider, Switch, message, Form, Input, Popconfirm, Spin, Alert, Select
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
        {
          id: user.id,
          fullName: values.full_name,
          email: values.email,
          role: values.role // ✅ FIX
        },
        {
          onSuccess: () => {
            message.success('User info updated')
            setEditing(false)
          },
          onError: () => message.error('Failed to update user'),
        }
      )
    })
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
    })
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
      label: <span><User size={15} /> Profile</span>,
      children: (
        <div style={{ maxWidth: 560 }}>
          {editing ? (
            <Form
              form={editForm}
              layout="vertical"
              initialValues={{
                full_name: user.full_name,
                email: user.email,
                role: user.role || 'viewer' // ✅ FIX
              }}
            >
              <Form.Item name="full_name" label="Full Name">
                <Input />
              </Form.Item>

              <Form.Item name="email" label="Email">
                <Input />
              </Form.Item>

              {/* ✅ ROLE FIELD */}
              <Form.Item name="role" label="Role">
                <Select>
                  <Select.Option value="viewer">Viewer</Select.Option>
                  <Select.Option value="admin">Admin</Select.Option>
                  <Select.Option value="super_admin">Super Admin</Select.Option>
                </Select>
              </Form.Item>

              <Space>
                <Button type="primary" onClick={handleSaveInfo}>
                  Save
                </Button>
                <Button onClick={() => setEditing(false)}>Cancel</Button>
              </Space>
            </Form>
          ) : (
            <>
              <Descriptions bordered column={1}>
                <Descriptions.Item label="Username">
                  @{user.username}
                </Descriptions.Item>

                <Descriptions.Item label="Full Name">
                  {user.full_name || '—'}
                </Descriptions.Item>

                <Descriptions.Item label="Email">
                  {user.email || '—'}
                </Descriptions.Item>

                <Descriptions.Item label="Status">
                  <Switch
                    checked={user.is_active}
                    onChange={handleToggleActive}
                  />
                </Descriptions.Item>

                {/* ✅ ROLE DISPLAY */}
                <Descriptions.Item label="Role">
                  <Tag>
                    {(user.role || 'viewer').toUpperCase()}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>

              <Button onClick={() => {
                editForm.setFieldsValue({
                  full_name: user.full_name,
                  email: user.email,
                  role: user.role || 'viewer' // ✅ FIX
                })
                setEditing(true)
              }}>
                Edit
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <Button onClick={() => navigate('/users')}>
        Back
      </Button>

      <Title>{user.username}</Title>

      <Tabs items={tabItems} />
    </div>
  )
}

export default UserDetailPage