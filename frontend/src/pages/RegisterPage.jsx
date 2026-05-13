import React, { useState } from 'react'
import { Form, Input, Button, Typography, Card, Select, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import apiClient from '../api/index'

const { Title, Text } = Typography

const RegisterPage = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onFinish = async (values) => {
    setLoading(true)

    try {
      await apiClient.post('/auth/register', {
        username: values.username,
        password: values.password,
      })

      message.success('Registered successfully! Please login.')
      navigate('/login')

    } catch (err) {
      console.error('Register Error:', err)
      const errorMsg = err?.response?.data?.error || 'Registration failed'
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-color)'
    }}>
      <Card className="premium-card" style={{ width: 380 }}>

        <Title level={3} style={{ textAlign: 'center' }}>
          Register
        </Title>

        <Form layout="vertical" onFinish={onFinish}>

          <Form.Item
            name="username"
            label="Username"
            rules={[
              { required: true, message: 'Username is required' },
              { min: 3, message: 'Minimum 3 characters' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Password is required' },
              { min: 8, message: 'Minimum 8 characters' },
            ]}
          >
            <Input.Password />
          </Form.Item>

          {/* <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="super_admin">Super Admin</Select.Option>
              <Select.Option value="viewer">Viewer</Select.Option>
            </Select>
          </Form.Item> */}

          <Button type="primary" htmlType="submit" loading={loading} block>
            Register
          </Button>

        </Form>

        <Text style={{ display: 'block', marginTop: 16, textAlign: 'center' }}>
          Already have an account?{' '}
          <span
            style={{ color: 'var(--primary-color)', cursor: 'pointer' }}
            onClick={() => navigate('/login')}
          >
            Login
          </span>
        </Text>

      </Card>
    </div>
  )
}

export default RegisterPage
