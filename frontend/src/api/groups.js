import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './index'
import {queryKeys} from '../lib/queryKeys'

// ─── Fetchers ─────────────────────────────────────────────────────────────────

export const getGroups = (params = {}) =>
  apiClient.get('/groups', { params })

const fetchGroups = (params = {}) => getGroups(params)
const fetchGroup = (id) => apiClient.get(`/groups/${id}`)
const fetchGroupMembers = (id) => apiClient.get(`/groups/${id}/members`)
const createGroup = (data) =>
  apiClient.post('/groups', { name: data.name, description: data.description || null })
const deleteGroup = (id) => apiClient.delete(`/groups/${id}`)

// Backend expects { userId } (integer) for adding members
const addGroupMember = ({ groupId, userId }) =>
  apiClient.post(`/groups/${groupId}/members`, { userId })

// Backend route is DELETE /groups/:id/members/:userId
const removeGroupMember = ({ groupId, userId }) =>
  apiClient.delete(`/groups/${groupId}/members/${userId}`)

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useGroups = (
  params = {},
  options = {}
) =>
  useQuery({
    queryKey: queryKeys.groups.list(params),
    queryFn: () => fetchGroups(params),
    enabled: options.enabled ?? true,
  })

export const useGroup = (id) =>
  useQuery({
    queryKey: queryKeys.groups.detail(id),
    queryFn: () => fetchGroup(id),
    enabled: !!id,
  })

export const useGroupMembers = (id) =>
  useQuery({
    queryKey: queryKeys.groups.members(id),
    queryFn: () => fetchGroupMembers(id),
    enabled: !!id,
  })

export const useCreateGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.groups.all }),
  })
}

export const useDeleteGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.groups.all }),
  })
}

export const useAddGroupMember = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addGroupMember,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.groups.members(vars.groupId) })
      qc.invalidateQueries({ queryKey: queryKeys.groups.all })
    },
  })
}

export const useRemoveGroupMember = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeGroupMember,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.groups.members(vars.groupId) })
      qc.invalidateQueries({ queryKey: queryKeys.groups.all })
    },
  })
}
