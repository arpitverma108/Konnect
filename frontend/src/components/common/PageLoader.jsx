import {Skeleton} from 'antd'

const PageLoader=()=>(
  <div
    style={{
      maxWidth:1200,
      margin:'0 auto',
      padding:24,
    }}
  >
    <Skeleton
      active
      title={{width:220}}
      paragraph={{rows:12}}
    />
  </div>
)

export default PageLoader