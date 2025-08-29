// databaseStructureController.js
const getDatabaseStructure = (dbPool) => async (req, res) => {
  try {
    // Получить все таблицы
    const tables = await dbPool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
    )

    // Получить колонки для каждой таблицы
    const columnsPromises = tables.rows.map(async (table) => {
      const columns = await dbPool.query(
        `
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1;
            `,
        [table.table_name]
      )
      return {
        table_name: table.table_name,
        columns: columns.rows,
      }
    })

    // Получить связи между таблицами
    const relationships = await dbPool.query(`
            SELECT 
                tc.constraint_name, 
                tc.table_name AS source_table, 
                kcu.column_name AS source_column, 
                ccu.table_name AS target_table, 
                ccu.column_name AS target_column
            FROM 
                information_schema.table_constraints AS tc 
            JOIN 
                information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
            JOIN 
                information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
            WHERE 
                constraint_type = 'FOREIGN KEY';
        `)

    // Ждем завершения всех запросов
    const tablesWithColumns = await Promise.all(columnsPromises)

    const structure = {
      tables: tablesWithColumns,
      relationships: relationships.rows,
    }

    res.json(structure)
  } catch (error) {
    console.error(error)
    res.status(500).send('Error retrieving database structure')
  }
}

module.exports = {
  getDatabaseStructure,
}
