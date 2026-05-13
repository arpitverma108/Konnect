
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import apiClient from './index'

const normalize=(res)=>{

  const raw=
    res?.data ?? res

  const list=
    raw?.data
    ||
    raw?.notifications
    ||
    raw?.items
    ||
    []

  return{
    list,
    total:
      raw?.total
      ??
      raw?.count
      ??
      list.length,
  }
}

export const useNotifications=(
  params={},
  options={}
)=>
  useQuery({

    queryKey:[
      'notifications',
      params,
    ],

    queryFn:()=>
      apiClient.get(
        '/notifications',
        {params}
      ),

    enabled:
      options.enabled ?? true,

    refetchInterval:()=>{

      if(
        !options.enabled
        ||
        document.hidden
      ){
        return false
      }

      return 30000
    },

    staleTime:30000,

    refetchOnWindowFocus:false,

    select:normalize,
  })

export const useNotificationCount=
  (options={})=>
    useQuery({

      queryKey:[
        'notifications-count',
      ],

      queryFn:()=>
        apiClient.get(
          '/notifications/count'
        ),

      enabled:
        options.enabled ?? true,

      staleTime:30000,

      refetchInterval:30000,
    })

export const useMarkNotificationsRead=
  ()=>{

    const qc=
      useQueryClient()

    return useMutation({

      mutationFn:()=>
        apiClient.post(
          '/notifications/mark-read'
        ),

      onSuccess:()=>{

        qc.invalidateQueries({
          queryKey:[
            'notifications',
          ],
        })

        qc.invalidateQueries({
          queryKey:[
            'notifications-count',
          ],
        })
      },
    })
  }