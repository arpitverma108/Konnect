// RepositoriesPage.jsx
import React, { useState } from 'react'
import { Typography, Button, Input, Space } from 'antd'
import { Plus, Search } from 'lucide-react'
import RepoList from '../components/Repository/RepoList'
import CreateRepoModal from '../components/Repository/CreateRepoModal'

const { Title } = Typography

const RepositoriesPage = () => {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <div className="repos-container" style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Repositories</Title>
        <Button 
          type="primary" 
          icon={<Plus size={16} />} 
          onClick={() => setIsModalVisible(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          Create Repository
        </Button>
      </div>

      <div className="glass-panel" style={{ padding: '24px', minHeight: '60vh' }}>
        <div style={{ marginBottom: 24, maxWidth: 400 }}>
          <Input 
            size="large" 
            placeholder="Search repositories..." 
            prefix={<Search size={18} style={{ color: 'var(--text-muted)' }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
          />
        </div>

        <RepoList searchTerm={searchTerm} />
      </div>

      <CreateRepoModal 
        visible={isModalVisible} 
        onClose={() => setIsModalVisible(false)} 
      />
    </div>
  )
}

export default RepositoriesPage
