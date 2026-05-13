import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './index'

const KEYS = {
  templates: ['hook-templates'],
  byRepo: (repoId) => ['hooks', repoId],
  single: (repoId, hookName) => ['hooks', repoId, hookName],
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

const fetchTemplates = () => apiClient.get('/hooks/templates')
const fetchRepoHooks = (repoId) => apiClient.get(`/hooks/repo/${repoId}`)
const fetchHook = (repoId, hookName) => apiClient.get(`/hooks/repo/${repoId}/${hookName}`)
const saveHook = ({ repoId, hookName, content }) =>
  apiClient.put(`/hooks/repo/${repoId}/${hookName}`, { content })
const toggleHook = ({ repoId, hookName, isEnabled }) =>
  apiClient.post(`/hooks/repo/${repoId}/${hookName}/toggle`, { isEnabled })
const deleteHook = ({ repoId, hookName }) =>
  apiClient.delete(`/hooks/repo/${repoId}/${hookName}`)

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useHookTemplates = () =>
  useQuery({ queryKey: KEYS.templates, queryFn: fetchTemplates })

export const useRepoHooks = (repoId) =>
  useQuery({
    queryKey: KEYS.byRepo(repoId),
    queryFn: () => fetchRepoHooks(repoId),
    enabled: !!repoId,
  })

export const useHook = (repoId, hookName) =>
  useQuery({
    queryKey: KEYS.single(repoId, hookName),
    queryFn: () => fetchHook(repoId, hookName),
    enabled: !!(repoId && hookName),
  })

export const useSaveHook = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveHook,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.byRepo(vars.repoId) })
      qc.invalidateQueries({ queryKey: KEYS.single(vars.repoId, vars.hookName) })
    },
  })
}

export const useToggleHook = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: toggleHook,
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: KEYS.byRepo(vars.repoId) }),
  })
}

export const useDeleteHook = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteHook,
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: KEYS.byRepo(vars.repoId) }),
  })
}
