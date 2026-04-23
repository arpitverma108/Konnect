import { useQuery } from '@tanstack/react-query'
import apiClient from './index'

// ─── Query Keys (centralized for consistency) ──────────────────────────────────

const KEYS = {
  stats: ['dashboard', 'stats'],
  activity: (limit) => ['dashboard', 'activity', limit],
  commits: (days) => ['dashboard', 'commits', days],
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

const fetchStats = async () => {
  const res = await apiClient.get('/dashboard/stats')
  return res
}

const fetchActivity = async (limit = 10) => {
  const res = await apiClient.get(`/activity?limit=${limit}`)
  return res
}

const fetchCommitActivity = async (days = 7) => {
  const res = await apiClient.get(`/dashboard/commits-chart?days=${days}`)
  return res
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useDashboardStats = () =>
  useQuery({
    queryKey: KEYS.stats,
    queryFn: fetchStats,
    refetchInterval: 30_000,
    staleTime: 10_000, // reduces unnecessary refetch
  })

export const useActivity = (limit = 10) =>
  useQuery({
    queryKey: KEYS.activity(limit),
    queryFn: () => fetchActivity(limit),
    refetchInterval: 15_000,
    staleTime: 5_000,
  })

export const useCommitActivity = (days = 7) =>
  useQuery({
    queryKey: KEYS.commits(days),
    queryFn: () => fetchCommitActivity(days),
    refetchInterval: 60_000,
    staleTime: 20_000,
  })

  import { fakeApi } from './client'

export const getDashboardStats = () => {
  return fakeApi({
    repositories: 13,
    users: 76,
    groups: 3,
    commitsToday: 68,
  })
}

export const getRecentCommits = () => {
  return fakeApi([
    {
      id: 1,
      repo: 'frontend-app',
      message: 'Fixed login bug',
      author: 'Kunal',
      time: new Date(),
    },
    {
      id: 2,
      repo: 'backend-api',
      message: 'Added auth middleware',
      author: 'Rahul',
      time: new Date(),
    },
  ])
}