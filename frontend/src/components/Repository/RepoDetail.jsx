import React,{useState,useEffect} from 'react'

import {
  Tabs,Table,Empty,Spin,
  Breadcrumb,Modal,Button,Input,
} from 'antd'

import {
  Folder,File,
} from 'lucide-react'

import {useNavigate} from 'react-router-dom'

import {
  useRepoFilesByPath,
  useRepoCommits,
  useFileContent,
  useCreateBranch,
  useDeleteBranch,
  useTags,
  useCreateTag,
  useDeleteTag,
} from '../../api/repositories'

import Prism from 'prismjs'

import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-markdown'

const ROOT_PREFIX='trunk'
const MAX_FILE_SIZE=200000
const RepoDetail=({repo})=>{

  const [activeTab,setActiveTab]=useState('files')
  const [path,setPath]=useState([])
  const [selectedFile,setSelectedFile]=useState(null)

  const [branchName,setBranchName]=useState('')
  const [tagName,setTagName]=useState('')

  const repoId=Number(repo?.id)

  const navigate=useNavigate()

  const {
    data:tree=[],
    isLoading:filesLoading,
  }=useRepoFilesByPath(repoId)

  const {
    data:commits=[],
    isLoading:commitsLoading,
  }=useRepoCommits(repoId)

  const {
    data:fileContent='',
    isLoading:fileLoading,
  }=useFileContent(
    repoId,
    selectedFile
  )

useEffect(()=>{

  if(
    fileContent&&typeof fileContent==='string'&&
    fileContent.length<=MAX_FILE_SIZE
  ){
    Prism.highlightAll()
  }
},[fileContent])

  const treeBranches=
    tree.find(
      (item)=>
        item.name==='branches'
    )?.children||[]

  const branches=
    treeBranches.map((b)=>b.name)

  const branchLoading=false

  const createBranchMutation=
    useCreateBranch(repoId)

  const deleteBranchMutation=
    useDeleteBranch(repoId)

  const {
    data:tags=[],
    isLoading:tagLoading,
  }=useTags(repoId)

  const createTagMutation=
    useCreateTag(repoId)

  const deleteTagMutation=
    useDeleteTag(repoId)

  const getLanguage=(filename)=>{

    if(!filename)return'javascript'

    if(filename.endsWith('.json'))return'json'
    if(filename.endsWith('.html'))return'markup'
    if(filename.endsWith('.css'))return'css'
    if(filename.endsWith('.java'))return'java'
    if(filename.endsWith('.py'))return'python'
    if(filename.endsWith('.xml'))return'markup'
    if(filename.endsWith('.md'))return'markdown'

    return'javascript'
  }

  const getCurrentFolder=()=>{

    let current=
      Array.isArray(tree)
        ?tree
        :[]

    for(let p of path){

      const next=
        current?.find(
          (item)=>
            item.name===p
        )

      current=
        next?.children||[]
    }

    return current
  }

  const files=getCurrentFolder()

  const openFolder=(name)=>{
    setPath((prev)=>[
      ...prev,
      name,
    ])
  }

  const openFile=(name)=>{
    const fullPath=[
      ROOT_PREFIX,
      ...path,
      name,
    ].join('/')

    setSelectedFile(fullPath)
  }

  const goBack=()=>{
    setPath((prev)=>
      prev.slice(0,-1)
    )
  }

  const fileColumns=[
    {
      title:'Name',
      dataIndex:'name',

      render:(_,record)=>(
        <div
          style={{
            display:'flex',
            gap:8,
            cursor:'pointer',
          }}

          onClick={()=>
            record.type==='dir'
              ?openFolder(record.name)
              :openFile(record.name)
          }
        >

          {record.type==='dir'
            ?<Folder size={16}/>
            :<File size={16}/>
          }

          {record.name}

        </div>
      ),
    },

    {
      title:'Type',
      dataIndex:'type',
    },
  ]

  const historyColumns=[
    {
      title:'Revision',
      dataIndex:'revision',

      render:(rev)=>(
        <span style={{color:'#1890ff'}}>
          r{rev}
        </span>
      ),
    },

    {
      title:'Author',
      dataIndex:'author',
    },

    {
      title:'Date',
      dataIndex:'date',

      render:(d)=>
        d
          ?new Date(d).toLocaleString()
          :'—',
    },

    {
      title:'Message',
      dataIndex:'message',

      render:(m)=>
        m||'No message',
    },
  ]

  return (
    <>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}

        items={[

          {
            key:'files',
            label:'Files',

            children:(
              <>
                <div style={{marginBottom:8}}>
                  <strong>Path:</strong>
                  /{path.join('/')}
                </div>

                <Breadcrumb
                  style={{marginBottom:12}}
                >

                  <Breadcrumb.Item
                    onClick={()=>
                      setPath([])
                    }
                  >
                    root
                  </Breadcrumb.Item>

                  {path.map((p,i)=>(
                    <Breadcrumb.Item
                      key={i}

                      onClick={()=>
                        setPath(
                          path.slice(0,i+1)
                        )
                      }
                    >
                      {p}
                    </Breadcrumb.Item>
                  ))}

                </Breadcrumb>

                {path.length>0&&(
                  <div
                    style={{
                      marginBottom:12,
                    }}
                  >
                    <span
                      onClick={goBack}

                      style={{
                        cursor:'pointer',
                        color:'#1890ff',
                      }}
                    >
                      ← Back
                    </span>
                  </div>
                )}

                {filesLoading?(
                  <Spin/>
                ):files.length===0?(
                  <Empty description="Empty folder"/>
                ):(
                  <Table
                    dataSource={files}
                    columns={fileColumns}
                    rowKey="name"
                    pagination={false}
                  />
                )}
              </>
            ),
          },

          {
            key:'history',
            label:'History',

            children:(
              commitsLoading?(
                <Spin/>
              ):commits.length===0?(
                <Empty description="No commits"/>
              ):(
                <Table
                  dataSource={commits}
                  columns={historyColumns}
                  rowKey="revision"

                  pagination={{
                    pageSize:10,
                  }}

                  onRow={(record)=>({
                    onClick:()=>
                      navigate(
                        `/repositories/${repoId}/commits/${record.revision}`
                      ),
                  })}
                />
              )
            ),
          },

          {
            key:'branches',
            label:'Branches',

            children:(
              <>
                <div
                  style={{
                    display:'flex',
                    gap:10,
                    marginBottom:16,
                  }}
                >

                  <Input
                    value={branchName}

                    onChange={(e)=>
                      setBranchName(
                        e.target.value
                      )
                    }
                  />

                  <Button
                    type="primary"

                    onClick={()=>
                      createBranchMutation.mutate({
                        branchName,
                      })
                    }
                  >
                    Create
                  </Button>

                </div>

                {branchLoading?(
                  <Spin/>
                ):(
                  <Table
                    dataSource={
                      branches.map((b)=>({
                        name:b,
                      }))
                    }

                    rowKey="name"
                    pagination={false}

                    columns={[
                      {
                        title:'Branch',
                        dataIndex:'name',
                      },

                      {
                        title:'Action',

                        render:(_,r)=>(
                          <Button
                            danger

                            onClick={()=>
                              deleteBranchMutation.mutate(r.name)
                            }
                          >
                            Delete
                          </Button>
                        ),
                      },
                    ]}
                  />
                )}
              </>
            ),
          },

          {
            key:'tags',
            label:'Tags',

            children:(
              <>
                <div
                  style={{
                    display:'flex',
                    gap:10,
                    marginBottom:16,
                  }}
                >

                  <Input
                    value={tagName}

                    onChange={(e)=>
                      setTagName(
                        e.target.value
                      )
                    }
                  />

                  <Button
                    type="primary"

                    onClick={()=>
                      createTagMutation.mutate({
                        tagName,
                      })
                    }
                  >
                    Create
                  </Button>

                </div>

                {tagLoading?(
                  <Spin/>
                ):(
                  <Table
                    dataSource={
                      tags.map((t)=>({
                        name:t,
                      }))
                    }

                    rowKey="name"
                    pagination={false}

                    columns={[
                      {
                        title:'Tag',
                        dataIndex:'name',
                      },

                      {
                        title:'Action',

                        render:(_,r)=>(
                          <Button
                            danger

                            onClick={()=>
                              deleteTagMutation.mutate(r.name)
                            }
                          >
                            Delete
                          </Button>
                        ),
                      },
                    ]}
                  />
                )}
              </>
            ),
          },

        ]}
      />

      <Modal
        open={!!selectedFile}

        onCancel={()=>
          setSelectedFile(null)
        }

        footer={null}
      >

       {fileLoading?(
  <Spin/>
):(
  <pre
    style={{
      maxHeight:500,
      overflow:'auto',
    }}
  >

    {(
      typeof fileContent==='string'
      &&
      fileContent.length>MAX_FILE_SIZE
    )?(
      <div>

        <div
          style={{
            marginBottom:12,
            color:'#faad14',
          }}
        >
          File too large for syntax highlighting.
          Showing preview only.
        </div>

        <pre
          style={{
            whiteSpace:'pre-wrap',
            wordBreak:'break-word',
          }}
        >
          {fileContent.slice(0,MAX_FILE_SIZE)}
        </pre>

      </div>
    ):(
      <code
        className={
          `language-${getLanguage(selectedFile)}`
        }
      >
        {fileContent||'No content available'}
      </code>
    )}

  </pre>
)}
        

      </Modal>

    </>
  )
}

export default RepoDetail