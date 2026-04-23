// RepoList.jsx
import { Row, Col, Empty, Skeleton, Alert, Card } from 'antd'
// import { useRepositories } from '../../api/repositories'  // ❌ Disabled API (no backend)
// import RepoCard from './RepoCard'  // ❌ Disabled (causing crash if not present)

const RepoList = ({ searchTerm = "" }) => {

  // const { data: repos = [], isLoading, isError } = useRepositories() // ❌ API disabled

  // ✅ Mock data (frontend-only)
  const repos = [
    { id: 1, name: "Project Alpha", description: "Main project repo" },
    { id: 2, name: "Frontend UI", description: "React frontend" },
    { id: 3, name: "Backend API", description: "Spring Boot backend" },
    { id: 4, name: "Testing Repo", description: "Testing features" }
  ]

  const isLoading = false
  const isError = false

  if (isLoading) {
    return (
      <Row gutter={[24, 24]}>
        {[1, 2, 3, 4].map(i => (
          <Col xs={24} sm={12} lg={8} xl={6} key={i}>
            <Card className="premium-card" style={{ height: 200, background: 'var(--bg-surface)' }}>
              <Skeleton active avatar paragraph={{ rows: 2 }} />
            </Card>
          </Col>
        ))}
      </Row>
    )
  }

  const filteredRepos = repos.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (filteredRepos.length === 0) {
    return (
      <Empty
        description={<span style={{ color: 'var(--text-muted)' }}>
          {searchTerm ? `No repositories matching "${searchTerm}"` : 'No repositories yet. Create one!'}
        </span>}
        style={{ marginTop: 60 }}
      />
    )
  }

  return (
    <Row gutter={[24, 24]}>
      {filteredRepos.map(repo => (
        <Col xs={24} sm={12} lg={8} xl={6} key={repo.id}>

          {/* ❌ Old (causing crash if RepoCard missing) */}
          {/* <RepoCard repo={repo} /> */}

          {/* ✅ Simple card UI replacement */}
          <Card className="premium-card">
            <h3>{repo.name}</h3>
            <p style={{ color: '#888' }}>{repo.description}</p>
          </Card>

        </Col>
      ))}
    </Row>
  )
}

export default RepoList