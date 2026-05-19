import React from 'react'
import {Button,Flex,Typography} from 'antd'

const {Text}=Typography

const BulkActionBar=({
  selectedCount=0,
  actions,
  onClear,
})=>{
  if(!selectedCount){
    return null
  }

  return(
    <Flex
      align="center"
      justify="space-between"
      gap={12}
      wrap="wrap"
      className="glass-panel"
      style={{
        padding:'10px 12px',
        marginBottom:12,
      }}
    >
      <Text>
        {selectedCount} selected
      </Text>

      <Flex
        gap={8}
        wrap="wrap"
      >
        {actions}

        <Button onClick={onClear}>
          Clear
        </Button>
      </Flex>
    </Flex>
  )
}

export default BulkActionBar
