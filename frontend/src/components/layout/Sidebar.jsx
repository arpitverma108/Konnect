

// export default Sidebar
import {useLocation,useNavigate} from 'react-router-dom'
import {Layout,Menu,Spin} from 'antd'
import {
  LayoutDashboard,
  GitBranch,
  Users,
  ShieldAlert,
  Webhook,
  FolderTree,
  Settings2,
} from 'lucide-react'
import {Activity,FileText} from 'lucide-react'

import useAppStore from '../../store'
import {useMe} from '../../api/users'
import useRole from '../../hooks/useRole'
import {logout} from '../../utils/logout'

const {Sider}=Layout

const Sidebar=({isMobile})=>{

  const navigate=useNavigate()
  const location=useLocation()

  const {
    sidebarCollapsed,
    toggleSidebar,
  }=useAppStore()

  const activeKey=
    location.pathname.split('/')[1]
    ||
    'dashboard'

  const {
    data:me,
    isLoading,
  }=useMe()

  const {
    isAdmin,
    isSuperAdmin,
  }=useRole(me)

  const handleLogout=()=>{
    logout(navigate)
  }

  if(isLoading){
    return(
      <Sider width={isMobile?0:240}>
        <Spin/>
      </Sider>
    )
  }

  const items=[
    {key:'dashboard',icon:<LayoutDashboard size={18}/>,label:'Dashboard'},
    {key:'repositories',icon:<GitBranch size={18}/>,label:'Repositories'},

    ...(isAdmin?[
      {key:'users',icon:<Users size={18}/>,label:'Users'},
      {key:'groups',icon:<FolderTree size={18}/>,label:'Groups'},
    ]:[]),

    ...(isSuperAdmin?[
      {key:'permissions',icon:<ShieldAlert size={18}/>,label:'Permissions'},
    ]:[]),

    ...(isAdmin?[
      {key:'hooks',icon:<Webhook size={18}/>,label:'Hooks'},
    ]:[]),

    {type:'divider'},

    {key:'activity',icon:<Activity size={18}/>,label:'Activity'},
    {key:'audit-logs',icon:<FileText size={18}/>,label:'Audit Logs'},
    {key:'settings',icon:<Settings2 size={18}/>,label:'Settings'},

    {
      key:'logout',
      label:(
        <span style={{color:'#ff4d4f',fontWeight:500}}>
          Logout
        </span>
      ),
      onClick:handleLogout,
    },
  ]

  return(
    <Sider
      collapsible
      collapsed={isMobile||sidebarCollapsed}
      onCollapse={toggleSidebar}
      theme="dark"
      width={240}
      style={{height:'100%'}}
    >

      <div
        style={{
          height:64,
          display:'flex',
          alignItems:'center',
          justifyContent:sidebarCollapsed?'center':'flex-start',
          padding:sidebarCollapsed?0:'0 20px',
          fontSize:20,
          fontWeight:600,
          color:'#fff',
          borderBottom:'1px solid #30363d',
          letterSpacing:1,
        }}
      >
        {sidebarCollapsed?'K':'Konnect'}
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[activeKey]}
        onClick={({key})=>
          key!=='logout'&&navigate(`/${key}`)
        }
        items={items}
      />

    </Sider>
  )
}

export default Sidebar