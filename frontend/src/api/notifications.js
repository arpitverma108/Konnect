
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import apiClient from './index'
import {queryKeys} from '../lib/queryKeys'
import {staleTimes} from '../lib/queryConfig'
import {normalizePaginated} from '../utils/normalize'
import {cleanQueryParams} from '../utils/queryParams'

const normalize=(res)=>{
  const paginated=
    normalizePaginated(res)

  return{
    ...paginated,
    list:
      paginated.list.map((item)=>({
        id:
          item.id ??
          item.notification_id ??
          item.audit_id ??
          item.created_at,
        read:
          item.read ??
          item.is_read ??
          item.read_at,
        ...item,
      })),
  }
}

const shouldPoll=(enabled)=>
  enabled && !document.hidden

const normalizeCount=(res)=>{
  const raw=
    res?.data ?? res

  return{
    count:
      raw?.count ??
      raw?.unread ??
      raw?.unread_count ??
      0,
  }
}

export const useNotifications=(
  params={},
  options={}
)=>
  useQuery({

    queryKey:[
      ...queryKeys.notifications.list(cleanQueryParams(params)),
    ],

    queryFn:()=>
      apiClient.get(
        '/notifications',
        {
          params:
            cleanQueryParams(params),
        }
      ),

    enabled:
      options.enabled ?? true,

    refetchInterval:()=>{
      if(!shouldPoll(options.enabled ?? true)){
        return false
      }

      return 30000
    },

    staleTime:
      staleTimes.short,

    refetchOnWindowFocus:false,

    select:normalize,
  })

export const useNotificationCount=
  (options={})=>
    useQuery({

      queryKey:[
        ...queryKeys.notifications.count,
      ],

      queryFn:()=>
        apiClient.get(
          '/notifications/count'
        ),

      enabled:
        options.enabled ?? true,

      staleTime:
        staleTimes.short,

      refetchInterval:()=>{
        if(!shouldPoll(options.enabled ?? true)){
          return false
        }

        return 30000
      },

      select:normalizeCount,
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
            ...queryKeys.notifications.all,
          ],
        })

        qc.invalidateQueries({
          queryKey:[
            ...queryKeys.notifications.count,
          ],
        })
      },
    })
  }
