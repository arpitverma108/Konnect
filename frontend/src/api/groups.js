import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './index'

const KEYS = {
  all: ['groups'],
  detail: (id) => ['groups', id],
  members: (id) => ['groups', id, 'members'],
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

const fetchGroups = () => apiClient.get('/groups')
const fetchGroup = (id) => apiClient.get(`/groups/${id}`)
const fetchGroupMembers = (id) => apiClient.get(`/groups/${id}/members`)
const createGroup = (data) => apiClient.post('/groups', data)
const updateGroup = ({ id, ...data }) => apiClient.put(`/groups/${id}`, data)
const deleteGroup = (id) => apiClient.delete(`/groups/${id}`)
const addGroupMember = ({ groupId, username }) =>
  apiClient.post(`/groups/${groupId}/members`, { username })
const removeGroupMember = ({ groupId, username }) =>
  apiClient.delete(`/groups/${groupId}/members/${username}`)

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useGroups = () =>
  useQuery({ queryKey: KEYS.all, queryFn: fetchGroups })

export const useGroup = (id) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => fetchGroup(id),
    enabled: !!id,
  })

export const useGroupMembers = (id) =>
  useQuery({
    queryKey: KEYS.members(id),
    queryFn: () => fetchGroupMembers(id),
    enabled: !!id,
  })

export const useCreateGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export const useUpdateGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateGroup,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) })
    },
  })
}

export const useDeleteGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export const useAddGroupMember = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addGroupMember,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.members(vars.groupId) })
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

export const useRemoveGroupMember = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeGroupMember,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.members(vars.groupId) })
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}
