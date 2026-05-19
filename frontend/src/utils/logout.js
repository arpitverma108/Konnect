import apiClient from '../api'
import useAppStore from '../store'
import {queryClient} from '../lib/queryClient'

export const logout=async(navigate)=>{

  try{

    const refreshToken=
      useAppStore
        .getState()
        .refreshToken
      ||
      localStorage.getItem(
        'refreshToken'
      )

    if(refreshToken){

      await apiClient.post(
        '/auth/logout',
        {refreshToken}
      )
    }

  }catch(err){

    console.error(
      'Logout failed:',
      err
    )

  }finally{

    queryClient.clear()

    useAppStore
      .getState()
      .logout()

    navigate('/login',{
      replace:true,
    })
  }
}
