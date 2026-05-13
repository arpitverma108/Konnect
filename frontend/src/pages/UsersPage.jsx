
import React,{useMemo,useState} from 'react'
import {Typography,Button,Input} from 'antd'
import {UserPlus,Search} from 'lucide-react'

import UserList from '../components/Users/UserList'
import CreateUserModal from '../components/Users/CreateUserModal'

import {
  useUsers,
  useMe,
} from '../api/users'

import {useGroups} from '../api/groups'

import {
  normalizeList,
} from '../utils/normalize'

import useRole from '../hooks/useRole'

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

  const {
    data:usersResponse,
    isLoading,
  }=useUsers()

  const {
    data:groupsResponse,
  }=useGroups()

  const users=
    normalizeList(usersResponse)

  const groups=
    normalizeList(groupsResponse)

  const {data:me}=
    useMe()

  const {
    isAdmin:canManageUsers,
  }=useRole(me)

  const filteredUsers=useMemo(()=>{

    const query=
      searchTerm
        .trim()
        .toLowerCase()

    if(!query){
      return users
    }

    return users.filter((user)=>{

      return(

        user.username
          ?.toLowerCase()
          .includes(query)

        ||

        user.email
          ?.toLowerCase()
          .includes(query)

        ||

        user.full_name
          ?.toLowerCase()
          .includes(query)
      )

    })

  },[users,searchTerm])

  const finalUsers=
    useMemo(()=>{

      const map={}

      groups.forEach((group)=>{

        ;(group.members||[])
          .forEach((member)=>{

            if(!map[member.id]){
              map[member.id]=[]
            }

            map[member.id]
              .push(group.name)
          })
      })

      return filteredUsers.map((u)=>({
        ...u,
        groups:map[u.id]||[],
      }))

    },[filteredUsers,groups])

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

      <UserList
        users={finalUsers}
        loading={isLoading}
        searchTerm={searchTerm}
        page={page}
        pageSize={limit}
        total={finalUsers.length}
        onPageChange={setPage}
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