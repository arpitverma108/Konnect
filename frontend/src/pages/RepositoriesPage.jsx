
import React,{useMemo,useState} from 'react'
import {Typography,Button,Input} from 'antd'
import {Download,Plus,Search} from 'lucide-react'

import RepoList from '../components/Repository/RepoList'
import CreateRepoModal from '../components/Repository/CreateRepoModal'

import {useRepositories} from '../api/repositories'
import {useMe} from '../api/users'

import {normalizePaginated} from '../utils/normalize'

import useRole from '../hooks/useRole'
import BulkActionBar from '../components/common/BulkActionBar'
import useTableSelection from '../hooks/useTableSelection'
import {downloadCsv} from '../utils/exportCsv'

const {Title}=Typography

const RepositoriesPage=()=>{

  const [isModalVisible,setIsModalVisible]=useState(false)
  const [searchTerm,setSearchTerm]=useState('')
  const [page,setPage]=useState(1)

  const {
    selectedRowKeys,
    selectedCount,
    rowSelection,
    clearSelection,
  }=useTableSelection()

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

  const selectedRepos=
    useMemo(
      ()=>
        repos.filter((repo)=>
          selectedRowKeys.includes(repo.id)
        ),
      [repos,selectedRowKeys]
    )

  const exportRepos=(rows,filename)=>
    downloadCsv({
      filename,
      rows,
      columns:[
        {header:'Name',value:'name'},
        {header:'Description',value:'description'},
        {header:'Created',value:'created_at'},
      ],
    })

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

        <div style={{marginBottom:12}}>
          <Button
            icon={<Download size={16}/>}
            onClick={()=>
              exportRepos(
                repos,
                'repositories.csv'
              )
            }
          >
            Export
          </Button>
        </div>

        <BulkActionBar
          selectedCount={selectedCount}
          onClear={clearSelection}
          actions={
            <Button
              icon={<Download size={16}/>}
              onClick={()=>
                exportRepos(
                  selectedRepos,
                  'repositories-selected.csv'
                )
              }
            >
              Export Selected
            </Button>
          }
        />

        <RepoList
          repos={repos}

          loading={isLoading}

          page={page}

          pageSize={limit}

          total={total}

          onPageChange={setPage}

          selectedRowKeys={selectedRowKeys}

          onSelectionChange={
            rowSelection.onChange
          }
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
