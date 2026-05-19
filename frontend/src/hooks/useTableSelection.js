import {useMemo,useState} from 'react'

const useTableSelection=()=>{
  const [selectedRowKeys,setSelectedRowKeys]=useState([])

  const rowSelection=useMemo(()=>({
    selectedRowKeys,
    onChange:setSelectedRowKeys,
  }),[selectedRowKeys])

  const clearSelection=()=>
    setSelectedRowKeys([])

  return{
    selectedRowKeys,
    selectedCount:selectedRowKeys.length,
    rowSelection,
    clearSelection,
  }
}

export default useTableSelection
