import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import apiClient from './index'
import {queryKeys} from '../lib/queryKeys'

const KEYS={
  byRepo:queryKeys.permissions.byRepo,
}

// 🔹 FETCH
const fetchPermissions=async(repoId)=>{

  const res=
    await apiClient.get(
      `/permissions/repo/${repoId}`
    )

  // ✅ interceptor already returns res.data
  // backend response:
  // {
  //   page,
  //   limit,
  //   count,
  //   data:[...]
  // }

  return Array.isArray(res?.data)
    ? res.data
    : []
}

// 🔹 SAVE / UPDATE
const savePermission=({
  repoId,
  ...data
})=>
  apiClient.post(
    `/permissions/repo/${repoId}`,
    data
  )

// 🔹 DELETE
const deletePermission=(id)=>
  apiClient.delete(
    `/permissions/${id}`
  )

// 🔹 GET HOOK
export const usePermissions=(repoId)=>
  useQuery({

    queryKey:
      KEYS.byRepo(repoId),

    queryFn:()=>
      fetchPermissions(repoId),

    enabled:!!repoId,
  })

// 🔹 SAVE HOOK
export const useSavePermission=(repoId)=>{

  const qc=
    useQueryClient()

  return useMutation({

    mutationFn:(data)=>
      savePermission({
        repoId,
        ...data,
      }),

    onSuccess:()=>{

      qc.invalidateQueries({
        queryKey:
          KEYS.byRepo(repoId),
      })
    },
  })
}

// 🔹 DELETE HOOK
export const useDeletePermission=(repoId)=>{

  const qc=
    useQueryClient()

  return useMutation({

    mutationFn:
      deletePermission,

    onSuccess:()=>{

      qc.invalidateQueries({
        queryKey:
          KEYS.byRepo(repoId),
      })
    },
  })
}
