import {
  QueryClient,
} from '@tanstack/react-query'

import {
  gcTimes,
  staleTimes,
} from './queryConfig'

export const queryClient=
  new QueryClient({

    defaultOptions:{

      queries:{

        staleTime:
          staleTimes.standard,

        gcTime:
          gcTimes.standard,

        retry:1,

        refetchOnWindowFocus:
          false,

        refetchOnReconnect:
          false,
      },
    },
  })
