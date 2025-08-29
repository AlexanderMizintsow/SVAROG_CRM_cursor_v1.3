const getEmployeeHierarchy = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(`
     WITH RECURSIVE employee_hierarchy AS (
          SELECT 
              u.id,
              u.first_name || ' ' || COALESCE(u.middle_name, '') || ' ' || u.last_name AS name,
              COALESCE(p.name, 'Не указана должность') AS job_title,
              d.name AS department,  -- Добавляем отдел
              u.supervisor_id,
              u.gender   
          FROM users u
          LEFT JOIN positions p ON u.position_id = p.id
          LEFT JOIN departments d ON u.department_id = d.id -- Присоединяем таблицу departments
          WHERE u.supervisor_id IS NULL

          UNION ALL

          SELECT 
              u.id,
              u.first_name || ' ' || COALESCE(u.middle_name, '') || ' ' || u.last_name AS name,
              COALESCE(p.name, 'Не указана должность') AS job_title,
              d.name AS department,  -- Добавляем отдел
              u.supervisor_id,
              u.gender   
          FROM users u
          LEFT JOIN positions p ON u.position_id = p.id
          LEFT JOIN departments d ON u.department_id = d.id -- Присоединяем таблицу departments
          INNER JOIN employee_hierarchy eh ON u.supervisor_id = eh.id
      )
      SELECT * FROM employee_hierarchy;
    `)

    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении иерархии сотрудников:', err)
    res.status(500).json({ error: 'Ошибка при получении иерархии сотрудников' })
  }
}

// Для получения списка сотрудников подчиненные руководителю в Кабан Доске
const getEmployeeSubordinate = (dbPool) => async (req, res) => {
  const userId = req.params.id
  if (!userId || isNaN(userId)) {
    return res.status(400).send('Неверный параметр userId')
  }
  try {
    const result = await dbPool.query(
      `
          WITH RECURSIVE Subordinates AS (
              SELECT 
                  id AS user_id,
                  first_name,
                  middle_name,
                  last_name,
                  status       
              FROM users
              WHERE supervisor_id = $1  
              UNION ALL
              SELECT 
                  u.id,
                  u.first_name,
                  u.middle_name,
                  u.last_name,
                  u.status  
              FROM 
                  users u
              INNER JOIN 
                  Subordinates s ON u.supervisor_id = s.user_id
          )
          SELECT * FROM Subordinates
          ORDER BY user_id;
          `,
      [userId]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Ошибка при получении сотрудников:', error)
    res.status(500).send('Ошибка при получении сотрудников')
  }
}

module.exports = {
  getEmployeeHierarchy,
  getEmployeeSubordinate,
}
