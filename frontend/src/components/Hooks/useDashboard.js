import { useEffect, useState } from 'react'
import { getDashboardStats, getRecentCommits } from '../api/dashboard'

export const useDashboard = () => {
  const [stats, setStats] = useState(null)
  const [commits, setCommits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const statsData = await getDashboardStats()
      const commitData = await getRecentCommits()

      setStats(statsData)
      setCommits(commitData)
      setLoading(false)
    }

    fetchData()
  }, [])

  return { stats, commits, loading }
}