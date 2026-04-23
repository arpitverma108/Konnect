import React, { useState } from 'react'
import { Form, Input, Button, Typography, Card } from 'antd'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

const LoginPage = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onFinish = async (values) => {
  setLoading(true)

  setTimeout(() => {
    const savedUser = JSON.parse(localStorage.getItem('registeredUser'))

    if (
      savedUser &&
      savedUser.username === values.username &&
      savedUser.password === values.password
    ) {
      // ✅ Use actual registered role
      const user = {
        username: savedUser.username,
        role: savedUser.role
      }

      localStorage.setItem('token', 'demo-token')
      localStorage.setItem('user', JSON.stringify(user))

      navigate('/dashboard')
    } else {
      alert('Invalid username or password')
    }

    setLoading(false)
  }, 500)
}

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-color)'
    }}>

      <Card
        className="premium-card"
        style={{ width: 360 }}
      >
        <Title level={3} style={{ textAlign: 'center' }}>
          Login
        </Title>

        <Form layout="vertical" onFinish={onFinish}>

          <Form.Item
            name="username"
            label={<span style={{ color: 'var(--text-main)' }}>Username</span>}
            rules={[{ required: true, message: 'Enter username' }]}
          >
            <Input
              placeholder="Enter username"
              style={{
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-main)',
                borderColor: 'var(--border-color)'
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ color: 'var(--text-main)' }}>Password</span>}
            rules={[{ required: true, message: 'Enter password' }]}
          >
            <Input.Password
              placeholder="Enter password"
              style={{
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-main)',
                borderColor: 'var(--border-color)'
              }}
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
          >
            Login
          </Button>

        </Form>

        <Text style={{ display: 'block', marginTop: 16, textAlign: 'center' }}>
          Don’t have an account?{' '}
          <span
            style={{ color: 'var(--primary-color)', cursor: 'pointer' }}
            onClick={() => navigate('/register')}
          >
            Register
          </span>
        </Text>

      </Card>
    </div>
  )
}

export default LoginPage