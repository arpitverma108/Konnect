

import React from 'react'
import { Modal, Form, Input, message } from 'antd'
import { useCreateUser } from '../../api/users'

const CreateUserModal = ({ visible, onClose }) => {
  const [form] = Form.useForm()
  const createUser = useCreateUser()

  const handleOk = () => {
    form.validateFields().then(values => {
      createUser.mutate(values, {
        onSuccess: (data) => {
          message.success(`User "${data?.username || values.username}" created`)
          form.resetFields()
          onClose()
        },
        onError: () => {
          message.error('Failed to create user')
        },
      })
    })
  }

  return (
    <Modal
      open={visible}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={createUser.isPending}
      okText="Create User"
    >
      <Form form={form} layout="vertical">
        <Form.Item name="username" rules={[{ required: true }]}>
          <Input placeholder="Username" />
        </Form.Item>

        <Form.Item name="password" rules={[{ required: true }]}>
          <Input.Password placeholder="Password" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CreateUserModal