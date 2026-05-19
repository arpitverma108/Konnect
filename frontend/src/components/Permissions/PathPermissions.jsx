import React, { useMemo, useState } from 'react'
import { Tree, Spin, Input, Typography } from 'antd'
import { useRepoFilesByPath } from '../../api/repositories' // ✅ FIXED HOOK

const { DirectoryTree } = Tree
const { Text } = Typography

const PathPermissions = ({ repoId, selectedPath, onSelectPath }) => {

  // ✅ USE NEW TREE (already working in RepoDetail)
  const { data: tree = [], isLoading } = useRepoFilesByPath(repoId)

  const [customPath, setCustomPath] = useState(selectedPath || '/')

  // 🔥 SAFE TREE CONVERSION (recursive)
  const treeData = useMemo(() => {

    const convert = (nodes, parentPath = '') =>
      (nodes || []).map((node) => {
        const fullPath = `${parentPath}/${node.name}`.replace('//', '/')

        return {
          title: node.name,
          key: fullPath,
          children: node.children
            ? convert(node.children, fullPath)
            : [],
          isLeaf: node.type === 'file',
        }
      })

    return [
      {
        title: '/',
        key: '/',
        children: convert(tree),
      },
    ]

  }, [tree])

  const onSelect = (keys) => {
    if (keys.length > 0) {
      onSelectPath(keys[0])
      setCustomPath(keys[0])
    }
  }

  if (isLoading) return <Spin />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <DirectoryTree
        onSelect={onSelect}
        selectedKeys={[selectedPath]}
        treeData={treeData}
      />

      <div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
          Or enter a custom path
        </Text>

        <Input
          value={customPath}
          placeholder="/trunk/src"
          onChange={(e) => setCustomPath(e.target.value)}
          onPressEnter={() => onSelectPath(customPath || '/')}
        />
      </div>
    </div>
  )
}

export default PathPermissions