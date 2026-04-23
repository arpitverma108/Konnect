// CreateRepoModal.jsx
import React from 'react'
import { Modal, Form, Input, Switch, Button, Typography, message } from 'antd'
import { useCreateRepository } from '../../api/repositories'

const { Text } = Typography

const CreateRepoModal = ({ visible, onClose }) => {
  const [form] = Form.useForm()
  const createMutation = useCreateRepository()

  const handleOk = () => {
    form.validateFields().then(values => {
      createMutation.mutate(values, {
        onSuccess: (data) => {
          message.success(`Repository "${data?.name || values.name}" created successfully!`)
          form.resetFields()
          onClose()
        },
        onError: (err) => {
          const msg = err?.response?.data?.error || 'Failed to create repository.'
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
      title={<span style={{ color: 'var(--text-main)', fontSize: '18px' }}>Create New Repository</span>}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Create"
      confirmLoading={createMutation.isPending}
      width={500}
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
        name="create_repo_form"
        initialValues={{ createStandardLayout: true }}
        style={{ marginTop: 24 }}
      >
        <Form.Item
          name="name"
          label={<span style={{ color: 'var(--text-main)' }}>Repository Name</span>}
          rules={[
            { required: true, message: 'Please input the repository name!' },
            { pattern: /^[a-zA-Z0-9-_]+$/, message: 'Only alphanumeric characters, dashes, and underscores allowed.' }
          ]}
        >
          <Input
            placeholder="e.g. my-awesome-project"
            style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderColor: 'var(--border-color)' }}
          />
        </Form.Item>

        <Form.Item
          name="description"
          label={<span style={{ color: 'var(--text-main)' }}>Description (Optional)</span>}
        >
          <Input.TextArea
            rows={3}
            placeholder="What is this repository for?"
            style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderColor: 'var(--border-color)' }}
          />
        </Form.Item>

        <Form.Item name="createStandardLayout" valuePropName="checked">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Switch />
            <Text style={{ color: 'var(--text-main)' }}>
              Create standard layout (trunk, branches, tags)
            </Text>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CreateRepoModal
