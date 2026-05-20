const eventTypeLabels={
  commit:'Commit',
  branch_create:'Branch',
  branch_delete:'Branch',
  tag_create:'Tag',
  tag_delete:'Tag',
  repo_init:'Repository',
  permission_update:'Permission',
  permission_delete:'Permission',
  user_create:'User',
  user_delete:'User',
  user_role_change:'User',
  user_password_change:'User',
  repo_create:'Repository',
  repo_update:'Repository',
  repo_delete:'Repository',
  sync_run:'Sync',
  auth_login:'Authentication',
  auth_logout:'Authentication',
  login:'Security',
  sync:'Sync',
  repository:'Repository',
  repo:'Repository',
  permission:'Permission',
  user:'User',
  group:'Group',
  hook:'Hook',
  auth:'Authentication',
  system:'System',
}

export const eventTypeColors={
  commit:'blue',
  branch_create:'cyan',
  branch_delete:'orange',
  tag_create:'geekblue',
  tag_delete:'orange',
  repo_init:'blue',
  permission_update:'purple',
  permission_delete:'volcano',
  permission:'purple',
  user_create:'green',
  user_delete:'volcano',
  user_role_change:'orange',
  user_password_change:'cyan',
  user:'green',
  repo_create:'blue',
  repo_update:'cyan',
  repo_delete:'volcano',
  repository:'blue',
  repo:'blue',
  auth_login:'green',
  auth_logout:'orange',
  login:'red',
  auth:'orange',
  security:'red',
  sync:'gold',
  sync_run:'gold',
  group:'green',
  hook:'magenta',
  system:'default',
}

export const getEventTypeLabel=(eventType='system')=>
  eventTypeLabels[eventType]
  ||
  eventType
    .split('_')
    .map((part)=>
      part.charAt(0).toUpperCase()+part.slice(1)
    )
    .join(' ')

export const getEventTypeColor=(eventType='system')=>
  eventTypeColors[eventType] || 'default'

const inferEventType=(item={})=>{
  const raw=[
    item.event_type,
    item.type,
    item.action_type,
    item.category,
    item.action,
    item.message,
    item.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if(raw.includes('delete branch')||raw.includes('branch_delete'))return'branch_delete'
  if(raw.includes('branch'))return'branch_create'
  if(raw.includes('delete tag')||raw.includes('tag_delete'))return'tag_delete'
  if(raw.includes('tag'))return'tag_create'
  if(raw.includes('commit'))return'commit'
  if(raw.includes('permission_delete'))return'permission_delete'
  if(raw.includes('permission'))return'permission_update'
  if(raw.includes('created user')||raw.includes('user_create'))return'user_create'
  if(raw.includes('delete user')||raw.includes('user_delete'))return'user_delete'
  if(raw.includes('password'))return'user_password_change'
  if(raw.includes('role'))return'user_role_change'
  if(raw.includes('user')||raw.includes('admin'))return'user'
  if(raw.includes('group'))return'group'
  if(raw.includes('hook'))return'hook'
  if(raw.includes('logout')||raw.includes('auth_logout'))return'auth_logout'
  if(raw.includes('login')||raw.includes('auth_login'))return'auth_login'
  if(raw.includes('auth'))return'auth'
  if(raw.includes('sync'))return'sync_run'
  if(raw.includes('repo_init'))return'repo_init'
  if(raw.includes('delete repository')||raw.includes('repo_delete'))return'repo_delete'
  if(raw.includes('update repository')||raw.includes('repo_update'))return'repo_update'
  if(raw.includes('created repository')||raw.includes('repo_create'))return'repo_create'
  if(raw.includes('repository')||raw.includes('repo'))return'repository'

  return'system'
}

export const normalizeActivityEvent=(item={})=>{
  const eventType=
    item.event_type
    ||
    item.type
    ||
    inferEventType(item)

  const normalizedType=
    String(eventType).toLowerCase()

  const action=
    item.action
    ||
    item.description
    ||
    item.message
    ||
    'System activity'

  const repo=
    item.repo_name
    ||
    item.repo
    ||
    item.repository
    ||
    item.repository_name
    ||
    item.context
    ||
    ''

  const actor=
    item.actor
    ||
    item.author
    ||
    item.user
    ||
    item.admin
    ||
    ''

  return{
    ...item,
    id:
      item.id
      ||
      item.audit_id
      ||
      item.revision
      ||
      item.created_at
      ||
      item.committed_at,
    eventType:normalizedType,
    event_type:normalizedType,
    eventLabel:
      getEventTypeLabel(normalizedType),
    eventColor:
      getEventTypeColor(normalizedType),
    action,
    repo_name:repo,
    repoName:repo,
    actor,
    created_at:
      item.created_at
      ||
      item.committed_at
      ||
      item.timestamp,
    message:
      item.message
      ||
      (
        repo
          ?`[${repo}] ${action}`
          :action
      ),
    time:
      item.created_at
      ||
      item.committed_at
      ||
      item.timestamp
      ||
      new Date(),
  }
}
