
// export default PermissionMatrix
import React,{useState} from 'react'
import {
  Table,Radio,Tag,Input,Typography,
  Button,Spin,Alert,message,Modal,
} from 'antd'

import {
  Users,User,Search,Save,
} from 'lucide-react'

import {
  usePermissions,
  useSavePermission,
  useDeletePermission,
} from '../../api/permissions'

const {Text}=Typography

const PermissionMatrix=({repoId,path})=>{

  const [searchTerm,setSearchTerm]=useState('')
  const [localChanges,setLocalChanges]=useState({})

  const {
    data,
    isLoading,
    isError,
    refetch,
  }=usePermissions(repoId)

  const saveMutation=useSavePermission(repoId)
  const deleteMutation=useDeletePermission(repoId)

  const permissions=data||[]

  if(!Array.isArray(permissions)){
    return (
      <Alert
        type="error"
        message="Invalid permissions data format"
        showIcon
      />
    )
  }

  const filteredPerms=permissions.filter((p)=>
    (p?.subject_name||'')
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  )

  const getSubjectKey=(record)=>
    `${record.subject_type}_${record.subject_id}`

  const handlePermissionChange=(record,value)=>{
    const key=getSubjectKey(record)

    setLocalChanges((prev)=>({
      ...prev,
      [key]:value,
    }))
  }

  const handleSave=()=>{

    const entries=Object.entries(localChanges)

    if(!entries.length)return

    const promises=permissions
      .filter(
        (p)=>
          localChanges[getSubjectKey(p)]!==undefined
      )
      .map((p)=>
        saveMutation.mutateAsync({
          path,
          subjectType:p.subject_type,
          subjectId:p.subject_id,
          permission:
            localChanges[getSubjectKey(p)],
        })
      )

    Promise.allSettled(promises)
      .then((results)=>{

        const successCount=results.filter(
          (r)=>r.status==='fulfilled'
        ).length

        const failedCount=results.filter(
          (r)=>r.status==='rejected'
        ).length

        if(successCount){
          message.success(
            `Saved ${successCount} permission change${successCount>1?'s':''}`
          )
        }

        if(failedCount){
          message.warning(
            `${failedCount} permission update${failedCount>1?'s':''} failed`
          )
        }

        setLocalChanges({})
        refetch()
      })
  }

  const handleDelete=(record)=>{
    Modal.confirm({
      title:'Delete permission?',
      content:
        `Remove access for ${record.subject_name}?`,
      okText:'Delete',
      okType:'danger',

      onOk:()=>
        new Promise((resolve,reject)=>{
          deleteMutation.mutate(
            record.id,
            {
              onSuccess:()=>{
                message.success(
                  'Permission deleted'
                )
                resolve()
              },

              onError:()=>{
                message.error(
                  'Failed to delete permission'
                )
                reject()
              },
            }
          )
        }),
    })
  }

  if(isLoading){
    return (
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
    return (
      <Alert
        type="error"
        message="Failed to load permissions"
        showIcon
      />
    )
  }

  const hasChanges=
    Object.keys(localChanges).length>0

  const columns=[

    {
      title:'Subject',
      key:'name',

      render:(_,record)=>{

        const name=record.subject_name
        const type=record.subject_type

        return (
          <span
            style={{
              display:'flex',
              alignItems:'center',
              gap:'8px',
            }}
          >

            {type==='group'?(
              <Tag
                color="cyan"
                icon={<Users size={12}/>}
              >
                @{name}
              </Tag>
            ):(
              <Tag
                color="default"
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
      title:'Type',
      key:'type',
      width:100,

      render:(_,record)=>(
        <Text
          type="secondary"
          style={{
            textTransform:'capitalize',
          }}
        >
          {record.subject_type}
        </Text>
      ),
    },

    {
      title:'Access Level',
      key:'permission',
      width:310,

      render:(_,record)=>{

        const key=getSubjectKey(record)

        const currentValue=
          localChanges[key]!==undefined
            ?localChanges[key]
            :(record.permission||'')

        return (
          <Radio.Group
            value={currentValue}

            onChange={(e)=>
              handlePermissionChange(
                record,
                e.target.value
              )
            }

            optionType="button"
            buttonStyle="solid"
            size="small"
          >

            <Radio.Button value="">
              None
            </Radio.Button>

            <Radio.Button value="r">
              Read
            </Radio.Button>

            <Radio.Button value="rw">
              Read / Write
            </Radio.Button>

          </Radio.Group>
        )
      },
    },

    {
      title:'Actions',
      key:'actions',
      width:120,

      render:(_,record)=>(
        <Button
          danger
          size="small"
          loading={deleteMutation.isPending}
          onClick={()=>
            handleDelete(record)
          }
        >
          Delete
        </Button>
      ),
    },
  ]

  return (
    <div>

      <div
        style={{
          display:'flex',
          justifyContent:'space-between',
          marginBottom:16,
        }}
      >

        <Input
          placeholder="Filter users or groups..."
          prefix={<Search size={16}/>}
          value={searchTerm}

          onChange={(e)=>
            setSearchTerm(e.target.value)
          }

          style={{
            maxWidth:300,
          }}
        />

        {hasChanges&&(
          <Button
            type="primary"
            icon={<Save size={16}/>}
            onClick={handleSave}
            loading={saveMutation.isPending}
          >
            Save Changes (
            {Object.keys(localChanges).length}
            )
          </Button>
        )}

      </div>

      <Table
        columns={columns}
        dataSource={filteredPerms}
        rowKey={(r)=>
          getSubjectKey(r)
        }

        pagination={false}

        locale={{
          emptyText:
            'No permissions found',
        }}
      />

    </div>
  )
}

export default PermissionMatrix