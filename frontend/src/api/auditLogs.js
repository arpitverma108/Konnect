import {useQuery} from '@tanstack/react-query'
import apiClient from './index'

export const getAuditLogs=(params={})=>
  apiClient.get('/audit-logs',{params})

export const useAuditLogs=(
  params={},
  options={}
)=>
  useQuery({
    queryKey:[
      'audit-logs',
      params,
    ],

    queryFn:()=>
      getAuditLogs(params),

    enabled:
      options.enabled ?? true,

    select:(raw)=>({

      list:
        raw?.data
        ||
        raw?.logs
        ||
        raw?.items
        ||
        [],

      total:
        raw?.total
        ??
        raw?.count
        ??
        0,
    }),
  })

export const getCommitLogs=(params={})=>
  apiClient.get(
    '/audit-logs/commits',
    {params}
  )

export const useCommitLogs=(
  params={},
  options={}
)=>
  useQuery({
    queryKey:[
      'commit-logs',
      params,
    ],

    queryFn:()=>
      getCommitLogs(params),

    enabled:
      options.enabled ?? true,

    select:(raw)=>({

      list:
        raw?.data
        ||
        raw?.logs
        ||
        raw?.items
        ||
        raw?.activity
        ||
        [],

      total:
        raw?.total
        ??
        raw?.count
        ??
        0,
    }),
  })