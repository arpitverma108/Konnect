import React from 'react'
import { Modal, Form, Input, Typography, message } from 'antd'
import { useCreateUser } from '../../api/users'

const { Text } = Typography

const CreateUserModal = ({ visible, onClose, onSuccess }) => {
  const [form] = Form.useForm()
  const createMutation = useCreateUser()

  const handleOk = () => {
    form.validateFields().then(values => {
      createMutation.mutate(values, {
        onSuccess: (data) => {
          message.success(`User "${data?.username || values.username}" created successfully!`)
          
          form.resetFields()
          onClose()

          // 🔥 IMPORTANT: notify parent to refresh
          if (onSuccess) onSuccess()
        },
        onError: (err) => {
          const msg = err?.response?.data?.error || 'Failed to create user.'
          message.error(msg)
        },
      })
    }).catch(() => {})
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title={<span style={{ color: 'var(--text-main)', fontSize: '18px' }}>Create New User</span>}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Create User"
      confirmLoading={createMutation.isPending}
      width={400}
      className="premium-modal"
      styles={{
        content: { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)' },
        header: { backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' },
        footer: { borderTop: '1px solid var(--border-color)' },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        name="create_user_form"
        style={{ marginTop: 24 }}
      >
        <Form.Item
          name="username"
          label={<span style={{ color: 'var(--text-main)' }}>Username</span>}
          rules={[
            { required: true, message: 'Please input the username!' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: 'Only alphanumeric characters and underscores allowed.' },
          ]}
        >
          <Input style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderColor: 'var(--border-color)' }} />
        </Form.Item>

        <Form.Item name="full_name" label={<span style={{ color: 'var(--text-main)' }}>Full Name</span>}>
          <Input style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderColor: 'var(--border-color)' }} />
        </Form.Item>

        <Form.Item
          name="email"
          label={<span style={{ color: 'var(--text-main)' }}>Email</span>}
          rules={[{ type: 'email', message: 'Invalid email!' }]}
        >
          <Input style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderColor: 'var(--border-color)' }} />
        </Form.Item>

        <Form.Item
          name="password"
          label={<span style={{ color: 'var(--text-main)' }}>Password</span>}
          rules={[
            { required: true, message: 'Please input password!' },
            { min: 8, message: 'Minimum 8 characters required.' },
          ]}
        >
          <Input.Password style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderColor: 'var(--border-color)' }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CreateUserModal