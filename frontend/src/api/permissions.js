
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './index'

const KEYS = {
  byRepo: (repoId) => ['permissions', repoId],
}

// 🔹 FETCH
const fetchPermissions = (repoId) =>
  apiClient.get(`/permissions/repo/${repoId}`)

// 🔹 SAVE / UPDATE
const savePermission = ({ repoId, ...data }) =>
  apiClient.post(`/permissions/repo/${repoId}`, data)

// 🔹 DELETE
const deletePermission = (id) =>
  apiClient.delete(`/permissions/${id}`)

// 🔹 GET HOOK
export const usePermissions = (repoId) =>
  useQuery({
    queryKey: KEYS.byRepo(repoId),
    queryFn: () => fetchPermissions(repoId),
    enabled: !!repoId,
    select: (res) => {
      if (Array.isArray(res)) return res
      return res?.permissions || res?.data || []
    },
  })

// 🔹 SAVE HOOK
export const useSavePermission = (repoId) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => savePermission({ repoId, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.byRepo(repoId) })
    },
  })
}

// 🔹 DELETE HOOK (NEW)
export const useDeletePermission = (repoId) => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: deletePermission,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.byRepo(repoId) })
    },
  })
}
