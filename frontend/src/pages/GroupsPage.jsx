
import React, { useState } from 'react'

import {
  Table,
  Tag,
  Space,
  Button,
  Typography,
  Popconfirm,
  message,
  Input,
} from 'antd'
import {
  Plus,
  Download,
  Users,
  Search,
  Trash2,
  Settings,
} from 'lucide-react'

import {
  useGroups,
  useDeleteGroup,
} from '../api/groups'

import CreateGroupModal from '../components/Groups/CreateGroupModal'
import ManageMembersModal from '../components/Groups/ManageMembersModal'

import {
  normalizePaginated,
} from '../utils/normalize'

import PageLoader from '../components/common/PageLoader'
import PageError from '../components/common/PageError'
import BulkActionBar from '../components/common/BulkActionBar'
import useTableSelection from '../hooks/useTableSelection'
import {downloadCsv} from '../utils/exportCsv'
import useDebouncedValue from '../hooks/useDebouncedValue'

const { Title, Text } = Typography

const GroupsPage = () => {
  const [searchTerm,setSearchTerm]=
    useState('')

  const [page,setPage]=
    useState(1)

  const [limit]=
    useState(10)

  const debouncedSearch=
    useDebouncedValue(searchTerm,350)

  const {
    data: groupsResponse,
    isLoading,
    isFetching,
    isError,
  } = useGroups({
    page,
    limit,
    search:debouncedSearch.trim(),
  })

  const {
    list:groups,
    total,
  }=normalizePaginated(groupsResponse)

  const {
    selectedRowKeys,
    selectedCount,
    rowSelection,
    clearSelection,
  }=useTableSelection()

  const deleteMutation =
    useDeleteGroup()

  const [
    createModalVisible,
    setCreateModalVisible,
  ] = useState(false)

  const [
    managingGroup,
    setManagingGroup,
  ] = useState(null)

  const handleDelete = (group) => {

    deleteMutation.mutate(
      group.id,
      {
        onSuccess: () => {
          message.success(
            `Group "@${group.name}" deleted`
          )
        },

        onError: () => {
          message.error(
            'Failed to delete group'
          )
        },
      }
    )
  }

  const selectedGroups=
    groups.filter((group)=>
      selectedRowKeys.includes(group.id)
    )

  const exportGroups=(rows,filename)=>
    downloadCsv({
      filename,
      rows,
      columns:[
        {header:'Group Name',value:'name'},
        {header:'Description',value:'description'},
        {header:'Members',value:'member_count'},
      ],
    })

  const columns = [
    {
      title: 'Group Name',

      dataIndex: 'name',

      key: 'name',

      render: (text) => (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Tag color="cyan">
            @{text}
          </Tag>
        </span>
      ),
    },

    {
      title: 'Description',

      dataIndex: 'description',

      key: 'description',

      render: (d) =>
        d
        ||
        <Text type="secondary">
          —
        </Text>,
    },

    {
      title: 'Members',

      dataIndex: 'member_count',

      key: 'member_count',

      render: (count, record) => (
        <span
          onClick={() =>
            setManagingGroup(record)
          }

          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}

          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.8'
          }}

          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
        >

          <Users
            size={14}
            color="var(--text-muted)"
          />

          <Text type="secondary">
            {count ?? '–'}
          </Text>

        </span>
      ),
    },

    {
      title: 'Action',

      key: 'action',

      align: 'right',

      render: (_, record) => (
        <Space>

          <Button
            type="link"
            icon={<Settings size={14} />}

            onClick={() =>
              setManagingGroup(record)
            }
          >
            Manage Members
          </Button>

          <Popconfirm
            title={`Delete @${record.name}?`}

            description="This will remove the group from all permission rules."

            onConfirm={() =>
              handleDelete(record)
            }

            okText="Delete"

            okButtonProps={{
              danger: true,
            }}

            placement="left"
          >

            <Button
              type="text"
              danger

              icon={<Trash2 size={14} />}

              loading={
                deleteMutation.isPending
              }
            />

          </Popconfirm>

        </Space>
      ),
    },
  ]

  if (isLoading) {
    return <PageLoader />
  }

  if (isError) {
    return (
      <PageError message="Failed to load groups" />
    )
  }

  return (
    <div
      className="groups-container"
      style={{ paddingBottom: 24 }}
    >

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >

        <div>

          <Title
            level={2}
            style={{ margin: 0 }}
          >
            Groups Management
          </Title>

          <Text type="secondary">
            Define groups to assign permissions globally.
          </Text>

        </div>

        <Button
          type="primary"

          icon={<Plus size={16} />}

          onClick={() =>
            setCreateModalVisible(true)
          }

          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          Create Group
        </Button>

      </div>

      <div
        className="glass-panel"
        style={{
          padding: '24px',
          minHeight: '60vh',
        }}
      >

        <Input
          placeholder="Search groups..."
          prefix={<Search size={18} />}
          value={searchTerm}
          onChange={(e)=>{
            setSearchTerm(e.target.value)
            setPage(1)
          }}
          style={{
            maxWidth:300,
            marginBottom:12,
          }}
        />

        <div style={{ marginBottom: 12 }}>
          <Button
            icon={<Download size={16} />}
            onClick={() =>
              exportGroups(
                groups,
                'groups.csv'
              )
            }
          >
            Export
          </Button>
        </div>

        <BulkActionBar
          selectedCount={selectedCount}
          onClear={clearSelection}
          actions={
            <Button
              icon={<Download size={16} />}
              onClick={() =>
                exportGroups(
                  selectedGroups,
                  'groups-selected.csv'
                )
              }
            >
              Export Selected
            </Button>
          }
        />

        <Table
          columns={columns}

          dataSource={groups}

          rowKey="id"
          rowSelection={rowSelection}

          pagination={{
            current:page,
            pageSize:limit,
            total,
            showSizeChanger:false,
            onChange:setPage,
          }}

          loading={isFetching}

          rowClassName={() =>
            'premium-table-row'
          }

          locale={{
            emptyText:
              'No groups yet. Create one!',
          }}
        />

      </div>

      <CreateGroupModal
        visible={createModalVisible}

        onClose={() =>
          setCreateModalVisible(false)
        }
      />

      <ManageMembersModal
        group={managingGroup}

        onClose={() =>
          setManagingGroup(null)
        }
      />

    </div>
  )
}

export default GroupsPage
