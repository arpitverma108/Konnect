

import React, { useState,} from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Spin, Alert, Button, Tag, Typography, Modal, message } from 'antd'
import { ArrowLeft, FolderGit2 } from 'lucide-react'
import {
  useRepository,
  useDeleteRepository,
  useSyncActivity   // 🔥 ADD THIS
} from '../api/repositories'

import RepoDetail from '../components/Repository/RepoDetail'
import CreateRepoModal from '../components/Repository/CreateRepoModal'

const { Title } = Typography

const RepoDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: repo, isLoading, isError, refetch } = useRepository(id)
  const deleteMutation = useDeleteRepository()
  const syncMutation = useSyncActivity()   // 🔥 ADD THIS

  const [editVisible, setEditVisible] = useState(false)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (isError || !repo) {
    return (
      <Alert
        type="error"
        message="Repository not found"
        showIcon
        style={{ margin: 24 }}
      />
    )
  }

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Repository?',
      content: `Are you sure you want to delete "${repo.name}"? This cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMutation.mutateAsync(repo.id)
          message.success({
            content: 'Repository deleted successfully',
            duration: 2
          })
          navigate('/repositories')
        } catch (err) {
          message.error({
            content: err?.response?.data?.error || 'Failed to delete repository',
            duration: 3
          })
        }
      }
    })
  }

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* HEADER */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 24,
        gap: 16
      }}>

        <Button
          type="text"
          icon={<ArrowLeft size={20} />}
          onClick={() => navigate('/repositories')}
        />

        <FolderGit2 size={24} color="#1890ff" />

        <Title level={2} style={{ margin: 0 }}>
          {repo.name}
          <Tag
            color={repo.is_active ? 'success' : 'error'}
            style={{ marginLeft: 10 }}
          >
            {repo.is_active ? 'Active' : 'Inactive'}
          </Tag>
        </Title>

        {/* 🔥 ACTIONS */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>

          {/* 🔥 SYNC BUTTON */}
          <Button
            loading={syncMutation.isPending}
            onClick={async () => {
              try {
                await syncMutation.mutateAsync()
                message.success({
                  content: 'Activity synced successfully',
                  duration: 2
                })
              } catch {
                message.error({
                  content: 'Sync failed',
                  duration: 3
                })
              }
            }}
          >
            Sync
          </Button>

          <Button onClick={() => setEditVisible(true)}>
            Edit
          </Button>

          <Button danger onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      <RepoDetail repo={repo} />

      <CreateRepoModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        editMode
        repo={repo}
        onSuccess={refetch}
      />
    </div>
  )
}

export default RepoDetailPage