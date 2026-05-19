import React from 'react'
import {Empty,Typography} from 'antd'

const {Text}=Typography

const EmptyState=({
  title='No data found',
  description,
  action,
})=>(
  <div
    style={{
      padding:'32px 16px',
      textAlign:'center',
    }}
  >
    <Empty
      description={
        <div>
          <Text>{title}</Text>

          {description&&(
            <Text
              type="secondary"
              style={{
                display:'block',
                marginTop:4,
              }}
            >
              {description}
            </Text>
          )}
        </div>
      }
    >
      {action}
    </Empty>
  </div>
)

export default EmptyState
