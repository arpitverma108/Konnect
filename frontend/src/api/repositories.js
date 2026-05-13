
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './index'

const KEYS = {
  all: (params) => ['repositories', params],
  detail: (id) => ['repositories', id],
  activity: (repoId, params) => ['repositories', repoId, 'activity', params],
  files: (repoId) => ['repo-tree', repoId],
  fileContent: (repoId, path) => ['file-content', repoId, path],
}

const normalizeList = (res) => {
  const raw = res?.data ?? res

  if (Array.isArray(raw)) return raw
  if (Array.isArray(raw?.data)) return raw.data
  if (Array.isArray(raw?.repositories)) return raw.repositories

  return []
}

const normalizePaginated = (res) => {
  const raw = res?.data ?? res
  const list = normalizeList(res)

  return {
    list,
    total: raw?.total ?? raw?.count ?? list.length,
  }
}

// REPOS
export const getRepositories = (params = {}) =>
  apiClient.get('/repositories', { params })

const fetchRepository = (id) =>
  apiClient.get(`/repositories/${id}`)

const createRepository = (data) =>
  apiClient.post('/repositories', {
    name: data.name,
    description: data.description || '',
  })

const deleteRepository = (id) =>
  apiClient.delete(`/repositories/${id}`)

export const updateRepository = (id, data) =>
  apiClient.put(`/repositories/${id}`, data)

// ACTIVITY
export const getRepoActivity = (repoId, params = {}) =>
  apiClient.get(`/activity/repo/${repoId}`, { params })

// FILES
export const getRepoFilesByPath = (repoId) =>
  apiClient.get(`/repositories/${repoId}/tree`)

export const getFileContent = (repoId, path) =>
  apiClient.get(`/repositories/${repoId}/file-content`, {
    params: { path },
  })

// SYNC
export const syncAllActivity = () =>
  apiClient.post('/sync', {}, {
    headers: {
      'x-sync-secret': import.meta.env.VITE_SYNC_SECRET || '',
    },
  })

// HOOKS

export const useRepositories = (params = {}, options = {}) =>
  useQuery({
    queryKey: KEYS.all(params),
    queryFn: () => getRepositories(params),
    enabled: options.enabled ?? true,
    staleTime: 60 * 1000,
    select: (res) => normalizePaginated(res),
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
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ['repositories'],
        exact: false,
      }),
  })
}

export const useDeleteRepository = () => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: deleteRepository,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ['repositories'],
        exact: false,
      }),
  })
}

export const useRepoActivity = (repoId, params = {}) =>
  useQuery({
    queryKey: KEYS.activity(repoId, params),
    queryFn: () => getRepoActivity(repoId, params),
    enabled: !!repoId,
    select: (res) => normalizeList(res),
  })

export const useRepoFilesByPath = (repoId) =>
  useQuery({
    queryKey: KEYS.files(repoId),
    queryFn: () => getRepoFilesByPath(repoId),
    enabled: !!repoId,

    select: (res) => {
      const raw = res?.tree || res?.data?.tree || []

      if (!Array.isArray(raw)) return []

      const root = []
      const stack = []

      raw.forEach((line) => {
        const trimmed = line.trim()

        if (trimmed === '/') return

        const spaces =
          line.match(/^ */)?.[0]?.length || 0

        const depth = spaces

        const isDir =
          trimmed.endsWith('/')

        const name =
          trimmed.replace(/\/$/, '')

        const node = {
          name,
          type: isDir ? 'dir' : 'file',
          children: [],
        }

        if (depth === 1) {
          root.push(node)
          stack[1] = node
        } else {
          const parent =
            stack[depth - 1]

          if (parent) {
            parent.children.push(node)
          }

          stack[depth] = node
        }
      })

      return root
    },
  })

export const useFileContent = (
  repoId,
  path
) =>
  useQuery({
    queryKey: KEYS.fileContent(
      repoId,
      path
    ),

    queryFn: () =>
      getFileContent(
        repoId,
        path
      ),

    enabled:
      !!repoId && !!path,

    select: (res) =>
      res?.content ??
      res?.data?.content ??
      '',
  })

export const useSyncActivity = () => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: syncAllActivity,

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['repositories'],
        exact: false,
      })

      qc.invalidateQueries({
        queryKey: ['activity'],
      })
    },
  })
}

export const useBranches = (repoId) =>
  useQuery({
    queryKey: ['branches', repoId],

    queryFn: () =>
      apiClient.get(
        `/repositories/${repoId}/branches`
      ),

    enabled: !!repoId,

    staleTime: 60 * 1000,

    select: (res) =>
      res?.branches ||
      res?.data?.branches ||
      [],
  })

export const useCreateBranch = (
  repoId
) => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data) =>
      apiClient.post(
        `/repositories/${repoId}/branches`,
        data
      ),

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['branches', repoId],
      })
    },
  })
}

export const useDeleteBranch = (
  repoId
) => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (name) =>
      apiClient.delete(
        `/repositories/${repoId}/branches/${encodeURIComponent(name)}`
      ),

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['branches', repoId],
      })
    },
  })
}

export const useTags = (repoId) =>
  useQuery({
    queryKey: ['tags', repoId],

    queryFn: () =>
      apiClient.get(
        `/repositories/${repoId}/tags`
      ),

    enabled: !!repoId,

    staleTime: 60 * 1000,

    select: (res) =>
      res?.tags ||
      res?.data?.tags ||
      [],
  })

export const useCreateTag = (
  repoId
) => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data) =>
      apiClient.post(
        `/repositories/${repoId}/tags`,
        data
      ),

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['tags', repoId],
      })
    },
  })
}

export const useDeleteTag = (
  repoId
) => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (name) =>
      apiClient.delete(
        `/repositories/${repoId}/tags/${encodeURIComponent(name)}`
      ),

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['tags', repoId],
      })
    },
  })
}

export const useRepoCommits = (
  repoId,
  params = {}
) =>
  useQuery({
    queryKey: [
      'repo-commits',
      repoId,
      params,
    ],

    queryFn: () =>
      apiClient.get(
        `/repositories/${repoId}/commits`,
        { params }
      ),

    enabled: !!repoId,

    staleTime: 30 * 1000,

    select: (res) => {
      const raw =
        res?.commits ||
        res?.data?.commits ||
        []

      return (
        Array.isArray(raw)
          ? raw
          : []
      ).map((c) => ({
        revision: c.revision,
        author: c.author,
        message:
          c.message ||
          c.msg ||
          'No message',

        date:
          c.date ||
          c.committed_at ||
          '',
      }))
    },
  })