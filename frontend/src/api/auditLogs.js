import {
  keepPreviousData,
  useQuery,
} from '@tanstack/react-query'

import apiClient from './index'
import {normalizePaginated} from '../utils/normalize'
import {cleanQueryParams} from '../utils/queryParams'
import {queryKeys} from '../lib/queryKeys'

export const getAuditLogs=(params={})=>
  apiClient.get('/audit-logs',{
    params:
      cleanQueryParams(params),
  })

export const useAuditLogs=(
  params={},
  options={}
)=>
  useQuery({
    queryKey:[
      ...queryKeys.auditLogs.list(
        cleanQueryParams(params)
      ),
    ],

    queryFn:()=>
      getAuditLogs(params),

    enabled:
      options.enabled ?? true,

    placeholderData:
      options.placeholderData ?? keepPreviousData,

    select:(raw)=>
      normalizePaginated(raw),
  })

export const getCommitLogs=(params={})=>
  apiClient.get(
    '/audit-logs/commits',
    {
      params:
        cleanQueryParams(params),
    }
  )

export const useCommitLogs=(
  params={},
  options={}
)=>
  useQuery({
    queryKey:[
      ...queryKeys.auditLogs.commits(
        cleanQueryParams(params)
      ),
    ],

    queryFn:()=>
      getCommitLogs(params),

    enabled:
      options.enabled ?? true,

    placeholderData:
      options.placeholderData ?? keepPreviousData,

    select:(raw)=>
      normalizePaginated(raw),
  })
