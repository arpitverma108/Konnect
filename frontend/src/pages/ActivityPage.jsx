
// import React from 'react'
// import {Typography,Alert} from 'antd'

// import {useActivity} from '../api/activity'
// import ActivityFeed from '../components/dashboard/ActivityFeed'


// import useFormattedActivity from '../hooks/useFormattedActivity'

// import PageLoader from '../components/common/PageLoader'
// import PageError from '../components/common/PageError'

// const {Title}=Typography

// const ActivityPage=()=>{

//   const {
//     data:response,
//     isLoading,
//     isError,
//   }=useActivity(50)

// const logs=
//   response || []

//   const activityList=
//     useFormattedActivity(logs)

//   if(isLoading){
//     return <PageLoader/>
//   }

//   if(isError){
//     return (
//       <PageError message="Failed to load activity"/>
//     )
//   }

//   if(!activityList.length){

//     return(
//       <div style={{padding:24}}>

//         <Title level={2}>
//           Activity
//         </Title>

//         <Alert
//           type="info"
//           message="No activity found"
//         />

//       </div>
//     )
//   }

//   return(
//     <div style={{padding:24}}>

//       <Title
//         level={2}
//         style={{marginBottom:20}}
//       >
//         Activity
//       </Title>

//       <ActivityFeed
//         data={activityList}
//         loading={false}
//         title="All Activity"
//       />

//     </div>
//   )
// }

// export default ActivityPage
import React from 'react'
import {Typography,Alert} from 'antd'

import {useAuditLogs} from '../api/auditLogs'
import ActivityFeed from '../components/dashboard/ActivityFeed'

import useFormattedActivity from '../hooks/useFormattedActivity'

import PageLoader from '../components/common/PageLoader'
import PageError from '../components/common/PageError'

const {Title}=Typography

const ActivityPage=()=>{

  const{
    data:response,
    isLoading,
    isError,
  }=useAuditLogs({
    page:1,
    limit:50,
  })

  const logs=
    response?.list || []

  const activityList=
    useFormattedActivity(logs)

  if(isLoading){
    return <PageLoader/>
  }

  if(isError){
    return(
      <PageError message="Failed to load activity"/>
    )
  }

  if(!activityList.length){

    return(
      <div style={{padding:24}}>

        <Title level={2}>
          Activity
        </Title>

        <Alert
          type="info"
          message="No activity found"
        />

      </div>
    )
  }

  return(
    <div style={{padding:24}}>

      <Title
        level={2}
        style={{marginBottom:20}}
      >
        Activity
      </Title>

      <ActivityFeed
        data={activityList}
        loading={false}
        title="All Activity"
      />

    </div>
  )
}

export default ActivityPage