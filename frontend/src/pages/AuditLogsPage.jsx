import React,{useState} from 'react'

import {
  Typography,
  Table,
  Tag,
} from 'antd'

import {useCommitLogs} from '../api/auditLogs'

import PageLoader from '../components/common/PageLoader'
import PageError from '../components/common/PageError'

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const {Title,Text}=Typography

const AuditLogsPage=()=>{

  const [page,setPage]=useState(1)

  const limit=50

  const{
    data:response,
    isLoading,
    isError,
  }=useCommitLogs({
    limit,
    offset:(page-1)*limit,
  })

  const logs=
    response?.list || []

  const total=
    response?.total || 0

  const columns=[
  {
    title:'Repository',
    dataIndex:'repo_name',
    key:'repo_name',

    render:(repo)=>
      <Tag color="blue">
        {repo || '—'}
      </Tag>,
  },

  {
    title:'Revision',
    dataIndex:'revision',
    key:'revision',

    render:(rev)=>
      rev
      ?`r${rev}`
      :'—',
  },

  {
    title:'Author',
    dataIndex:'author',
    key:'author',

    render:(author)=>
      author || '—',
  },

  {
    title:'Commit Message',
    dataIndex:'message',
    key:'message',

    render:(msg)=>(
      <Text code>
        {msg || '—'}
      </Text>
    ),
  },

  {
    title:'Time',
    dataIndex:'committed_at',
    key:'committed_at',

    render:(t)=>
      t
      ?(
        <span
          title={
            new Date(t)
              .toLocaleString()
          }
        >
          {dayjs(t).fromNow()}
        </span>
      )
      :'—',
  },
]

  if(isLoading){
    return <PageLoader/>
  }

  if(isError){
    return(
      <PageError message="Failed to load commit logs"/>
    )
  }

  return(
    <div style={{paddingBottom:24}}>

      <div style={{marginBottom:24}}>

        <Title
          level={2}
          style={{margin:0}}
        >
          Audit Logs
        </Title>

        <Text type="secondary">
          SVN commit history and repository audit trail.
        </Text>

      </div>

      <div
        className="glass-panel"
        style={{padding:24}}
      >

        <Table
          scroll={{x:1000}}

          dataSource={logs}

          columns={columns}

          rowKey={(r)=>
  `${r.repo_name}-${r.revision}`
}

          pagination={{
            current:page,
            pageSize:limit,
            total,

            onChange:setPage,

            showSizeChanger:false,
          }}

          locale={{
            emptyText:
              'No commit logs found',
          }}
        />

      </div>

    </div>
  )
}

export default AuditLogsPage