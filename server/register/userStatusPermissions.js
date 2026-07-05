/**
 * Права на управление статусами отсутствия сотрудников.
 * Доступ: Администратор, сотрудники «Отдел кадров», руководитель отдела сотрудника.
 */

const HR_DEPARTMENT_NAME = 'Отдел кадров'
const ADMIN_ROLE_NAME = 'Администратор'

async function getActorProfile(dbPool, actorUserId) {
  const uid = Number(actorUserId)
  if (!Number.isFinite(uid)) return null

  const result = await dbPool.query(
    `SELECT u.id, u.department_id, r.name AS role_name, d.name AS department_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = $1`,
    [uid]
  )
  return result.rows[0] || null
}

async function getHeadDepartmentIds(dbPool, actorUserId) {
  const result = await dbPool.query(
    `SELECT id FROM departments WHERE head_user_id = $1`,
    [Number(actorUserId)]
  )
  return result.rows.map((r) => Number(r.id))
}

async function getTargetDepartmentId(dbPool, targetUserId) {
  const result = await dbPool.query(
    `SELECT department_id FROM users WHERE id = $1`,
    [Number(targetUserId)]
  )
  const depId = result.rows[0]?.department_id
  return depId != null ? Number(depId) : null
}

async function canManageEmployeeStatus(dbPool, actorUserId, targetUserId) {
  const actor = await getActorProfile(dbPool, actorUserId)
  if (!actor) return false

  if (actor.role_name === ADMIN_ROLE_NAME) return true
  if (actor.department_name === HR_DEPARTMENT_NAME) return true

  const targetDeptId = await getTargetDepartmentId(dbPool, targetUserId)
  if (targetDeptId == null) return false

  const headDeptIds = await getHeadDepartmentIds(dbPool, actorUserId)
  return headDeptIds.includes(targetDeptId)
}

async function getManagePermissions(dbPool, actorUserId) {
  const actor = await getActorProfile(dbPool, actorUserId)
  if (!actor) {
    return {
      canCreate: false,
      isAdmin: false,
      isHr: false,
      headDepartmentIds: [],
    }
  }

  const isAdmin = actor.role_name === ADMIN_ROLE_NAME
  const isHr = actor.department_name === HR_DEPARTMENT_NAME
  const headDepartmentIds = await getHeadDepartmentIds(dbPool, actorUserId)

  return {
    canCreate: isAdmin || isHr || headDepartmentIds.length > 0,
    isAdmin,
    isHr,
    headDepartmentIds,
  }
}

function canManageByDepartment(permissions, targetDepartmentId) {
  if (!permissions) return false
  if (permissions.isAdmin || permissions.isHr) return true
  const depId = targetDepartmentId != null ? Number(targetDepartmentId) : null
  if (depId == null) return false
  return (permissions.headDepartmentIds || []).includes(depId)
}

module.exports = {
  HR_DEPARTMENT_NAME,
  ADMIN_ROLE_NAME,
  getActorProfile,
  canManageEmployeeStatus,
  getManagePermissions,
  canManageByDepartment,
}
