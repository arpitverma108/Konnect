import { useQuery } from '@tanstack/react-query'
import apiClient from './index'

const KEYS = {
  stats: ['dashboard', 'stats'],
  activity: (limit) => ['dashboard', 'activity', limit],
  commits: (days) => ['dashboard', 'commits', days],
}

const fetchStats = async () => {
  return apiClient.get('/dashboard/stats')
}

const fetchActivity = async (limit = 10) => {
  return await apiClient.get(`/activity?limit=${limit}`)
}

const fetchCommitActivity = async (days = 7) => {
  return apiClient.get(`/dashboard/commits-chart?days=${days}`)
}

export const useDashboardStats = () =>
  useQuery({
    queryKey: KEYS.stats,
    queryFn: fetchStats,
    staleTime: 30_000,
  })

export const useActivity = (limit = 10) =>
  useQuery({
    queryKey: KEYS.activity(limit),
    queryFn: () => fetchActivity(limit),
    select: (res) => {
      if (!res) return []
      if (Array.isArray(res)) return res
      return res.activity || res.data || res.commits || res.items || []
    },
    staleTime: 10_000,
    gcTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

export const useCommitActivity = (days = 7) =>
  useQuery({
    queryKey: KEYS.commits(days),
    queryFn: () => fetchCommitActivity(days),
    select: (res) => {
      if (!res) return []
      const raw = Array.isArray(res)
        ? res
        : (res.data || res.commits || res.items || [])
      return raw.map(item => {
        const rawDate =
          item.date ||
          item.day ||
          item.created_at ||
          item.timestamp
        return {
          date: rawDate || null,
          count: item.count ?? item.commits ?? item.value ?? 0,
        }
      })
    },
    staleTime: 20_000,
  })