import apiClient from '../api'
import useAppStore from '../store'
import {queryClient} from '../lib/queryClient'

export const logout=async(navigate)=>{

  try{

    const refreshToken=
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

    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')

    navigate('/login',{
      replace:true,
    })
  }
}