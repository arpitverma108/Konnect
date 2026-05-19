export const cleanQueryParams=(params={})=>
  Object.entries(params)
    .reduce((acc,[key,value])=>{
      if(
        value===undefined
        ||
        value===null
        ||
        value===''
      ){
        return acc
      }

      if(
        Array.isArray(value)
        &&
        value.length===0
      ){
        return acc
      }

      acc[key]=value
      return acc
    },{})
