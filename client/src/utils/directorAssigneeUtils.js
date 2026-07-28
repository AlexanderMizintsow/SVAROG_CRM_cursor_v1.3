/**
 * Директор не назначается исполнителем задачи (утверждающий / наблюдатель — можно).
 */

export const isDirectorRoleName = (roleName) =>
  String(roleName || '').trim() === 'Директор'

export const isDirectorUser = (user) =>
  Boolean(user?.isDirector) ||
  isDirectorRoleName(user?.roleName || user?.role_name)

export const filterAssignableUsers = (users) =>
  (Array.isArray(users) ? users : []).filter((u) => !isDirectorUser(u))
