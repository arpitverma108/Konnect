import React,{useEffect,useRef} from 'react'
import {Modal,Spin} from 'antd'
import Prism from 'prismjs'

const FileViewer=({
  selectedFile,
  fileContent='',
  fileLoading=false,
  maxFileSize,
  getLanguage,
  onClose,
})=>{
  const codeRef=useRef(null)

  useEffect(()=>{
    if(
      codeRef.current
      &&
      typeof fileContent==='string'
      &&
      fileContent.length<=maxFileSize
    ){
      Prism.highlightElement(codeRef.current)
    }
  },[
    fileContent,
    maxFileSize,
    selectedFile,
  ])

  return(
    <Modal
      open={!!selectedFile}
      onCancel={onClose}
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
            fileContent.length>maxFileSize
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
                {fileContent.slice(0,maxFileSize)}
              </pre>
            </div>
          ):(
            <code
              ref={codeRef}
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
  )
}

export default FileViewer
