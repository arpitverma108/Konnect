import { useEffect, useState } from 'react'
import { getActivity } from '../api/activity'

export const useActivity = () => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getActivity().then(res => {
      setData(res)
      setLoading(false)
    })
  }, [])

  return { data, loading }
}