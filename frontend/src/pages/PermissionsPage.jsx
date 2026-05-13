import React,{useEffect,useState} from 'react'
import {Typography,Row,Col,Select} from 'antd'
import {ShieldCheck} from 'lucide-react'

import PathPermissions from '../components/Permissions/PathPermissions'
import PermissionMatrix from '../components/Permissions/PermissionMatrix'

import {useRepositories} from '../api/repositories'

import {normalizePaginated} from '../utils/normalize'

const {Title,Text}=Typography
const {Option}=Select

const PermissionsPage=()=>{

  const {
    data:repoData,
    isLoading:reposLoading,
  }=useRepositories()

  const {
    list:repos,
  }=normalizePaginated(repoData)

  const [
    selectedRepoId,
    setSelectedRepoId,
  ]=useState(null)

  const [
    selectedPath,
    setSelectedPath,
  ]=useState('/')

  useEffect(()=>{

    if(
      repos.length>0
      &&
      !selectedRepoId
    ){
      setSelectedRepoId(repos[0].id)
    }

  },[repos,selectedRepoId])

  const selectedRepo=
    repos.find(
      (r)=>r.id===selectedRepoId
    )

  return(
    <div
      className="permissions-container"
      style={{paddingBottom:24}}
    >

      <div
        style={{
          display:'flex',
          justifyContent:'space-between',
          alignItems:'flex-start',
          marginBottom:24,
        }}
      >

        <div>

          <Title
            level={2}
            style={{margin:0}}
          >
            Permissions & Authz Matrix
          </Title>

          <Text type="secondary">
            Manage access control mapped directly to Apache SVN authz file.
          </Text>

        </div>

      </div>

      <Row gutter={[24,24]}>

        <Col xs={24} lg={6}>

          <div
            className="glass-panel"
            style={{
              padding:'24px',
              minHeight:'60vh',
            }}
          >

            <Title
              level={5}
              style={{
                marginTop:0,
                marginBottom:16,
              }}
            >
              Repository
            </Title>

            <Select
              value={selectedRepoId}

              loading={reposLoading}

              style={{
                width:'100%',
                marginBottom:24,
              }}

              onChange={setSelectedRepoId}

              placeholder="Select repository..."
            >

              {repos.map((r)=>(
                <Option
                  key={r.id}
                  value={r.id}
                >
                  {r.name}
                </Option>
              ))}

            </Select>

            <Title
              level={5}
              style={{marginBottom:16}}
            >
              Path Selector
            </Title>

            <PathPermissions
              repoId={selectedRepoId}
              selectedPath={selectedPath}
              onSelectPath={setSelectedPath}
            />

          </div>

        </Col>

        <Col xs={24} lg={18}>

          <div
            className="glass-panel"
            style={{
              padding:'24px',
              minHeight:'60vh',
            }}
          >
            <div
              style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:24,
              }}
            >
              <ShieldCheck
                size={20}color="var(--primary-color)"
              />
              <Title
              level={4}style={{margin:0}}
              >Access Rules for [
                {selectedRepo?.name||'…'}
                :
                {selectedPath}
                ]
              </Title>
            </div>
            {selectedRepoId?(
              <PermissionMatrix
                repoId={selectedRepoId}
                path={selectedPath}
              />
            ):(
              <Text type="secondary">
                Select a repository to view permissions.
              </Text>
            )}
          </div>
        </Col>
      </Row>
    </div>
  )
}

export default PermissionsPage