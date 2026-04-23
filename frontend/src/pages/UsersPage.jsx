import React, { useEffect, useState } from 'react'
import { Typography, Button, Input, message } from 'antd'
import { UserPlus, Search } from 'lucide-react'
import UserList from '../components/Users/UserList'
import CreateUserModal from '../components/Users/CreateUserModal'

//  import  API
import { getUsers } from '../api/users'

const { Title, Text } = Typography

const UsersPage = () => {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  //  FETCH USERS
  const fetchUsers = async () => {
    try {
      setLoading(true)

      const res = await getUsers()   // 🔥 backend call
      setUsers(res.data || res)      // support axios or fetch

    } catch (err) {
      console.error(err)
      message.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <div className="users-container" style={{ paddingBottom: 24 }}>
      
      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24
      }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Users Management
          </Title>
          <Text type="secondary">
            Manage access and sync with htpasswd
          </Text>
        </div>

        <Button 
          type="primary" 
          icon={<UserPlus size={16} />} 
          onClick={() => setIsModalVisible(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          Add User
        </Button>
      </div>

      {/* MAIN PANEL */}
      <div className="glass-panel" style={{ padding: '24px', minHeight: '60vh' }}>
        
        {/* SEARCH */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 24
        }}>
          <Input 
            size="large" 
            placeholder="Search users..." 
            prefix={<Search size={18} style={{ color: 'var(--text-muted)' }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              maxWidth: 300,
              backgroundColor: 'var(--bg-color)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-main)'
            }}
          />
        </div>

        {/* USER LIST */}
        <UserList 
          users={users}
          loading={loading}
          searchTerm={searchTerm}
        />

      </div>

      {/* MODAL */}
      <CreateUserModal 
        visible={isModalVisible} 
        onClose={() => setIsModalVisible(false)} 
        onSuccess={fetchUsers}   //  refresh after create
      />
    </div>
  )
}

export default UsersPage