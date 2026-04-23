import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './index'

// ─── QUERY KEYS ─────────────────────────────────────────

const KEYS = {
  all: ['repositories'],
  detail: (id) => ['repositories', id],
}

// ─── API CALLS (REAL BACKEND) ───────────────────────────

export const getRepositories = () => apiClient.get('/repositories')

const fetchRepository = (id) => apiClient.get(`/repositories/${id}`)
const createRepository = (data) => apiClient.post('/repositories', data)
const updateRepository = ({ id, ...data }) =>
  apiClient.put(`/repositories/${id}`, data)
const deleteRepository = (id) =>
  apiClient.delete(`/repositories/${id}`)
const syncActivity = (id) =>
  apiClient.post(`/repositories/${id}/sync-activity`)
const fetchRepoLog = (id, limit) =>
  apiClient.get(`/repositories/${id}/log?limit=${limit}`)
const fetchRepoLs = (id, path) =>
  apiClient.get(`/repositories/${id}/ls?path=${path}`)

// ─── REACT QUERY HOOKS ─────────────────────────────────

export const useRepositories = () =>
  useQuery({
    queryKey: KEYS.all,
    queryFn: getRepositories,
  })

export const useRepository = (id) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => fetchRepository(id),
    enabled: !!id,
  })

export const useCreateRepository = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createRepository,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

export const useUpdateRepository = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateRepository,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) })
    },
  })
}

export const useDeleteRepository = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteRepository,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

export const useSyncActivity = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: syncActivity,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
      qc.invalidateQueries({ queryKey: ['repositories', id, 'log'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export const useRepoLog = (id, limit = 50) =>
  useQuery({
    queryKey: ['repositories', id, 'log', limit],
    queryFn: () => fetchRepoLog(id, limit),
    enabled: !!id,
  })

export const useRepoLs = (id, path = '/') =>
  useQuery({
    queryKey: ['repositories', id, 'ls', path],
    queryFn: () => fetchRepoLs(id, path),
    enabled: !!id,
  })