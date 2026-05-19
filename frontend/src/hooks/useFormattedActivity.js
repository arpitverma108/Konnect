import {useMemo} from 'react'
import {normalizeActivityEvent} from '../utils/activityModel'

const useFormattedActivity=(logs=[])=>{

  return useMemo(()=>{

    return logs.map((item)=>{
      const event=
        normalizeActivityEvent(item)

      const action=
        event.action

      const repo=
        event.repoName

      const author=
        event.actor

      const isRepoAction=
        action.includes('commit')
        || action.includes('repository')
        || action.includes('repo')
        || action.includes('branch')
        || action.includes('tag')

      return{
        ...event,

        rawAction:action,

        category:
          event.eventLabel
          ||
          (
            isRepoAction
            ?'Repository'
            :'User Activity'
          ),

        message:
          event.message,

        author,
        actor:
          author,

        repoName:repo,
        repo_name:repo,

        time:
          event.time,
      }
    })

  },[logs])
}

export default useFormattedActivity
