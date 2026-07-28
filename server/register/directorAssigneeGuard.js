/**
 * Директор не может быть исполнителем задачи (можно утверждающим / наблюдателем).
 */

const DIRECTOR_ROLE = 'Директор'

const isDirectorRoleName = (roleName) =>
  String(roleName || '').trim() === DIRECTOR_ROLE

const getUserRoleName = async (dbPool, userId) => {
  const result = await dbPool.query(
    `SELECT r.name AS role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [userId]
  )
  return result.rows[0]?.role_name || null
}

/**
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
const assertNotDirectorAssignee = async (dbPool, userId) => {
  if (userId == null || userId === '') {
    return { ok: true }
  }
  const roleName = await getUserRoleName(dbPool, userId)
  if (isDirectorRoleName(roleName)) {
    return {
      ok: false,
      error:
        'Пользователя с ролью «Директор» нельзя назначить исполнителем задачи. Используйте обращение к руководителю.',
    }
  }
  return { ok: true }
}

module.exports = {
  DIRECTOR_ROLE,
  isDirectorRoleName,
  getUserRoleName,
  assertNotDirectorAssignee,
}
