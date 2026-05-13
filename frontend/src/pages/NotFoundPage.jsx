import React from 'react'

import {
  Result,
  Button,
} from 'antd'

import {
  useNavigate,
} from 'react-router-dom'

const NotFoundPage = () => {

  const navigate =
    useNavigate()

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >

      <Result
        status="404"
        title="404"
        subTitle="The page you are looking for does not exist."

        extra={
          <Button
            type="primary"
            onClick={() =>
              navigate('/')
            }
          >
            Back to Dashboard
          </Button>
        }
      />

    </div>
  )
}

export default NotFoundPage