import {Alert} from 'antd'

const PageError=({
  message='Something went wrong',
})=>(
  <div style={{padding:24}}>
    <Alert
      type="error"
      message={message}
      showIcon
    />
  </div>
)

export default PageError