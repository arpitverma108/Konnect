// PathPermissions.jsx
import React, { useState, useEffect } from 'react'
import { Tree, Spin } from 'antd'
import { useRepoLs } from '../../api/repositories'

const { DirectoryTree } = Tree

const PathPermissions = ({ repoId, selectedPath, onSelectPath }) => {
  const [treeData, setTreeData] = useState([
    { title: '/', key: '/', isLeaf: false }
  ])

  const { data: rootPaths, isLoading } = useRepoLs(repoId, '/')

  useEffect(() => {
    if (rootPaths) {
      const children = rootPaths.map(p => ({
        title: p.name,
        key: p.path,
        isLeaf: p.type !== 'dir'
      }))
      setTreeData([{ 
        title: '/', 
        key: '/', 
        children,
        isLeaf: false 
      }])
    }
  }, [rootPaths])

  const onLoadData = async ({ key, children }) => {
    if (children) return;
    
    try {
      // Need to fetch children for this specific path
      // Since this is inside a component, we can't call the hook directly in an async function.
      // However, we can use the queryClient or a manual fetch.
      // For simplicity in this implementation, we'll assume the top level 
      // is enough for most authz cases, OR we'll implement a simple fetcher.
      
      const response = await fetch(`/api/repositories/${repoId}/ls?path=${key}`);
      const data = await response.json();
      
      const newChildren = data.map(p => ({
        title: p.name,
        key: p.path,
        isLeaf: p.type !== 'dir'
      }));

      setTreeData(origin =>
        updateTreeData(origin, key, newChildren)
      );
    } catch (err) {
      console.error('Failed to load sub-paths:', err);
    }
  }

  const updateTreeData = (list, key, children) =>
    list.map((node) => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateTreeData(node.children, key, children) };
      }
      return node;
    });

  const onSelect = (keys) => {
    if (keys.length > 0) {
      onSelectPath(keys[0])
    }
  }

  if (isLoading && treeData[0].key === '/' && !treeData[0].children) {
    return <div style={{ padding: 20, textAlign: 'center' }}><Spin size="small" /></div>
  }

  return (
    <DirectoryTree
      loadData={onLoadData}
      multiple={false}
      onSelect={onSelect}
      selectedKeys={[selectedPath]}
      treeData={treeData}
      className="premium-tree"
      style={{
        background: 'transparent',
        color: 'var(--text-main)'
      }}
    />
  )
}

export default PathPermissions
