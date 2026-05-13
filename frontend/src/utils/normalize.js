export const normalizeList=(res)=>{

  if(!res)return[]

  if(Array.isArray(res)){
    return res
  }

  if(Array.isArray(res.data)){
    return res.data
  }

  if(Array.isArray(res.list)){
    return res.list
  }

  if(Array.isArray(res.logs)){
    return res.logs
  }

  if(Array.isArray(res.items)){
    return res.items
  }

  if(Array.isArray(res.tree)){
    return res.tree
  }

  if(Array.isArray(res.repositories)){
    return res.repositories
  }

  if(Array.isArray(res.permissions)){
    return res.permissions
  }

  return[]
}

export const normalizeObject=(res)=>{
  if(!res)return null
  return res.data||res
}

export const normalizePaginated=(res)=>{

  const list=normalizeList(res)

  return{
    list,

    total:
      res?.total
      ??
      res?.count
      ??
      list.length,
  }
}