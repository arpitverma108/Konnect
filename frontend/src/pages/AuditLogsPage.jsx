import React,{
  useCallback,
  useMemo,
  useState,
} from 'react'

import {
  Button,
  DatePicker,
  Flex,
  Input,
  message,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'

import {SearchOutlined} from '@ant-design/icons'
import {Download} from 'lucide-react'

import {useAuditLogs} from '../api/auditLogs'

import PageError from '../components/common/PageError'
import BulkActionBar from '../components/common/BulkActionBar'
import EmptyState from '../components/common/EmptyState'

import useDebouncedValue from '../hooks/useDebouncedValue'
import useTableSelection from '../hooks/useTableSelection'

import {cleanQueryParams} from '../utils/queryParams'
import {downloadCsv} from '../utils/exportCsv'
import {
  getEventTypeColor,
  getEventTypeLabel,
  normalizeActivityEvent,
} from '../utils/activityModel'

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const {Title,Text}=Typography
const {RangePicker}=DatePicker

const limit=50

const initialFilters={
  user:undefined,
  entity:undefined,
  action:undefined,
  search:'',
  dateRange:null,
}

const warnedMissingRowKeys=new Set()

const getAuditLogRowKey=(record,index)=>{
  const stableKey=
    record.id
    ||
    record.audit_id
    ||
    record.revision
    ||
    record.created_at

  if(stableKey){
    return stableKey
  }

  const fallbackKey=
    `${record.repo_name || record.entity || 'audit'}-${index}`

  if(
    !import.meta.env.PROD
    &&
    !warnedMissingRowKeys.has(fallbackKey)
  ){
    warnedMissingRowKeys.add(fallbackKey)
    console.warn(
      '[AuditLogsPage] Missing stable row id for audit log row',
      record
    )
  }

  return fallbackKey
}

const getValue=(item,keys)=>
  keys
    .map((key)=>item?.[key])
    .find((value)=>
      value!==undefined
      &&
      value!==null
      &&
      value!==''
    )

const toOptions=(items,keys)=>[
  ...new Map(
    items
      .map((item)=>{
        const value=getValue(item,keys)

        if(!value){
          return null
        }

        return [
          String(value),
          {
            label:String(value),
            value:String(value),
          },
        ]
      })
      .filter(Boolean)
  ).values(),
]

const getAuditEventType=(record)=>
  normalizeActivityEvent(record).eventType

const AuditLogsPage=()=>{
  const [page,setPage]=useState(1)
  const [filters,setFilters]=useState(initialFilters)
  const [exporting,setExporting]=useState(false)

  const {
    selectedRowKeys,
    selectedCount,
    rowSelection,
    clearSelection,
  }=useTableSelection()

  const debouncedSearch=
    useDebouncedValue(filters.search,350)

  const params=useMemo(()=>{
    const [fromDate,toDate]=
      filters.dateRange || []

    return cleanQueryParams({
      limit,
      offset:(page-1)*limit,
      user:filters.user,
      entity:filters.entity,
      action:filters.action,
      search:debouncedSearch.trim(),
      from:fromDate?.startOf('day').toISOString(),
      to:toDate?.endOf('day').toISOString(),
    })
  },[
    page,
    filters.user,
    filters.entity,
    filters.action,
    filters.dateRange,
    debouncedSearch,
  ])

  const{
    data:response,
    isLoading,
    isFetching,
    isError,
  }=useAuditLogs(params)

  const logs=
    response?.list || []

  const total=
    response?.total || 0

  const userOptions=useMemo(()=>
    toOptions(
      logs,
      [
        'admin',
        'admin_username',
        'username',
        'user',
        'actor',
        'author',
      ]
    ),
  [logs])

  const entityOptions=useMemo(()=>
    toOptions(
      logs,
      [
        'entity',
        'entity_type',
        'resource',
        'target_type',
        'repo_name',
      ]
    ),
  [logs])

  const actionOptions=useMemo(()=>
    toOptions(
      logs,
      [
        'action',
        'action_type',
        'type',
        'event',
      ]
    ),
  [logs])

  const updateFilter=useCallback((key,value)=>{
    setFilters((current)=>({
      ...current,
      [key]:value,
    }))
    setPage(1)
  },[])

  const resetFilters=useCallback(()=>{
    setFilters(initialFilters)
    setPage(1)
  },[])

  const exportRows=useMemo(()=>
    selectedCount
      ?logs.filter((record,index)=>
        selectedRowKeys.includes(
          record.id
          ||
          record.audit_id
          ||
          `${record.repo_name || record.entity || 'audit'}-${record.revision || record.created_at || index}`
        )
      )
      :logs,
  [
    logs,
    selectedCount,
    selectedRowKeys,
  ])

  const handleExport=useCallback(()=>{
    if(!exportRows.length){
      message.info('No audit logs to export')
      return
    }

    setExporting(true)

    try{
      downloadCsv({
        filename:`audit-logs-${dayjs().format('YYYY-MM-DD-HHmm')}.csv`,
        rows:exportRows,
        columns:[
          {
            header:'User / Admin',
            value:(record)=>
              getValue(record,[
                'admin',
                'admin_username',
                'username',
                'user',
                'actor',
                'author',
              ]),
          },
          {
            header:'Entity',
            value:(record)=>
              getValue(record,[
                'entity',
                'entity_type',
                'resource',
                'target_type',
                'repo_name',
              ]),
          },
          {
            header:'Action',
            value:(record)=>
              getValue(record,[
                'action',
                'action_type',
                'type',
                'event',
              ]),
          },
          {
            header:'Message',
            value:(record)=>
              getValue(record,[
                'message',
                'description',
                'details',
                'summary',
              ]),
          },
          {
            header:'Time',
            value:(record)=>
              getValue(record,[
                'created_at',
                'committed_at',
                'timestamp',
                'time',
              ]),
          },
        ],
      })

      message.success('Audit logs exported')
    }catch{
      message.error('Failed to export audit logs')
    }finally{
      setExporting(false)
    }
  },[
    exportRows,
  ])

  const columns=useMemo(()=>[
    {
      title:'User / Admin',
      key:'user',

      render:(_,record)=>
        getValue(record,[
          'admin',
          'admin_username',
          'username',
          'user',
          'actor',
          'author',
        ])
        || '—',
    },

    {
      title:'Entity',
      key:'entity',

      render:(_,record)=>{
        const entity=
          getValue(record,[
            'entity',
            'entity_type',
            'resource',
            'target_type',
            'repo_name',
          ])

        return entity
          ?(
            <Tag color={getEventTypeColor(getAuditEventType(record))}>
              {entity}
            </Tag>
          )
          :'—'
      },
    },

    {
      title:'Action',
      key:'action',

      render:(_,record)=>{
        const action=
          getValue(record,[
          'action',
          'action_type',
          'type',
          'event',
        ])

        const eventType=
          getAuditEventType(record)

        return(
          <Tag color={getEventTypeColor(eventType)}>
            {action || getEventTypeLabel(eventType)}
          </Tag>
        )
      },
    },

    {
      title:'Message',
      key:'message',

      render:(_,record)=>(
        <Text code>
          {
            getValue(record,[
              'message',
              'description',
              'details',
              'summary',
            ])
            || '—'
          }
        </Text>
      ),
    },

    {
      title:'Time',
      key:'time',

      render:(_,record)=>{
        const time=
          getValue(record,[
            'created_at',
            'committed_at',
            'timestamp',
            'time',
          ])

        return time
          ?(
            <span
              title={
                new Date(time)
                  .toLocaleString()
              }
            >
              {dayjs(time).fromNow()}
            </span>
          )
          :'—'
      },
    },
  ],[])

  if(isError){
    return(
      <PageError message="Failed to load audit logs"/>
    )
  }

  return(
    <div style={{paddingBottom:24}}>

      <Flex
        justify="space-between"
        align="flex-start"
        gap={16}
        wrap="wrap"
        style={{marginBottom:24}}
      >
        <div>
          <Title
            level={2}
            style={{margin:0}}
          >
            Audit Logs
          </Title>

          <Text type="secondary">
            Administrative events, access changes, and repository audit trail.
          </Text>
        </div>

        <Button
          icon={<Download size={16}/>}
          loading={exporting}
          onClick={handleExport}
          disabled={!logs.length}
        >
          Export CSV
        </Button>
      </Flex>

      <div
        className="glass-panel"
        style={{
          padding:16,
          marginBottom:16,
        }}
      >
        <Space
          size={[12,12]}
          wrap
          style={{width:'100%'}}
        >
          <Select
            allowClear
            showSearch
            placeholder="User / Admin"
            optionFilterProp="label"
            value={filters.user}
            options={userOptions}
            onChange={(value)=>
              updateFilter('user',value)
            }
            style={{
              width:220,
              maxWidth:'100%',
            }}
          />

          <Select
            allowClear
            showSearch
            placeholder="Entity"
            optionFilterProp="label"
            value={filters.entity}
            options={entityOptions}
            onChange={(value)=>
              updateFilter('entity',value)
            }
            style={{
              width:200,
              maxWidth:'100%',
            }}
          />

          <Select
            allowClear
            showSearch
            placeholder="Action"
            optionFilterProp="label"
            value={filters.action}
            options={actionOptions}
            onChange={(value)=>
              updateFilter('action',value)
            }
            style={{
              width:200,
              maxWidth:'100%',
            }}
          />

          <Input
            allowClear
            placeholder="Search audit logs"
            prefix={<SearchOutlined/>}
            value={filters.search}
            onChange={(event)=>
              updateFilter('search',event.target.value)
            }
            style={{
              width:260,
              maxWidth:'100%',
            }}
          />

          <RangePicker
            value={filters.dateRange}
            onChange={(value)=>
              updateFilter('dateRange',value)
            }
            style={{
              width:280,
              maxWidth:'100%',
            }}
          />

          <Button onClick={resetFilters}>
            Reset filters
          </Button>
        </Space>
      </div>

      <div
        className="glass-panel"
        style={{padding:24}}
      >

        <BulkActionBar
          selectedCount={selectedCount}
          onClear={clearSelection}
          actions={
            <Button
              icon={<Download size={16}/>}
              loading={exporting}
              onClick={handleExport}
            >
              Export selected
            </Button>
          }
        />

        <Table
          scroll={{x:1000}}
          dataSource={logs}
          columns={columns}
          loading={isLoading||isFetching}
          rowSelection={rowSelection}
          rowKey={getAuditLogRowKey}
          pagination={{
            current:page,
            pageSize:limit,
            total,
            onChange:setPage,
            showSizeChanger:false,
          }}
          locale={{
            emptyText:
              <EmptyState title="No audit entries found"/>,
          }}
        />

      </div>

    </div>
  )
}

export default AuditLogsPage
