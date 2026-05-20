import {
  keepPreviousData,
  useQuery,
} from '@tanstack/react-query'

import apiClient from './index'
import {normalizePaginated} from '../utils/normalize'
import {cleanQueryParams} from '../utils/queryParams'
import {queryKeys} from '../lib/queryKeys'
import {staleTimes} from '../lib/queryConfig'

const normalizeActivityParams=(params={})=>{
  const {
    eventType,
    event_type,
    author,
    actor,
    startDate,
    endDate,
    ...rest
  }=params

  return cleanQueryParams({
    ...rest,
    author:author ?? actor,
    event_type:event_type ?? eventType,
    from:rest.from ?? startDate,
    to:rest.to ?? endDate,
  })
}

export const getActivity=(params={})=>
  apiClient.get('/activity',{
    params:
      normalizeActivityParams(params),
  })

export const useActivity=(
  paramsOrLimit={},
  options={}
)=>{
  const isLegacyLimit=
    typeof paramsOrLimit==='number'

  const params=
    isLegacyLimit
      ?{limit:paramsOrLimit}
      :paramsOrLimit

  const queryParams=
    normalizeActivityParams(params)

  return useQuery({
    queryKey:[
      ...queryKeys.activity.list(queryParams),
    ],

    queryFn:()=>
      getActivity(queryParams),

    enabled:
      options.enabled ?? true,

    placeholderData:
      options.placeholderData ?? keepPreviousData,

    staleTime:
      options.staleTime ?? staleTimes.realtime,

    refetchInterval:
      options.refetchInterval ?? 15000,

    refetchOnWindowFocus:
      true,

    select:(res)=>{
      const paginated=
        normalizePaginated(res)

      return isLegacyLimit
        ?paginated.list
        :paginated
    },
  })
}
