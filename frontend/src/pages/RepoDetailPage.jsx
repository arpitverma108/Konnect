// RepoDetailPage.jsx
import { useRepository } from '../api/repositories'
import { Spin, Alert } from 'antd'
import { Typography } from 'antd'
const { Title, Text } = Typography

const RepoDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: repo, isLoading, isError } = useRepository(id)

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  if (isError || !repo) {
    return <Alert type="error" message="Repository not found" showIcon style={{ margin: 24 }} />
  }

  return (
    <div className="repo-detail-container" style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 16 }}>
        <Button
          type="text"
          icon={<ArrowLeft size={20} color="var(--text-main)" />}
          onClick={() => navigate('/repositories')}
          style={{ padding: '4px 8px' }}
        />
        <div style={{
          background: 'rgba(24, 144, 255, 0.1)',
          padding: '10px',
          borderRadius: '8px',
          display: 'flex'
        }}>
          <FolderGit2 size={24} color="#1890ff" />
        </div>
        <div>
          <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            {repo.name}
            <Tag color={repo.is_active ? 'success' : 'error'} style={{ fontSize: '14px', padding: '2px 8px' }}>
              {repo.is_active ? 'Active' : 'Inactive'}
            </Tag>
          </Title>
        </div>
      </div>

      <RepoDetail repo={repo} />
    </div>
  )
}

export default RepoDetailPage
