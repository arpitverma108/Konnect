
import React,{useState} from 'react'
import {Row,Col,Typography} from 'antd'

import StatCards from '../components/dashboard/StatCards'
import ActivityFeed from '../components/dashboard/ActivityFeed'
import CommitChart from '../components/dashboard/CommitChart'

import {
  useDashboardStats,
  useCommitActivity,
} from '../api/dashboard'

import {useAuditLogs} from '../api/auditLogs'
import {useMe} from '../api/users'

import useFormattedActivity from '../hooks/useFormattedActivity'
import useRole from '../hooks/useRole'

import PageLoader from '../components/common/PageLoader'
import PageError from '../components/common/PageError'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

const {Title}=Typography

const DashboardPage=()=>{

  const [days]=useState(7)

  const {data:me}=useMe()

  const {isAdmin}=useRole(me)

  const {
    data:stats,
    isLoading:statsLoading,
    isError:statsError,
  }=useDashboardStats()

  const {
    data:commitData,
    isLoading:commitLoading,
  }=useCommitActivity(days)

  const {
    data:activityResponse,
    isLoading:activityLoading,
  }=useAuditLogs(
    {
      page:1,
      limit:10,
    },
    {
      enabled:isAdmin,
    }
  )

  const logs=
  activityResponse?.list
  || []
  const activityList=
    useFormattedActivity(
      logs,
      {
        enabled:isAdmin,
      }
    )

  if(statsLoading||commitLoading){
    return <PageLoader/>
  }

  if(statsError||!stats){
    return (
      <PageError message="Failed to load dashboard"/>
    )
  }

  const commits=
    Array.isArray(commitData)
      ?commitData
      :commitData?.data||[]

  const fixedChartData=
    commits
      .map((item)=>({
        date:
          item.date
          ||
          item.day
          ||
          item.created_at,

        count:
          item.count
          ??
          item.commits
          ??
          0,
      }))
      .filter((item)=>item.date)

  const commitsToday=
    commits.filter(
      (c)=>
        c?.date
        &&
        dayjs(c.date).isSame(
          dayjs(),
          'day'
        )
    ).length

  return(
    <div
      style={{
        maxWidth:1200,
        margin:'0 auto',
        padding:24,
      }}
    >

      <Title level={2}>
        Dashboard
      </Title>

      <StatCards
        stats={{
          ...stats,
          commitsToday,
        }}
        loading={statsLoading}
      />

      <Row
        gutter={[24,24]}
        style={{marginTop:24}}
      >

        <Col xs={24} lg={16}>
          <CommitChart
            data={fixedChartData}
            loading={commitLoading}
          />
        </Col>

        {isAdmin&&(
          <Col xs={24} lg={8}>
            <ActivityFeed
              data={activityList}
              loading={activityLoading}
            />
          </Col>
        )}

      </Row>

    </div>
  )
}

export default DashboardPage