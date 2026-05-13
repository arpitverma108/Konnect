import { useParams } from 'react-router-dom'
import {
  Card,
  Typography,
  Spin,
  Alert,
  Divider,
  Collapse,
} from 'antd'

import { useQuery } from '@tanstack/react-query'
import apiClient from '../api'

const { Title, Text, Paragraph } =
  Typography

const { Panel } = Collapse

const MAX_LINES_RENDERED =
  5000

const CommitDetailPage = () => {

  const {
    id,
    revision,
  } = useParams()

  const {
    data,
    isLoading: loading,
    isError: error,
  } = useQuery({

    queryKey: [
      'commit',
      id,
      revision,
    ],

    queryFn: async () => {

      const res =
        await apiClient.get(
          `/repositories/${id}/commits/${revision}`
        )

      return res?.data || res
    },

    enabled:
      !!id && !!revision,

    staleTime:
      Infinity,
  })

  const splitDiffByFiles = (
    diffText
  ) => {

    if (!diffText) {
      return []
    }

    return diffText
      .split(/^Index: /gm)
      .filter(Boolean)
      .map((part) => {

        const fullText =
          'Index: ' + part

        const file =
          fullText
            .split('\n')[0]
            .replace(
              'Index: ',
              ''
            )
            .trim()

        return {
          file,
          content:
            fullText,
        }
      })
  }

  const renderDiff = (
    diffText
  ) => {

    const lines =
      String(diffText)
        .split('\n')

    const safeLines =
      lines.slice(
        0,
        MAX_LINES_RENDERED
      )

    return (
      <>

        {safeLines.map(
          (
            line,
            index
          ) => {

            const trimmed =
              line.trim()

            const style = {
              fontFamily:
                'monospace',

              fontSize: 13,

              padding:
                '3px 10px',

              whiteSpace:
                'pre-wrap',

              color:
                trimmed.startsWith(
                  '+'
                ) &&
                !trimmed.startsWith(
                  '+++'
                )
                  ? '#3fb950'

                  : trimmed.startsWith(
                      '-'
                    ) &&
                    !trimmed.startsWith(
                      '---'
                    )
                  ? '#f85149'

                  : trimmed.startsWith(
                      '@@'
                    )
                  ? '#d2a8ff'

                  : '#c9d1d9',

              background:
                trimmed.startsWith(
                  '+'
                ) &&
                !trimmed.startsWith(
                  '+++'
                )
                  ? 'rgba(46,160,67,0.2)'

                  : trimmed.startsWith(
                      '-'
                    ) &&
                    !trimmed.startsWith(
                      '---'
                    )
                  ? 'rgba(248,81,73,0.2)'

                  : 'transparent',

              fontWeight:
                trimmed.startsWith(
                  '@@'
                )
                  ? 'bold'
                  : 'normal',
            }

            return (
              <div
                key={index}
                style={style}
              >
                {line || ' '}
              </div>
            )
          }
        )}

        {lines.length >
          MAX_LINES_RENDERED && (

          <div
            style={{
              padding: 10,
              color: '#faad14',
              fontSize: 12,
            }}
          >
            Diff truncated
            due to size
          </div>
        )}
      </>
    )
  }

  if (loading) {

    return (
      <div
        style={{
          display: 'flex',
          justifyContent:
            'center',

          padding: 60,
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (
    error ||
    !data
  ) {

    return (
      <Alert
        type="error"
        message="Failed to load commit details"
        showIcon
      />
    )
  }

  const files =
    splitDiffByFiles(
      data.diff
    )

  return (
    <div
      style={{
        padding: 24,
      }}
    >

      <Card
        style={{
          marginBottom: 20,
        }}
      >

        <Title level={3}>
          Revision r
          {data.revision}
        </Title>

        <Paragraph>
          <Text strong>
            Author:
          </Text>{' '}
          {data.author}
        </Paragraph>

        <Paragraph>
          <Text strong>
            Date:
          </Text>{' '}

          {data.date
            ? new Date(
                data.date
              ).toLocaleString()
            : 'N/A'}
        </Paragraph>

        <Paragraph>
          <Text strong>
            Message:
          </Text>
        </Paragraph>

        <Paragraph>
          {data.message ||
            'No commit message'}
        </Paragraph>

      </Card>

      <Card>

        <Title level={4}>
          Changes
        </Title>

        <Divider />

        {!data.diff && (

          <Text type="secondary">
            No diff available
          </Text>
        )}

        {files.length > 0 && (

          <Collapse accordion>

            {files.map(
              (
                file,
                idx
              ) => (

                <Panel
                  key={idx}
                  header={
                    file.file
                  }
                >

                  <div
                    style={{
                      background:
                        '#0d1117',

                      border:
                        '1px solid #30363d',

                      borderRadius:
                        6,

                      overflow:
                        'auto',

                      maxHeight:
                        500,
                    }}
                  >
                    {renderDiff(
                      file.content
                    )}
                  </div>

                </Panel>
              )
            )}

          </Collapse>
        )}

      </Card>

    </div>
  )
}

export default CommitDetailPage