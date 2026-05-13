
const useRole = (me) => {
  const role = me?.role ?? 'viewer'

  return {
    role,
    isViewer: role === 'viewer',
    isAdmin: ['admin', 'super_admin'].includes(role),
    isSuperAdmin: role === 'super_admin',
  }
}

export default useRole