import React from 'react'
import { Result, Button } from 'antd'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('🔥 App crashed:', error, errorInfo)

    // 👉 Later you can send this to Sentry
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="500"
          title="Something went wrong"
          subTitle="An unexpected error occurred."
          extra={
            <Button type="primary" onClick={this.handleReload}>
              Reload App
            </Button>
          }
        />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary