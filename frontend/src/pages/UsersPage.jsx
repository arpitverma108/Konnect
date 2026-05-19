
import React,{useMemo,useState} from 'react'
import {Typography,Button,Input} from 'antd'
import {Download,UserPlus,Search} from 'lucide-react'

import UserList from '../components/Users/UserList'
import CreateUserModal from '../components/Users/CreateUserModal'

import {
  useUsers,
  useMe,
} from '../api/users'

import {
  normalizeList,
  normalizePaginated,
} from '../utils/normalize'

import useRole from '../hooks/useRole'
import BulkActionBar from '../components/common/BulkActionBar'
import useTableSelection from '../hooks/useTableSelection'
import {downloadCsv} from '../utils/exportCsv'
import useDebouncedValue from '../hooks/useDebouncedValue'

const {Title,Text}=Typography

const UsersPage=()=>{

  const [isModalVisible,setIsModalVisible]=
    useState(false)

  const [searchTerm,setSearchTerm]=
    useState('')

  const [page,setPage]=
    useState(1)

  const [limit]=
    useState(10)

  const debouncedSearch=
    useDebouncedValue(searchTerm,350)

  const {
    selectedRowKeys,
    selectedCount,
    rowSelection,
    clearSelection,
  }=useTableSelection()

  const {
    data:usersResponse,
    isLoading,
    isFetching,
  }=useUsers({
    page,
    limit,
    search:debouncedSearch.trim(),
  })

  const {
    list:users,
    total,
  }=normalizePaginated(usersResponse)

  const {data:me}=
    useMe()

  const {
    isAdmin:canManageUsers,
  }=useRole(me)

  const finalUsers=
    useMemo(()=>{
      return users.map((u)=>({
        ...u,
        groups:
          normalizeList(u.groups),
      }))

    },[users])

  const selectedUsers=
    useMemo(
      ()=>
        finalUsers.filter((user)=>
          selectedRowKeys.includes(user.id)
        ),
      [finalUsers,selectedRowKeys]
    )

  const exportUsers=(rows,filename)=>
    downloadCsv({
      filename,
      rows,
      columns:[
        {header:'Username',value:'username'},
        {header:'Full Name',value:'full_name'},
        {header:'Email',value:'email'},
        {header:'Role',value:'role'},
        {
          header:'Status',
          value:(user)=>
            user.is_active ? 'Active' : 'Disabled',
        },
        {
          header:'Groups',
          value:(user)=>
            (user.groups||[]).join('; '),
        },
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

        <div>
          <Title level={2}>
            Users Management
          </Title>

          <Text>
            Manage access
          </Text>
        </div>

        <Button
          type="primary"
          icon={<UserPlus size={16}/>}
          disabled={!canManageUsers}
          onClick={()=>
            setIsModalVisible(true)
          }
        >
          Add User
        </Button>

      </div>

      <Input
        placeholder="Search users..."
        prefix={<Search size={18}/>}
        value={searchTerm}
        onChange={(e)=>{
          setSearchTerm(e.target.value)
          setPage(1)
        }}
        style={{
          maxWidth:300,
          marginBottom:24,
        }}
      />

      <div style={{marginBottom:12}}>
        <Button
          icon={<Download size={16}/>}
          onClick={()=>
            exportUsers(
              finalUsers,
              'users.csv'
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
              exportUsers(
                selectedUsers,
                'users-selected.csv'
              )
            }
          >
            Export Selected
          </Button>
        }
      />

      <UserList
        users={finalUsers}
        currentUser={me}
        loading={isLoading||isFetching}
        searchTerm={searchTerm}
        page={page}
        pageSize={limit}
        total={total}
        onPageChange={setPage}
        rowSelection={rowSelection}
      />

      <CreateUserModal
        visible={isModalVisible}
        onClose={()=>
          setIsModalVisible(false)
        }
      />

    </div>
  )
}

export default UsersPage
