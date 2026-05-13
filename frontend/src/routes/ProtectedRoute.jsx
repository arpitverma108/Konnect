import {
  Navigate,
  Outlet,
} from 'react-router-dom'

import {
  useEffect,
} from 'react'

import {
  Spin,
} from 'antd'

import {
  useMe,
} from '../api/users'

import useRole from '../hooks/useRole'

import useAppStore from '../store'

import {
  queryClient,
} from '../lib/queryClient'

const ProtectedRoute=({
  allowedRoles,
})=>{

  const token=
    localStorage.getItem(
      'token'
    )

  const {
    data:me,
    isLoading,
    isError,
  }=useMe()

  const {role}=
    useRole(me)

  useEffect(()=>{

    if(isError){

      queryClient.clear()

      useAppStore
        .getState()
        .logout()
    }

  },[
    isError,
  ])

  if(!token){
    return(
      <Navigate
        to="/login"
        replace
      />
    )
  }

  if(isLoading){
    return(
      <div
        style={{
          textAlign:'center',
          padding:60,
        }}
      >
        <Spin size="large"/>
      </div>
    )
  }

  if(isError){
    return(
      <Navigate
        to="/login"
        replace
      />
    )
  }

  if(
    allowedRoles
    &&
    !allowedRoles.includes(
      role
    )
  ){
    return(
      <Navigate
        to="/dashboard"
        replace
      />
    )
  }

  return <Outlet/>
}

export default ProtectedRoute