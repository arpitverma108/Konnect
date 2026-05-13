import React,{useState,useMemo} from 'react'
import {
  Row,
  Col,
  Empty,
  Skeleton,
  Card,
  Pagination,
  Popconfirm,
  Button,
  message,
  Tooltip,
} from 'antd'

import {useNavigate} from 'react-router-dom'

import {Trash2} from 'lucide-react'

import {useDeleteRepository} from '../../api/repositories'

import {useMe} from '../../api/users'

const RepoList=({
  repos=[],
  loading=false,
  page=1,
  pageSize=12,
  total=0,
  onPageChange,
})=>{

  const navigate=useNavigate()

  const deleteMutation=
    useDeleteRepository()

  const {data:me}=
    useMe()

  const role=
    me?.role || 'viewer'

  const canManage=
    role === 'admin'
    ||
    role === 'super_admin'

  const [deletingId,setDeletingId]=
    useState(null)

  const repoList=
    useMemo(()=>{

      if(!repos){
        return []
      }

      if(Array.isArray(repos)){
        return repos
      }

      if(Array.isArray(repos.data)){
        return repos.data
      }

      return []

    },[repos])

  const finalTotal=
    total
    ||
    repos?.total
    ||
    repoList.length

  const handleDelete=(repo)=>{

    setDeletingId(repo.id)

    deleteMutation.mutate(
      repo.id,
      {
        onSuccess:()=>{

          message.success(
            `Repository "${repo.name}" deleted`
          )

          setDeletingId(null)
        },

        onError:()=>{

          message.error(
            'Failed to delete repository'
          )

          setDeletingId(null)
        },
      }
    )
  }

  if(loading){

    return(
      <div style={{padding:24}}>
        <Skeleton
          active
          paragraph={{rows:6}}
        />
      </div>
    )
  }

  if(!repoList.length){

    return(
      <Empty description="No repositories"/>
    )
  }

  return(
    <>
      <Row gutter={[24,24]}>

        {repoList.map((repo)=>(

          <Col key={repo.id}>

            <Card
              hoverable

              onClick={()=>
                navigate(
                  `/repositories/${repo.id}`
                )
              }
            >

              <div
                style={{
                  display:'flex',
                  gap:8,
                }}

                onClick={(e)=>
                  e.stopPropagation()
                }
              >

                <Popconfirm
                  title="Delete repository?"

                  description="This action cannot be undone"

                  onConfirm={()=>
                    handleDelete(repo)
                  }

                  disabled={!canManage}

                  okButtonProps={{
                    loading:
                      deletingId === repo.id,

                    danger:true,
                  }}
                >

                  <Tooltip
                    title={
                      !canManage
                        ? 'No permission'
                        : 'Delete'
                    }
                  >

                    <Button
                      type="text"

                      danger

                      disabled={
                        !canManage
                        ||
                        deletingId === repo.id
                      }

                      loading={
                        deletingId === repo.id
                      }

                      icon={
                        <Trash2 size={14}/>
                      }
                    />

                  </Tooltip>

                </Popconfirm>

              </div>

              <h3>
                {repo.name || 'Unnamed Repo'}
              </h3>

              <p>
                {repo.description || 'No description'}
              </p>

            </Card>

          </Col>
        ))}

      </Row>

      <Pagination
        style={{
          marginTop:24,
          textAlign:'center',
        }}

        current={page}

        pageSize={pageSize}

        total={finalTotal}

        onChange={onPageChange}
      />
    </>
  )
}

export default RepoList