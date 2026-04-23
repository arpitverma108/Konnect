import { Row, Col, Empty, Skeleton, Alert, Card } from 'antd'

const RepoList = ({ repos = [], loading = false, searchTerm = "" }) => {

  // LOADING STATE
  if (loading) {
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

  // EMPTY STATE (NO DATA)
  if (!loading && repos.length === 0) {
    return (
      <Empty
        description={
          <span style={{ color: 'var(--text-muted)' }}>
            No repositories yet. Create one!
          </span>
        }
        style={{ marginTop: 60 }}
      />
    )
  }

  //  FILTER
  const filteredRepos = repos.filter(repo =>
    repo.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // EMPTY SEARCH RESULT
  if (filteredRepos.length === 0) {
    return (
      <Empty
        description={
          <span style={{ color: 'var(--text-muted)' }}>
            No repositories matching "{searchTerm}"
          </span>
        }
        style={{ marginTop: 60 }}
      />
    )
  }

  return (
    <Row gutter={[24, 24]}>
      {filteredRepos.map(repo => (
        <Col xs={24} sm={12} lg={8} xl={6} key={repo.id}>
          
          <Card className="premium-card">
            <h3 style={{ color: 'var(--text-main)' }}>
              {repo.name}
            </h3>

            <p style={{ color: 'var(--text-muted)' }}>
              {repo.description || 'No description'}
            </p>
          </Card>

        </Col>
      ))}
    </Row>
  )
}

export default RepoList