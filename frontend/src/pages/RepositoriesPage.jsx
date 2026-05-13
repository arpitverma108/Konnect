
import React,{useState} from 'react'
import {Typography,Button,Input} from 'antd'
import {Plus,Search} from 'lucide-react'

import RepoList from '../components/Repository/RepoList'
import CreateRepoModal from '../components/Repository/CreateRepoModal'

import {useRepositories} from '../api/repositories'
import {useMe} from '../api/users'

import {normalizePaginated} from '../utils/normalize'

import useRole from '../hooks/useRole'

const {Title}=Typography

const RepositoriesPage=()=>{

  const [isModalVisible,setIsModalVisible]=useState(false)
  const [searchTerm,setSearchTerm]=useState('')
  const [page,setPage]=useState(1)

  const limit=12

  const {
    data:response,
    isLoading,
  }=useRepositories({
    page,
    limit,
    search:searchTerm.trim(),
  })

  const {
    list:repos,
    total,
  }=normalizePaginated(response)

  const {data:me}=useMe()

  const {
    isAdmin:canManage,
  }=useRole(me)

  return(
    <div style={{paddingBottom:24}}>

      <div
        style={{
          display:'flex',
          justifyContent:'space-between',
          marginBottom:24,
        }}
      >

        <Title level={2}>
          Repositories
        </Title>

        <Button
          type="primary"
          icon={<Plus size={16}/>}

          disabled={!canManage}

          onClick={()=>
            setIsModalVisible(true)
          }
        >
          Create Repository
        </Button>

      </div>

      <div style={{padding:24}}>

        <Input
          size="large"

          placeholder="Search repositories..."

          prefix={<Search size={18}/>}

          value={searchTerm}

          onChange={(e)=>{
            setSearchTerm(e.target.value)
            setPage(1)
          }}

          style={{
            maxWidth:400,
            marginBottom:24,
          }}
        />

        <RepoList
          repos={repos}

          loading={isLoading}

          page={page}

          pageSize={limit}

          total={total}

          onPageChange={setPage}
        />

      </div>

      <CreateRepoModal
        visible={isModalVisible}

        onClose={()=>
          setIsModalVisible(false)
        }
      />

    </div>
  )
}

export default RepositoriesPage