import React, { useState } from 'react'
import { Form, Input, Button, Typography, Card, Select, message } from 'antd'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

const RegisterPage = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onFinish = (values) => {
    setLoading(true)

    // 🔥 Fake register (no backend)
    setTimeout(() => {
      message.success('Registered successfully')

      localStorage.setItem('registeredUser', JSON.stringify(values))

      setLoading(false)
      navigate('/login')
    }, 800)
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

          <Form.Item name="username" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>

          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="USER">Developer</Select.Option>
              <Select.Option value="ADMIN">Admin</Select.Option>
              <Select.Option value="SUPER_ADMIN">Super Admin</Select.Option>
            </Select>
          </Form.Item>

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