//users.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './index'
import {queryKeys} from '../lib/queryKeys'
import {staleTimes,gcTimes} from '../lib/queryConfig'

const KEYS = {
  all: queryKeys.users.all,
  list: queryKeys.users.list,
  detail: queryKeys.users.detail,
  me: queryKeys.users.me,
}

// ─── API CALLS ─────────────────────────────────────────

export const getUsers = (params = {}) =>
  apiClient.get('/users', { params })

const fetchUsers = (params = {}) => getUsers(params)

export const fetchMe = () => apiClient.get('/users/me')

const createUser = (data) =>
  apiClient.post('/users', {
    username: data.username,
    password: data.password,
    email: data.email || null,
    fullName: data.fullName || data.full_name || null,
    role: data.role || 'viewer',
  })

const updateUser = ({ id, ...data }) =>
  apiClient.put(`/users/${id}`, {
    email: data.email ?? null,
    fullName: data.fullName ?? data.full_name ?? null,
    isActive: data.isActive ?? data.is_active,
    role: data.role ?? undefined,
  })

const deleteUser = (id) => apiClient.delete(`/users/${id}`)

const resetPassword = ({ id, newPassword }) =>
  apiClient.put(`/users/${id}/password`, { password: newPassword })

// ─── HOOKS ─────────────────────────────────────────

export const useUsers=(
  params={},
  options={}
)=>
  useQuery({

    queryKey:
      KEYS.list(params),

    queryFn:()=>
      fetchUsers(params),

    enabled:
      options.enabled ?? true,
  })

export const useUser=(id)=>
  useQuery({

    queryKey:
      KEYS.detail(id),

    queryFn:()=>
      apiClient.get(
        `/users/${id}`
      ),

    enabled:!!id,

    staleTime:
      staleTimes.long,
  })
 

export const useMe = () =>
  useQuery({
    queryKey: KEYS.me,
    queryFn: fetchMe,

    retry: false,

    staleTime:
      staleTimes.long,

    gcTime:
      gcTimes.standard,

    refetchOnWindowFocus:
      false,

    refetchOnReconnect:
      false,
  })

// ─── MUTATIONS ─────────────────────────────────────────

export const useCreateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export const useUpdateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateUser,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) })
    },
  })
}

export const useDeleteUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export const useResetPassword = () =>
  useMutation({ mutationFn: resetPassword })
