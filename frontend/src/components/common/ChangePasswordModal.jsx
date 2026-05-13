import React, { useState } from 'react'
import { Modal, Form, Input, message } from 'antd'

import apiClient from '../../api'
import { useMe } from '../../api/users'

const ChangePasswordModal = ({
  open,
  onClose,
}) => {

  const [form] = Form.useForm()

  const [loading, setLoading] =
    useState(false)

  const { data: me } = useMe()

  const handleSubmit = async () => {

    try {

      const values =
        await form.validateFields()

      if (!me?.id) {
        message.error(
          'User session not found'
        )

        return
      }

      setLoading(true)

      await apiClient.put(
        `/users/${me.id}/password`,
        {
          old_password:
            values.oldPassword,

          new_password:
            values.newPassword,
        }
      )

      message.success(
        'Password changed successfully'
      )

      form.resetFields()

      onClose()

    } catch (err) {

      // interceptor handles API errors

    } finally {

      setLoading(false)
    }
  }

  return (
    <Modal
      title="Change Password"
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      okText="Update Password"
      confirmLoading={loading}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
      >

        <Form.Item
          name="oldPassword"
          label="Current Password"
          rules={[
            {
              required: true,
              message:
                'Enter current password',
            },
          ]}
        >
          <Input.Password />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label="New Password"
          rules={[
            {
              required: true,
              message:
                'Enter new password',
            },

            {
              min: 8,
              message:
                'Minimum 8 characters',
            },
          ]}
        >
          <Input.Password />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirm Password"
          dependencies={[
            'newPassword',
          ]}

          rules={[
            {
              required: true,
              message:
                'Confirm password',
            },

            ({ getFieldValue }) => ({

              validator(_, value) {

                if (
                  !value ||

                  getFieldValue(
                    'newPassword'
                  ) === value
                ) {
                  return Promise.resolve()
                }

                return Promise.reject(
                  new Error(
                    'Passwords do not match'
                  )
                )
              },
            }),
          ]}
        >
          <Input.Password />
        </Form.Item>

      </Form>
    </Modal>
  )
}

export default ChangePasswordModal