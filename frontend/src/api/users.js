import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './index'
export const getUsers = () => apiClient.get('/users')
const KEYS = {
  all: ['users'],
  detail: (id) => ['users', id],
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

const fetchUsers = () => apiClient.get('/users')
const fetchUser = (id) => apiClient.get(`/users/${id}`)
const createUser = (data) => apiClient.post('/users', data)
const updateUser = ({ id, ...data }) => apiClient.put(`/users/${id}`, data)
const deleteUser = (id) => apiClient.delete(`/users/${id}`)
const resetPassword = ({ id, newPassword }) =>
  apiClient.put(`/users/${id}/password`, { password: newPassword })

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useUsers = () =>
  useQuery({ queryKey: KEYS.all, queryFn: fetchUsers })

export const useUser = (id) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => fetchUser(id),
    enabled: !!id,
  })

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
