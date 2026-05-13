import {useMemo} from 'react'

const useFormattedActivity=(logs=[])=>{

  return useMemo(()=>{

    return logs.map((item)=>{

      const action=
        item?.action
        ||
        item?.description
        ||
        item?.message
        ||
        'System activity'

      const repo=
        item?.repo_name
        ||
        item?.context
        ||
        ''

      const author=
        item?.author
        ||
        item?.actor
        ||
        ''

      const isRepoAction=
        action.includes('commit')
        || action.includes('repository')
        || action.includes('repo')
        || action.includes('branch')
        || action.includes('tag')

      return{
        ...item,

        rawAction:action,

        category:
          isRepoAction
            ?'Repository'
            :'User Activity',

        message:
          repo
          ?`[${repo}] ${action}`
          :action,

        author,

        repoName:repo,

        time:
          item?.created_at
          || item?.committed_at
          || new Date(),
      }
    })

  },[logs])
}

export default useFormattedActivity