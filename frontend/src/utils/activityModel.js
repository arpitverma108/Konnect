const eventTypeLabels={
  commit:'Commit',
  branch_create:'Branch',
  tag_create:'Tag',
  permission_update:'Permission',
  user_create:'User',
  repo_create:'Repository',
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
  tag_create:'geekblue',
  permission_update:'purple',
  permission:'purple',
  user_create:'green',
  user:'green',
  repo_create:'blue',
  repository:'blue',
  repo:'blue',
  login:'red',
  auth:'orange',
  security:'red',
  sync:'gold',
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

  if(raw.includes('branch'))return'branch_create'
  if(raw.includes('tag'))return'tag_create'
  if(raw.includes('commit'))return'commit'
  if(raw.includes('permission'))return'permission_update'
  if(raw.includes('created user')||raw.includes('user_create'))return'user_create'
  if(raw.includes('user')||raw.includes('admin'))return'user'
  if(raw.includes('group'))return'group'
  if(raw.includes('hook'))return'hook'
  if(raw.includes('login'))return'login'
  if(raw.includes('auth'))return'auth'
  if(raw.includes('sync'))return'sync'
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
    item.author
    ||
    item.actor
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
