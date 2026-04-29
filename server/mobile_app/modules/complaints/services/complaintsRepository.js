const getCompanyById = async (pool, companyId) => {
  const result = await pool.query(
    `SELECT id, name_companies, inn, mpp_id, mpr_id, regional_manager_id
       FROM companies
      WHERE id = $1
      LIMIT 1`,
    [companyId]
  )
  return result.rows[0] || null
}

const getCompanyByInnOrName = async (pool, { inn, name }) => {
  if (inn) {
    const byInn = await pool.query(
      `SELECT id, name_companies, inn
         FROM companies
        WHERE inn = $1
        LIMIT 1`,
      [inn]
    )
    if (byInn.rows[0]) return byInn.rows[0]
  }
  const byName = await pool.query(
    `SELECT id, name_companies, inn
       FROM companies
      WHERE LOWER(name_companies) = LOWER($1)
      LIMIT 1`,
    [name]
  )
  return byName.rows[0] || null
}

module.exports = {
  getCompanyById,
  getCompanyByInnOrName,
}
