import { useQuery } from '@tanstack/react-query'
import apiClient from './index'
import {queryKeys} from '../lib/queryKeys'
import {staleTimes} from '../lib/queryConfig'

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
    queryKey: queryKeys.dashboard.stats,
    queryFn: fetchStats,
    staleTime: staleTimes.short,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  })

export const useDashboardActivity = (
  limit = 10,
  options = {}
) =>
  useQuery({
    queryKey: queryKeys.dashboard.activity(limit),
    queryFn: () => fetchActivity(limit),
    enabled: options.enabled ?? true,
    select: (res) => {
      if (!res) return []
      if (Array.isArray(res)) return res
      return res.activity || res.data || res.commits || res.items || []
    },
    staleTime: staleTimes.realtime,
    refetchInterval: 15000,
    gcTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

export const useCommitActivity = (days = 7) =>
  useQuery({
    queryKey: queryKeys.dashboard.commits(days),
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
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  })
