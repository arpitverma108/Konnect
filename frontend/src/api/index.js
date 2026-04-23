import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Basic interceptors setup
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Optionally trigger a toast notification from here later
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export default apiClient
