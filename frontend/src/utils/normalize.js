const fallbackWarned=new Set()

const warnNormalizeFallback=(
  normalizer,
  key,
  res
)=>{
  if(import.meta.env.PROD){
    return
  }

  const warningKey=
    `${normalizer}:${key}`

  if(fallbackWarned.has(warningKey)){
    return
  }

  fallbackWarned.add(warningKey)

  console.warn(
    `[normalize] ${normalizer} used fallback key "${key}". Consider adding a resource-specific normalizer.`,
    res
  )
}

const pickArray=(res,keys,normalizer)=>{
  for(const key of keys){
    const value=res?.[key]

    if(Array.isArray(value)){
      if(key!=='data'){
        warnNormalizeFallback(
          normalizer,
          key,
          res
        )
      }

      return value
    }
  }

  return null
}

export const normalizeList=(res)=>{

  if(!res)return[]

  const raw=
    res?.data && !Array.isArray(res.data)
      ?res.data
      :res

  if(Array.isArray(raw)){
    return raw
  }

  if(Array.isArray(res)){
    return res
  }

  const keys=[
    'data',
    'list',
    'logs',
    'items',
    'activity',
    'users',
    'tree',
    'repositories',
    'permissions',
    'notifications',
    'groups',
  ]

  const rootList=
    pickArray(
      res,
      keys,
      'normalizeList'
    )

  if(rootList){
    return rootList
  }

  const nestedList=
    pickArray(
      raw,
      keys,
      'normalizeList'
    )

  if(nestedList){
    return nestedList
  }

  if(
    typeof res==='object'
    ||
    typeof raw==='object'
  ){
    warnNormalizeFallback(
      'normalizeList',
      'empty',
      res
    )
  }

  return[]
}

export const normalizeObject=(res)=>{
  if(!res)return null
  return res.data||res
}

export const createListNormalizer=({
  keys=['data'],
  name='resource',
}={})=>(res)=>{
  if(!res)return[]

  const raw=
    res?.data && !Array.isArray(res.data)
      ?res.data
      :res

  if(Array.isArray(raw)){
    return raw
  }

  const list=
    pickArray(
      raw,
      keys,
      name
    )
    ||
    pickArray(
      res,
      keys,
      name
    )

  if(list){
    return list
  }

  warnNormalizeFallback(
    name,
    'empty',
    res
  )

  return[]
}

export const createPaginatedNormalizer=(
  config={}
)=>(res)=>{
  const list=
    createListNormalizer(config)(res)

  const raw=
    res?.data && !Array.isArray(res.data)
      ?res.data
      :res

  return{
    list,
    total:
      raw?.total
      ??
      raw?.count
      ??
      res?.total
      ??
      res?.count
      ??
      list.length,
  }
}

export const normalizePaginated=(res)=>{

  const list=normalizeList(res)
  const raw=
    res?.data && !Array.isArray(res.data)
      ?res.data
      :res

  return{
    list,

    total:
      raw?.total
      ??
      raw?.count
      ??
      res?.total
      ??
      res?.count
      ??
      list.length,
  }
}
