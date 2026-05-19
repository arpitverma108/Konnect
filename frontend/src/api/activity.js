import {
  keepPreviousData,
  useQuery,
} from '@tanstack/react-query'

import apiClient from './index'
import {normalizePaginated} from '../utils/normalize'
import {cleanQueryParams} from '../utils/queryParams'
import {queryKeys} from '../lib/queryKeys'

export const getActivity=(params={})=>
  apiClient.get('/activity',{
    params:
      cleanQueryParams(params),
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
    cleanQueryParams(params)

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

    select:(res)=>{
      const paginated=
        normalizePaginated(res)

      return isLegacyLimit
        ?paginated.list
        :paginated
    },
  })
}
