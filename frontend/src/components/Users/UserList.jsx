import React from 'react'
import { Table, Tag, Space, Button, Typography, Dropdown, Spin, Alert } from 'antd'
import { MoreVertical, Edit, Trash2, KeyRound, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const { Text } = Typography

const UserList = ({ users = [], loading = false, searchTerm = '' }) => {
  const navigate = useNavigate()

  //  FILTER
  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  //  LOADING UI
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  //  EMPTY STATE
  if (!loading && users.length === 0) {
    return (
      <Alert
        type="info"
        message="No users found"
        description="Users will appear here once backend is connected."
        showIcon
        style={{ marginTop: 24 }}
      />
    )
  }

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => (
        <Button
          type="link"
          style={{
            padding: 0,
            height: 'auto',
            fontWeight: 600,
            color: 'var(--primary-color)'
          }}
          onClick={() => navigate(`/users/${record.id}`)}
          icon={<User size={14} style={{ marginRight: 4 }} />}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Full Name / Email',
      key: 'details',
      render: (_, record) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text>{record.full_name || '–'}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.email || '–'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'status',
      render: (active) => (
        <Tag color={active ? 'success' : 'default'}>
          {active ? 'Active' : 'Disabled'}
        </Tag>
      ),
    },
    {
      title: 'Groups',
      dataIndex: 'groups',
      key: 'groups',
      render: (groups = []) => (
        <Space size={[0, 8]} wrap>
          {groups.map(g => (
            <Tag key={g} color="blue">{g}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) =>
        date ? dayjs(date).format('YYYY-MM-DD') : '–',
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right',
      render: (_, record) => {
        const items = [
          {
            key: 'edit',
            icon: <Edit size={14} />,
            label: 'Edit User',
            onClick: () => navigate(`/users/${record.id}`),
          },
          {
            key: 'password',
            icon: <KeyRound size={14} />,
            label: 'Reset Password',
          },
          { type: 'divider' },
          {
            key: 'delete',
            danger: true,
            icon: <Trash2 size={14} />,
            label: 'Delete User',
            // 🔥 handled later in UsersPage
          },
        ]

        return (
          <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<MoreVertical size={16} />} />
          </Dropdown>
        )
      },
    },
  ]

  return (
    <Table
      columns={columns}
      dataSource={filteredUsers}
      rowKey="id"
      pagination={{ pageSize: 10 }}
      locale={{
        emptyText: searchTerm
          ? `No users matching "${searchTerm}"`
          : 'No users found'
      }}
    />
  )
}

export default UserList