import React, { useEffect, useState } from 'react'
import { Typography, Button, Input, message } from 'antd'
import { Plus, Search } from 'lucide-react'
import RepoList from '../components/Repository/RepoList'
import CreateRepoModal from '../components/Repository/CreateRepoModal'

// 🔥 API (you will create this similar to users)
import { getRepositories } from '../api/repositories'

const { Title } = Typography

const RepositoriesPage = () => {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)

  //  FETCH REPOS
  const fetchRepos = async () => {
    try {
      setLoading(true)

      const res = await getRepositories()
      setRepos(res.data || res)

    } catch (err) {
      console.error(err)
      message.error('Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRepos()
  }, [])

  return (
    <div className="repos-container" style={{ paddingBottom: 24 }}>
      
      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <Title level={2} style={{ margin: 0 }}>
          Repositories
        </Title>

        <Button 
          type="primary" 
          icon={<Plus size={16} />} 
          onClick={() => setIsModalVisible(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          Create Repository
        </Button>
      </div>

      {/* MAIN PANEL */}
      <div className="glass-panel" style={{ padding: '24px', minHeight: '60vh' }}>
        
        {/* SEARCH */}
        <div style={{ marginBottom: 24, maxWidth: 400 }}>
          <Input 
            size="large" 
            placeholder="Search repositories..." 
            prefix={<Search size={18} style={{ color: 'var(--text-muted)' }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-color)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-main)'
            }}
          />
        </div>

        {/*  PASS DATA */}
        <RepoList 
          repos={repos}
          loading={loading}
          searchTerm={searchTerm}
        />

      </div>

      {/* MODAL */}
      <CreateRepoModal 
        visible={isModalVisible} 
        onClose={() => setIsModalVisible(false)} 
        onSuccess={fetchRepos}   // 🔥 refresh after create
      />
    </div>
  )
}

export default RepositoriesPage