import React,{
  useMemo,
  useState,
} from 'react'

import {
  Table,
  Radio,
  Tag,
  Input,
  Button,
  Spin,
  Alert,
  message,
  Modal,
  Select,
} from 'antd'

import {
  Users,
  User,
  Search,
  Save,
  Plus,
} from 'lucide-react'

import {
  usePermissions,
  useSavePermission,
  useDeletePermission,
} from '../../api/permissions'

import {useUsers} from '../../api/users'
import {useGroups} from '../../api/groups'

import useDebouncedValue from '../../hooks/useDebouncedValue'

import {normalizeList} from '../../utils/normalize'

const {Option}=Select

const PermissionMatrix=({
  repoId,
  path,
})=>{

  const [searchTerm,setSearchTerm]=
    useState('')

  const [localChanges,setLocalChanges]=
    useState({})

  const [showUserModal,setShowUserModal]=
    useState(false)

  const [showGroupModal,setShowGroupModal]=
    useState(false)

  const [selectedUser,setSelectedUser]=
    useState(null)

  const [selectedGroup,setSelectedGroup]=
    useState(null)

  const [permission,setPermission]=
    useState('r')

  const [userSearch,setUserSearch]=
    useState('')

  const [groupSearch,setGroupSearch]=
    useState('')

  const debouncedUserSearch=
    useDebouncedValue(userSearch,350)

  const debouncedGroupSearch=
    useDebouncedValue(groupSearch,350)

  const {
    data,
    isLoading,
    isError,
  }=usePermissions(repoId)

  const {
    data:userData,
    isFetching:usersLoading,
  }=useUsers(
    {
      search:debouncedUserSearch.trim(),
      limit:20,
    },
    {
      enabled:
        showUserModal
        &&
        debouncedUserSearch.trim().length>0,
    }
  )

  const {
    data:groupData,
    isFetching:groupsLoading,
  }=useGroups(
    {
      search:debouncedGroupSearch.trim(),
      limit:20,
    },
    {
      enabled:
        showGroupModal
        &&
        debouncedGroupSearch.trim().length>0,
    }
  )

  const users=
    normalizeList(userData)

  const groups=
    normalizeList(groupData)

  const permissions=
    Array.isArray(data)
      ? data
      : []

  const saveMutation=
    useSavePermission(repoId)

  const deleteMutation=
    useDeletePermission(repoId)

  const filteredPerms=
    permissions.filter((p)=>
      (
        p?.subject_name
        || ''
      )
        .toLowerCase()
        .includes(
          (
            searchTerm
            || ''
          ).toLowerCase()
        )
    )

  const getSubjectKey=(record)=>
    `${record.subject_type}_${record.subject_id}`

  const handlePermissionChange=(
    record,
    value
  )=>{

    const key=
      getSubjectKey(record)

    setLocalChanges((prev)=>({
      ...prev,
      [key]:value,
    }))
  }

  const handleSave=()=>{

    const entries=
      Object.entries(localChanges)

    if(!entries.length){
      return
    }

    const promises=
      permissions
        .filter(
          (p)=>
            localChanges[
              getSubjectKey(p)
            ]!==undefined
        )
        .map((p)=>
          saveMutation.mutateAsync({

            path,

            subjectType:
              p.subject_type,

            subjectId:
              p.subject_id,

            permission:
              localChanges[
                getSubjectKey(p)
              ],
          })
        )

    Promise.allSettled(promises)
      .then(()=>{

        message.success(
          'Permissions updated'
        )

        setLocalChanges({})
      })
  }

  const handleDelete=(record)=>{

    Modal.confirm({

      title:'Delete permission?',

      content:
        `Remove access for ${record.subject_name}?`,

      okText:'Delete',

      okType:'danger',

      onOk:async()=>{

        await deleteMutation.mutateAsync(
          record.id
        )

        message.success(
          'Permission deleted'
        )
      },
    })
  }

  const handleAddPermission=async(
    subjectType
  )=>{

    const subjectId=
      subjectType==='user'
        ? selectedUser
        : selectedGroup

    if(!subjectId){

      return message.warning(
        `Select a ${subjectType}`
      )
    }

    try{

      await saveMutation.mutateAsync({

        path,

        subjectType,

        subjectId,

        permission,
      })

      message.success(
        'Permission added'
      )

      setShowUserModal(false)
      setShowGroupModal(false)

      setSelectedUser(null)
      setSelectedGroup(null)

      setUserSearch('')
      setGroupSearch('')

      setPermission('r')

    }catch{

      message.error(
        'Failed to add permission'
      )
    }
  }

  // ✅ FIXED: useMemo MUST be before conditional returns
  const columns=useMemo(()=>[

    {
      title:'Subject',

      key:'name',

      render:(_,record)=>{

        const name=
          record.subject_name
          || 'Unknown'

        return(

          <span
            style={{
              display:'flex',
              alignItems:'center',
              gap:8,
            }}
          >

            {record.subject_type==='group'?(
              <Tag
                color="cyan"
                icon={<Users size={12}/>}
              >
                @{name}
              </Tag>
            ):(
              <Tag
                icon={<User size={12}/>}
              >
                {name}
              </Tag>
            )}

          </span>
        )
      },
    },

    {
      title:'Access',

      key:'permission',

      render:(_,record)=>{

        const key=
          getSubjectKey(record)

        const currentValue=
          localChanges[key]!==undefined
            ? localChanges[key]
            : (record.permission || '')

        return(

          <Radio.Group
            value={currentValue}

            onChange={(e)=>
              handlePermissionChange(
                record,
                e.target.value
              )
            }
          >

            <Radio.Button value="">
              None
            </Radio.Button>

            <Radio.Button value="r">
              Read
            </Radio.Button>

            <Radio.Button value="rw">
              Read/Write
            </Radio.Button>

          </Radio.Group>
        )
      },
    },

    {
      title:'Actions',

      render:(_,record)=>(

        <Button
          danger
          size="small"

          onClick={()=>
            handleDelete(record)
          }
        >
          Delete
        </Button>
      ),
    },
  ],[
    localChanges,
  ])

  // ✅ SAFE AFTER ALL HOOKS
  if(isLoading){

    return(
      <div
        style={{
          display:'flex',
          justifyContent:'center',
          padding:40,
        }}
      >
        <Spin/>
      </div>
    )
  }

  if(isError){

    return(
      <Alert
        type="error"
        message="Failed to load permissions"
        showIcon
      />
    )
  }

  return(

    <div>

      <div
        style={{
          display:'flex',
          justifyContent:'space-between',
          marginBottom:16,
          gap:12,
          flexWrap:'wrap',
        }}
      >

        <Input
          placeholder="Filter users/groups..."
          prefix={<Search size={16}/>}

          value={searchTerm}

          onChange={(e)=>
            setSearchTerm(e.target.value)
          }

          style={{
            maxWidth:300,
          }}
        />

        <div
          style={{
            display:'flex',
            gap:8,
          }}
        >

          <Button
            icon={<Plus size={16}/>}

            onClick={()=>
              setShowUserModal(true)
            }
          >
            Add User
          </Button>

          <Button
            icon={<Plus size={16}/>}

            onClick={()=>
              setShowGroupModal(true)
            }
          >
            Add Group
          </Button>

          {Object.keys(localChanges).length>0&&(

            <Button
              type="primary"
              icon={<Save size={16}/>}

              onClick={handleSave}
            >
              Save Changes
            </Button>
          )}

        </div>

      </div>

      <Table
        columns={columns}
        dataSource={filteredPerms}

        rowKey={(r)=>
          `${r.subject_type}_${r.subject_id}`
        }

        pagination={false}
      />

      <Modal
        open={showUserModal}

        title="Add User Permission"

        onCancel={()=>{
          setUserSearch('')
          setShowUserModal(false)
        }}

        onOk={()=>
          handleAddPermission('user')
        }
      >

        <Select
          style={{
            width:'100%',
            marginBottom:16,
          }}

          placeholder="Select user"

          value={selectedUser}

          onChange={setSelectedUser}

          showSearch

          filterOption={false}

          onSearch={setUserSearch}

          loading={usersLoading}

          notFoundContent={
            usersLoading
              ? <Spin size="small"/>
              : null
          }

          options={
            users
              .filter((u)=>u.id)
              .map((u)=>({
                value:u.id,
                label:u.username,
              }))
          }
        />

        <Select
          style={{
            width:'100%',
          }}

          value={permission}

          onChange={setPermission}
        >

          <Option value="r">
            Read
          </Option>

          <Option value="rw">
            Read / Write
          </Option>

        </Select>

      </Modal>

      <Modal
        open={showGroupModal}

        title="Add Group Permission"

        onCancel={()=>{
          setGroupSearch('')
          setShowGroupModal(false)
        }}

        onOk={()=>
          handleAddPermission('group')
        }
      >

        <Select
          style={{
            width:'100%',
            marginBottom:16,
          }}

          placeholder="Select group"

          value={selectedGroup}

          onChange={setSelectedGroup}

          showSearch

          filterOption={false}

          onSearch={setGroupSearch}

          loading={groupsLoading}

          notFoundContent={
            groupsLoading
              ? <Spin size="small"/>
              : null
          }

          options={
            groups
              .filter((g)=>g.id)
              .map((g)=>({
                value:g.id,
                label:g.name,
              }))
          }
        />

        <Select
          style={{
            width:'100%',
          }}

          value={permission}

          onChange={setPermission}
        >

          <Option value="r">
            Read
          </Option>

          <Option value="rw">
            Read / Write
          </Option>

        </Select>

      </Modal>

    </div>
  )
}

export default PermissionMatrix