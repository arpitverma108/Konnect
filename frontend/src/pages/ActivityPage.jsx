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
  Pagination,
  Select,
  Space,
  Typography,
} from 'antd'

import {SearchOutlined} from '@ant-design/icons'

import {useActivity} from '../api/activity'
import {useRepositories} from '../api/repositories'
import {useUsers} from '../api/users'
import ActivityFeed from '../components/dashboard/ActivityFeed'

import useDebouncedValue from '../hooks/useDebouncedValue'
import useFormattedActivity from '../hooks/useFormattedActivity'

import PageError from '../components/common/PageError'

import {
  normalizeList,
  normalizePaginated,
} from '../utils/normalize'
import {cleanQueryParams} from '../utils/queryParams'

const {Title,Text}=Typography
const {RangePicker}=DatePicker

const pageSize=50

const initialFilters={
  repo:undefined,
  author:undefined,
  eventType:undefined,
  search:'',
  dateRange:null,
}

const activityEventOptions=[
  {label:'Commit',value:'commit'},
  {label:'Branch',value:'branch_create'},
  {label:'Tag',value:'tag_create'},
  {label:'Repository',value:'repo_create'},
  {label:'Sync',value:'sync'},
]

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

const mergeOptions=(options)=>[
  ...new Map(
    options.map((option)=>[
      option.value,
      option,
    ])
  ).values(),
]

const ActivityPage=()=>{
  const [page,setPage]=useState(1)
  const [filters,setFilters]=useState(initialFilters)

  const debouncedSearch=
    useDebouncedValue(filters.search,350)

  const activityParams=useMemo(()=>{
    const [fromDate,toDate]=
      filters.dateRange || []

    return cleanQueryParams({
      author:filters.author,
      repo:filters.repo,
      eventType:filters.eventType,
      search:debouncedSearch.trim(),
      startDate:fromDate?.startOf('day').toISOString(),
      endDate:toDate?.endOf('day').toISOString(),
      page,
      limit:pageSize,
      from:fromDate?.startOf('day').toISOString(),
      to:toDate?.endOf('day').toISOString(),
    })
  },[
    page,
    filters.repo,
    filters.author,
    filters.eventType,
    filters.dateRange,
    debouncedSearch,
  ])

  const {
    data:response,
    isLoading,
    isFetching,
    isError,
  }=useActivity(activityParams)

  const {
    data:repoData,
    isLoading:reposLoading,
  }=useRepositories({
    limit:100,
  })

  const {
    data:userData,
    isLoading:usersLoading,
  }=useUsers({
    limit:100,
  })

  const logs=
    response?.list || []

  const total=
    response?.total || logs.length

  const activityList=
    useFormattedActivity(logs)

  const {
    list:repos,
  }=normalizePaginated(repoData)

  const users=
    normalizeList(userData)

  const repositoryOptions=useMemo(()=>
    toOptions(
      repos,
      [
        'name',
        'repo_name',
        'repository',
        'repository_name',
      ]
    ),
  [
    repos,
  ])

  const userOptions=useMemo(()=>
    toOptions(
      users,
      [
        'username',
        'author',
        'actor',
        'user',
        'admin',
        'email',
      ]
    ),
  [
    users,
  ])

  const actionOptions=useMemo(()=>
    mergeOptions([
      ...activityEventOptions,
      ...toOptions(
        logs,
        [
          'event_type',
          'action_type',
          'type',
        ]
      ),
    ]),
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

  if(isError){
    return(
      <PageError message="Failed to load activity"/>
    )
  }

  return(
    <div style={{padding:24}}>

      <Flex
        justify="space-between"
        align="flex-start"
        gap={16}
        wrap="wrap"
        style={{marginBottom:20}}
      >
        <div>
          <Title
            level={2}
            style={{margin:0}}
          >
            Activity
          </Title>

          <Text type="secondary">
            Repository and SVN activity across commits, branches, tags, and syncs.
          </Text>
        </div>
      </Flex>

      <div
        className="glass-panel"
        style={{
          padding:16,
          marginBottom:20,
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
            placeholder="Repository"
            loading={reposLoading}
            optionFilterProp="label"
            value={filters.repo}
            options={repositoryOptions}
            onChange={(value)=>
              updateFilter('repo',value)
            }
            style={{
              width:220,
              maxWidth:'100%',
            }}
          />

          <Select
            allowClear
            showSearch
            placeholder="User"
            loading={usersLoading}
            optionFilterProp="label"
            value={filters.author}
            options={userOptions}
            onChange={(value)=>
              updateFilter('author',value)
            }
            style={{
              width:200,
              maxWidth:'100%',
            }}
          />

          <Select
            allowClear
            showSearch
            placeholder="Action type"
            optionFilterProp="label"
            value={filters.eventType}
            options={actionOptions}
            onChange={(value)=>
              updateFilter('eventType',value)
            }
            style={{
              width:200,
              maxWidth:'100%',
            }}
          />

          <Input
            allowClear
            placeholder="Search activity"
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

      <ActivityFeed
        data={activityList}
        loading={isLoading||isFetching}
        title="All Activity"
        emptyText="No activity found"
      />

      <Flex
        justify="flex-end"
        style={{marginTop:16}}
      >
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger={false}
          onChange={setPage}
        />
      </Flex>

    </div>
  )
}

export default ActivityPage
