
import React,{useState} from 'react'

import {
  Modal,Input,Button,List,Avatar,
  Tag,Typography,Spin,Divider,
  message,Popconfirm,
} from 'antd'

import {
  UserPlus,UserMinus,
  Users,Search,
} from 'lucide-react'

import {
  useGroupMembers,
  useAddGroupMember,
  useRemoveGroupMember,
} from '../../api/groups'

import {useUsers} from '../../api/users'
import {normalizeList} from '../../utils/normalize'

const {Text,Title}=Typography

const ManageMembersModal=({
  group,
  onClose,
})=>{

  const [searchTerm,setSearchTerm]=useState('')
  const [addingUserId,setAddingUserId]=useState(null)
  const [removingUserId,setRemovingUserId]=useState(null)

  const {
    data:membersResponse,
    isLoading:membersLoading,
  }=useGroupMembers(group?.id)

  const {
    data:usersResponse,
  }=useUsers()

  const members=
    normalizeList(membersResponse)

  const allUsers=
    normalizeList(usersResponse)

  const addMutation=
    useAddGroupMember()

  const removeMutation=
    useRemoveGroupMember()

  if(!group){
    return null
  }

  const memberIds=
    new Set(
      members.map((m)=>m.id)
    )

  const nonMembers=
    allUsers.filter((u)=>
      !memberIds.has(u.id)
      &&
      u.username
        ?.toLowerCase()
        .includes(
          searchTerm.toLowerCase()
        )
    )

  const handleAdd=(user)=>{

    setAddingUserId(user.id)

    addMutation.mutate(
      {
        groupId:group.id,
        userId:user.id,
      },
      {
        onSuccess:()=>{
          message.success(
            `Added @${user.username} to @${group.name}`
          )

          setAddingUserId(null)
        },

        onError:()=>{
          message.error(
            'Failed to add member'
          )

          setAddingUserId(null)
        },
      }
    )
  }

  const handleRemove=(member)=>{

    setRemovingUserId(member.id)

    removeMutation.mutate(
      {
        groupId:group.id,
        userId:member.id,
      },
      {
        onSuccess:()=>{
          message.success(
            `Removed @${member.username} from @${group.name}`
          )

          setRemovingUserId(null)
        },

        onError:()=>{
          message.error(
            'Failed to remove member'
          )

          setRemovingUserId(null)
        },
      }
    )
  }

  return (
    <Modal
      title={
        <div
          style={{
            display:'flex',
            alignItems:'center',
            gap:10,
          }}
        >

          <Users
            size={20}
            color="var(--primary-color)"
          />

          <span
            style={{
              color:'var(--text-main)',
              fontSize:'18px',
            }}
          >
            Manage Members —

            <Tag color="cyan">
              @{group.name}
            </Tag>

          </span>

        </div>
      }

      open={!!group}
      onCancel={onClose}

      footer={
        <Button onClick={onClose}>
          Close
        </Button>
      }

      width={560}

      styles={{
        content:{
          backgroundColor:
            'var(--bg-surface)',

          border:
            '1px solid var(--border-color)',
        },

        header:{
          backgroundColor:
            'var(--bg-surface)',

          borderBottom:
            '1px solid var(--border-color)',
        },

        footer:{
          borderTop:
            '1px solid var(--border-color)',
        },
      }}
    >

      <Title
        level={5}
        style={{
          marginTop:8,
          marginBottom:12,
        }}
      >
        Current Members ({members.length})
      </Title>

      {membersLoading?(
        <div
          style={{
            display:'flex',
            justifyContent:'center',
            padding:20,
          }}
        >
          <Spin/>
        </div>

      ):members.length===0?(
        <Text type="secondary">
          No members yet.
        </Text>

      ):(
        <List
          size="small"
          dataSource={members}

          renderItem={(member)=>(
            <List.Item
              style={{
                padding:'8px 0',
                borderBottom:
                  '1px solid var(--border-color)',
              }}

              actions={[
                <Popconfirm
                  key="remove-confirm"

                  title="Remove member"

                  description={
                    `Remove @${member.username} from @${group.name}?`
                  }

                  onConfirm={()=>
                    handleRemove(member)
                  }

                  okText="Remove"
                  cancelText="Cancel"

                  okButtonProps={{
                    danger:true,
                    loading:
                      removingUserId===member.id,
                  }}
                >

                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={
                      <UserMinus size={14}/>
                    }
                  />

                </Popconfirm>
              ]}
            >

              <List.Item.Meta
                avatar={
                  <Avatar
                    size="small"
                    style={{
                      backgroundColor:'#1890ff',
                    }}
                  >
                    {member.username?.[0]?.toUpperCase()}
                  </Avatar>
                }

                title={
                  <Text
                    style={{
                      color:'var(--text-main)',
                    }}
                  >
                    {member.username}
                  </Text>
                }

                description={
                  <Text
                    type="secondary"
                    style={{
                      fontSize:12,
                    }}
                  >
                    {
                      member.full_name
                      ||
                      member.email
                      ||
                      ''
                    }
                  </Text>
                }
              />

            </List.Item>
          )}
        />
      )}

      <Divider
        style={{
          margin:'20px 0 16px',
        }}
      />

      <Title
        level={5}
        style={{
          marginBottom:12,
        }}
      >
        Add Members
      </Title>

      <Input
        placeholder="Search users to add..."

        prefix={
          <Search
            size={16}
            color="var(--text-muted)"
          />
        }

        value={searchTerm}

        onChange={(e)=>
          setSearchTerm(e.target.value)
        }

        style={{
          marginBottom:12,
          backgroundColor:
            'var(--bg-color)',

          borderColor:
            'var(--border-color)',

          color:
            'var(--text-main)',
        }}
      />

      {nonMembers.length===0?(
        <Text type="secondary">

          {searchTerm
            ?`No users matching "${searchTerm}"`
            :'All users are already members.'}

        </Text>

      ):(
        <List
          size="small"

          dataSource={
            nonMembers.slice(0,8)
          }

          renderItem={(user)=>(
            <List.Item
              style={{
                padding:'8px 0',
                borderBottom:
                  '1px solid var(--border-color)',
              }}

              actions={[
                <Button
                  key="add"
                  type="primary"
                  ghost
                  size="small"

                  icon={
                    <UserPlus size={14}/>
                  }

                  loading={
                    addingUserId===user.id
                  }

                  onClick={()=>
                    handleAdd(user)
                  }
                >
                  Add
                </Button>
              ]}
            >

              <List.Item.Meta
                avatar={
                  <Avatar
                    size="small"
                    style={{
                      backgroundColor:'#30363d',
                    }}
                  >
                    {user.username?.[0]?.toUpperCase()}
                  </Avatar>
                }

                title={
                  <Text
                    style={{
                      color:'var(--text-main)',
                    }}
                  >
                    {user.username}
                  </Text>
                }

                description={
                  <Text
                    type="secondary"
                    style={{
                      fontSize:12,
                    }}
                  >
                    {
                      user.full_name
                      ||
                      user.email
                      ||
                      ''
                    }
                  </Text>
                }
              />

            </List.Item>
          )}
        />
      )}

    </Modal>
  )
}

export default ManageMembersModal