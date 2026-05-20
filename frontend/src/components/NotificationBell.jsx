
import React from 'react'
import {
  Badge,
  Dropdown,
  List,
  Typography,
  message,
  Spin,
} from 'antd'

import { Bell } from 'lucide-react'

import {
  useNotifications,
  useNotificationCount,
} from '../api/notifications'
import { useMe } from '../api/users'

import { useNavigate } from 'react-router-dom'

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import useFormattedActivity from '../hooks/useFormattedActivity'
import useRole from '../hooks/useRole'
import EmptyState from './common/EmptyState'

dayjs.extend(relativeTime)

const { Text } = Typography

const NotificationBell = () => {

  const navigate = useNavigate()

  const { data: me } =
    useMe()

  const { isAdmin } =
    useRole(me)

  const {
  data:notificationsRes,
  isLoading:notificationsLoading,
}=useNotifications(
  {limit:10},
  {
    enabled:!!me && isAdmin,
  }
)

const {
  data:countRes,
}=useNotificationCount({
  enabled:!!me && isAdmin,
})

const notifications=
  Array.isArray(notificationsRes?.list)
    ?notificationsRes.list
    :[]

 const formattedLogs=
  useFormattedActivity(
    notifications
  )

  const prevCountRef =
    React.useRef(0)

  React.useEffect(() => {

    if (
      !isAdmin ||
      !formattedLogs.length
    ) {
      return
    }

    const prev =
      prevCountRef.current

    if (
      prev !== 0 &&
      formattedLogs.length > prev
    ) {

      const newItems =
        formattedLogs.slice(
          0,
          formattedLogs.length - prev
        )

      if (newItems.length > 0) {

        message.info({
          content:
            `${newItems.length} new notification(s)`,

          duration: 3,
        })
      }
    }

    prevCountRef.current =
      formattedLogs.length

  }, [formattedLogs, isAdmin])

  if (!isAdmin) {
    return null
  }

  const handleClick = (
    action
  ) => {

    const repoMatch =
      action.match(
        /repo[:\s]+(\d+)/
      )

    if (repoMatch) {

      navigate(
        `/repositories/${repoMatch[1]}`
      )

      return
    }

    if (
      action.includes('user')
    ) {
      navigate('/users')
    }
  }

  const latestLogs =
    formattedLogs.slice(0, 10)

 const unreadCount=
  countRes?.count
  ??
  countRes?.data?.count
  ??
  0

  const dropdownContent = (
    <div
      style={{
        width: 320,
        background: '#161b22',
        border:
          '1px solid #30363d',

        borderRadius: 8,

        padding: 8,

        boxShadow:
          '0 8px 24px rgba(0,0,0,0.6)',
      }}
    >

      {notificationsLoading ? (

        <div
          style={{
            textAlign:'center',
            padding:24,
          }}
        >
          <Spin/>
        </div>

      ) : latestLogs.length === 0 ? (

        <EmptyState title="No notifications"/>

      ) : (

        <List
          dataSource={latestLogs}

          renderItem={(item) => (

            <List.Item
              onClick={() =>
                handleClick(
                  item.rawAction
                )
              }

              style={{
                background:
                  '#0d1117',

                borderRadius: 6,

                marginBottom: 6,

                padding:
                  '8px 10px',

                cursor: 'pointer',
              }}
            >

              <Text
                style={{
                  color: '#e6edf3',
                }}
              >
                {item.message}
              </Text>

            </List.Item>
          )}
        />
      )}

    </div>
  )

  return (
    <Dropdown
      trigger={['click']}

      popupRender={() =>
        dropdownContent
      }

    >

      <Badge count={unreadCount}>
        <Bell size={18} />
      </Badge>

    </Dropdown>
  )
}

export default NotificationBell
