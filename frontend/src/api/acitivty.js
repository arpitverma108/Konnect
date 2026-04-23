import { fakeApi } from './client'

export const getActivity = () => {
  return fakeApi([
    {
      id: 1,
      type: 'commit',
      repo: 'frontend',
      message: 'Updated UI',
      user: 'Kunal',
      time: new Date(),
    },
  ])
}