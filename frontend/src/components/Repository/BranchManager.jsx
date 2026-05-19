import React from 'react'
import {Button,Input,Spin,Table} from 'antd'

const BranchManager=({
  branchName,
  branches=[],
  branchLoading=false,
  createBranchMutation,
  deleteBranchMutation,
  onBranchNameChange,
})=>(
  <>
    <div
      style={{
        display:'flex',
        gap:10,
        marginBottom:16,
      }}
    >
      <Input
        value={branchName}
        onChange={(e)=>
          onBranchNameChange(e.target.value)
        }
      />

      <Button
        type="primary"
        onClick={()=>
          createBranchMutation.mutate({
            branchName,
          })
        }
      >
        Create
      </Button>
    </div>

    {branchLoading?(
      <Spin/>
    ):(
      <Table
        dataSource={
          branches.map((branch)=>({
            name:branch,
          }))
        }
        rowKey="name"
        pagination={false}
        columns={[
          {
            title:'Branch',
            dataIndex:'name',
          },
          {
            title:'Action',
            render:(_,record)=>(
              <Button
                danger
                onClick={()=>
                  deleteBranchMutation.mutate(record.name)
                }
              >
                Delete
              </Button>
            ),
          },
        ]}
      />
    )}
  </>
)

export default BranchManager
