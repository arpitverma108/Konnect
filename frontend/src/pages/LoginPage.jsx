
import React, { useState } from 'react'
import { Form, Input, Button, Typography, Card, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import apiClient from '../api'
import useAppStore from '../store'   // 🔥 added
import { queryClient } from '../lib/queryClient'
const { Title, Text } = Typography

const LoginPage = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

 const onFinish = async (
  values
) => {
  setLoading(true)

  try {
    const res =
      await apiClient.post(
        '/auth/login',
        {
          username:
            values.username,

          password:
            values.password,
        }
      )

    const { setAuth } =
      useAppStore.getState()

    // Store ONLY tokens
    setAuth({
      token:
        res.accessToken,

      refreshToken:
        res.refreshToken,
    })

 

    // Refresh authenticated user
    await queryClient.invalidateQueries({
      queryKey: ['users', 'me'],
    })

    message.success(
      'Login successful'
    )

    navigate('/dashboard')

  } catch (err) {

    const errorMsg =
      err?.response?.data
        ?.error ||
      'Invalid username or password'

    message.error(errorMsg)

  } finally {

    setLoading(false)
  }
}
//
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-color)',
    }}>
      <Card className="premium-card" style={{ width: 360 }}>
        <Title level={3} style={{ textAlign: 'center' }}>
          Login
        </Title>

        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block>
            Login
          </Button>
        </Form>

        <Text style={{ display: 'block', marginTop: 16, textAlign: 'center' }}>
          Don’t have an account?{' '}
          <span
  style={{
    cursor:'pointer',
    color:'var(--primary-color)',
  }}

  onClick={()=>
    navigate('/register')
  }
>
            Register
          </span>
        </Text>
      </Card>
    </div>
  )
}

export default LoginPage