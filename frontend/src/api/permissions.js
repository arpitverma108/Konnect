import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './index'

const KEYS = {
  byRepo: (repoId) => ['permissions', repoId],
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

const fetchPermissions = (repoId) => apiClient.get(`/permissions/${repoId}`)
const savePermission = (data) => apiClient.post('/permissions', data)
const deletePermission = (id) => apiClient.delete(`/permissions/${id}`)
const rebuildAuthz = () => apiClient.post('/permissions/rebuild')

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const usePermissions = (repoId) =>
  useQuery({
    queryKey: KEYS.byRepo(repoId),
    queryFn: () => fetchPermissions(repoId),
    enabled: !!repoId,
  })

export const useSavePermission = (repoId) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: savePermission,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.byRepo(repoId) }),
  })
}

export const useDeletePermission = (repoId) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePermission,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.byRepo(repoId) }),
  })
}

export const useRebuildAuthz = () =>
  useMutation({ mutationFn: rebuildAuthz })
