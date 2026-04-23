// index.js
import { create } from 'zustand'

const useAppStore = create((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  
  // Future state placeholders for complex client-side states not suitable for React Query
  activeRepository: null,
  setActiveRepository: (repo) => set({ activeRepository: repo }),
}))

export default useAppStore
