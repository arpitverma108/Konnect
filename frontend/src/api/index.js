
import axios from 'axios'
import { message } from 'antd'
import { config } from '../config'
import useAppStore from '../store'
import {queryClient} from '../lib/queryClient'
const apiClient = axios.create({
  baseURL: config.apiUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })

  failedQueue = []
}

apiClient.interceptors.response.use(
  (res) => res.data,

  async (error) => {
    const originalRequest = error.config
    const token = localStorage.getItem('token')

    if (!token) {
      return Promise.reject(error)
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh')
    ) {
      originalRequest._retry = true

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return apiClient(originalRequest)
        })
      }

      isRefreshing = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')

        if (!refreshToken) {
          queryClient.clear()

useAppStore
  .getState()
  .logout()

window.location.replace('/login')

          return Promise.reject(error)
        }

        const refreshResponse = await apiClient.post('/auth/refresh', {
          refreshToken,
        })

        const newToken =
          refreshResponse?.accessToken ||
          refreshResponse?.token

        if (!newToken) {
          throw new Error('Invalid refresh response')
        }

        localStorage.setItem('token', newToken)

        apiClient.defaults.headers.common.Authorization =
          `Bearer ${newToken}`

        processQueue(null, newToken)

        originalRequest.headers.Authorization =
          `Bearer ${newToken}`

        return apiClient(originalRequest)

      } catch (err) {
        processQueue(err, null)

        queryClient.clear()

useAppStore
  .getState()
  .logout()

window.location.replace('/login')

        return Promise.reject(err)

      } finally {
        isRefreshing = false
      }
    }

    const status = error.response?.status
    const backendMsg = error.response?.data?.error
    const fallbackMsg =
      error.message || 'Something went wrong'

    let finalMessage = fallbackMsg

    switch (status) {
      case 400:
        finalMessage =
          backendMsg || 'Bad request'
        break

      case 403:
        return Promise.reject(error)

      case 404:
        finalMessage = 'Resource not found'
        break

      case 500:
        finalMessage =
          'Server error. Please try again later'
        break

      default:
        finalMessage =
          backendMsg || fallbackMsg
    }

    if (!originalRequest._handledError) {
      message.error(finalMessage)
      originalRequest._handledError = true
    }

    return Promise.reject(error)
  }
)

export default apiClient