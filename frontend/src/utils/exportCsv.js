const escapeCsvValue=(value)=>{
  if(value===undefined||value===null){
    return ''
  }

  const text=String(value)

  if(/[",\n\r]/.test(text)){
    return `"${text.replaceAll('"','""')}"`
  }

  return text
}

export const buildCsv=(rows=[],columns=[])=>{
  const header=columns
    .map((column)=>escapeCsvValue(column.header))
    .join(',')

  const body=rows
    .map((row)=>
      columns
        .map((column)=>
          escapeCsvValue(
            typeof column.value==='function'
              ?column.value(row)
              :row?.[column.value]
          )
        )
        .join(',')
    )
    .join('\n')

  return [
    header,
    body,
  ]
    .filter(Boolean)
    .join('\n')
}

export const downloadCsv=({
  filename,
  rows=[],
  columns=[],
})=>{
  const csv=buildCsv(rows,columns)
  const blob=new Blob(
    [csv],
    {
      type:'text/csv;charset=utf-8;',
    }
  )

  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')

  link.href=url
  link.download=filename
  link.click()

  URL.revokeObjectURL(url)
}
