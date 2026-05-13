

import React, { useState } from 'react'
import {
  Table,
  Tag,
  Space,
  Button,
  Typography,
  Dropdown,
  Popconfirm,
  message,
  Empty,
} from 'antd'
import { MoreVertical, Edit, Trash2, KeyRound, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useDeleteUser } from '../../api/users'
import useRole from '../../hooks/useRole'

const { Text } = Typography

const UserList = ({
  users = [],
  loading = false,
  searchTerm = '',
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
}) => {
  const navigate = useNavigate()

  const { mutate: deleteUser } = useDeleteUser()
  const [deletingId, setDeletingId] = useState(null)

const user =
  JSON.parse(
    localStorage.getItem('user')
  )

const {
  isSuperAdmin: canDelete,
} = useRole(user)

  const handleDelete = (id) => {
    setDeletingId(id)

    deleteUser(id, {
      onSuccess: () => {
        message.success('User deleted successfully')
        setDeletingId(null)
      },
      onError: () => {
        message.error('Delete failed')
        setDeletingId(null)
      },
    })
  }

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => (
        <Button
          type="link"
          style={{ padding: 0, fontWeight: 600 }}
          onClick={() => navigate(`/users/${record.id}`)}
          icon={<User size={14} />}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <div>
          <Text>{record.full_name || '–'}</Text>
          <br />
          <Text type="secondary">{record.email || '–'}</Text>
        </div>
      ),
    },
    {
  title: 'Role',
  dataIndex: 'role',
  render: (role) => {
    const r = role || 'viewer'

    const roleColors = {
      super_admin: 'gold',
      admin: 'purple',
      viewer: 'default',
    }

    return (
      <Tag
        color={roleColors[r] || 'default'}
        style={{
          fontWeight: 500,
          letterSpacing: 0.5,
        }}
      >
        {r.replace('_', ' ').toUpperCase()}
      </Tag>
    )
  },
},
    {
      title: 'Status',
      dataIndex: 'is_active',
      render: (active) => (
        <Tag color={active ? 'green' : 'default'}>
          {active ? 'Active' : 'Disabled'}
        </Tag>
      ),
    },
    {
      title: 'Groups',
      dataIndex: 'groups',
      render: (groups = []) =>
        groups.length ? (
          <Space wrap>
            {groups.map((g, i) => (
              <Tag key={i}>{g}</Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      render: (d) => (d ? dayjs(d).format('YYYY-MM-DD') : '–'),
    },
    {
      title: 'Action',
      align: 'right',
      render: (_, record) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'edit',
                icon: <Edit size={14} />,
                label: 'Edit',
                onClick: () => navigate(`/users/${record.id}`),
              },
              ...(canDelete
                ? [
                    {
                      key: 'delete',
                      label: (
                        <Popconfirm
                          title="Delete user"
                          onConfirm={() => handleDelete(record.id)}
                          okButtonProps={{
                            loading: deletingId === record.id,
                            danger: true,
                          }}
                        >
                          <span style={{ color: 'red' }}>Delete</span>
                        </Popconfirm>
                      ),
                    },
                  ]
                : []),
            ],
          }}
        >
          <Button type="text" icon={<MoreVertical size={16} />} />
        </Dropdown>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      dataSource={users}
      rowKey="id"
      loading={loading}
      locale={{
        emptyText: (
          <Empty
            description={
              searchTerm
                ? `No users matching "${searchTerm}"`
                : 'No users found'
            }
          />
        ),
      }}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: false,
        onChange: (p) => onPageChange?.(p),
      }}
    />
  )
}

export default UserList