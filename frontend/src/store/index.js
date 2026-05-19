import { create } from 'zustand'

const initialState = {
  sidebarCollapsed: false,
  token: null,
  refreshToken: null,
  authHydrated: false,
  authHydrationError: null,
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
    refreshToken:
      refreshToken || null,
    authHydrated: true,
    authHydrationError: null,
  })
},

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem(
      'refreshToken'
    )

    set({
      ...initialState,
      authHydrated: true,
      authHydrationError: null,
    })
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

      set({
        token: token || null,
        refreshToken:
          refreshToken || null,
        authHydrated: true,
        authHydrationError: null,
      })
    } catch (err) {
      console.error(
        'Failed to hydrate auth',
        err
      )

      set({
        authHydrated: true,
        authHydrationError:
          err?.message ||
          'Failed to hydrate auth',
      })
    }
  },
}))

export default useAppStore
