import React, { useEffect } from 'react'
import { Modal, Form, Input, Typography, message } from 'antd'
import { useCreateRepository } from '../../api/repositories'
import apiClient from '../../api'

const { Text } = Typography

const CreateRepoModal = ({ visible, onClose, editMode = false, repo = null, onSuccess }) => {
  const [form] = Form.useForm()
  const createMutation = useCreateRepository()

  useEffect(() => {
    if (editMode && repo) {
      form.setFieldsValue({
        name: repo.name,
        description: repo.description
      })
    }
  }, [editMode, repo])

  const handleOk = () => {
    form.validateFields().then(async values => {
      try {
        if (editMode) {
          await apiClient.put(`/repositories/${repo.id}`, values)
          message.success('Repository updated successfully')
        } else {
          await createMutation.mutateAsync(values)
          message.success(`Repository "${values.name}" created successfully!`)
        }

        form.resetFields()
        onClose()
        onSuccess?.()
      } catch (err) {
        const msg = err?.response?.data?.error || 'Operation failed'
        message.error(msg)
      }
    }).catch(() => {})
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title={
        <span style={{ color: 'var(--text-main)', fontSize: '18px' }}>
          {editMode ? 'Edit Repository' : 'Create New Repository'}
        </span>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={editMode ? 'Update' : 'Create'}
      confirmLoading={createMutation.isPending}
      width={500}
      className="premium-modal"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
        <Form.Item
          name="name"
          label="Repository Name"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CreateRepoModal