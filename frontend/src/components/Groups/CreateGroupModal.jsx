import React, { useState } from 'react'
import { Modal, Form, Input, Button, message } from 'antd'
import { useCreateGroup } from '../../api/groups'

const CreateGroupModal = ({ visible, onClose }) => {
  const [form] = Form.useForm()
  const createMutation = useCreateGroup()

  const handleOk = () => {
    form.validateFields().then(values => {
      createMutation.mutate(values, {
        onSuccess: (data) => {
          message.success(`Group "@${data?.name || values.name}" created!`)
          form.resetFields()
          onClose()
        },
        onError: (err) => {
          const msg = err?.response?.data?.error || 'Failed to create group.'
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
      title={<span style={{ color: 'var(--text-main)', fontSize: '18px' }}>Create New Group</span>}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Create Group"
      confirmLoading={createMutation.isPending}
      width={420}
      styles={{
        content: { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)' },
        header: { backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' },
        footer: { borderTop: '1px solid var(--border-color)' },
      }}
    >
      <Form form={form} layout="vertical" name="create_group_form" style={{ marginTop: 24 }}>
        <Form.Item
          name="name"
          label={<span style={{ color: 'var(--text-main)' }}>Group Name</span>}
          rules={[
            { required: true, message: 'Group name is required.' },
            { pattern: /^[a-z0-9_-]+$/, message: 'Lowercase letters, numbers, dashes and underscores only.' },
          ]}
        >
          <Input
            prefix="@"
            placeholder="e.g. developers"
            style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderColor: 'var(--border-color)' }}
          />
        </Form.Item>

        <Form.Item
          name="description"
          label={<span style={{ color: 'var(--text-main)' }}>Description (Optional)</span>}
        >
          <Input.TextArea
            rows={2}
            placeholder="What is this group for?"
            style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderColor: 'var(--border-color)' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CreateGroupModal
