import { create } from 'zustand'

const initialState = {
  sidebarCollapsed: false,
  token: null,
  refreshToken: null,
  activeRepository: null,
}

const useAppStore = create((set) => ({
  ...initialState,

  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed:
        !state.sidebarCollapsed,
    })),

  setAuth:({
  token,
  refreshToken,
})=>{

  localStorage.setItem(
    'token',
    token
  )

  if(refreshToken){

    localStorage.setItem(
      'refreshToken',
      refreshToken
    )
  }

  set({
    token,
    refreshToken,
  })
},

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem(
      'refreshToken'
    )

    set(initialState)
  },

  setActiveRepository: (repo) =>
    set({
      activeRepository: repo,
    }),

  hydrateAuth: () => {
    try {
      const token =
        localStorage.getItem(
          'token'
        )

      const refreshToken =
        localStorage.getItem(
          'refreshToken'
        )

      if (token) {
        set({
          token,
          refreshToken:
            refreshToken || null,
        })
      }
    } catch (err) {
      console.error(
        'Failed to hydrate auth',
        err
      )
    }
  },
}))

export default useAppStore