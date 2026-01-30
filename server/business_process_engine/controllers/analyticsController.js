async function getProcessAnalytics(dbPool, req, res) {
  try {
    const { processId } = req.params
    const instancesResult = await dbPool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'completed') AS completed,
              AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) FILTER (WHERE status = 'completed' AND finished_at IS NOT NULL) AS avg_duration_seconds
       FROM bp_process_instances WHERE process_id = $1`,
      [processId]
    )
    const logResult = await dbPool.query(
      `SELECT node_id, COUNT(*) AS pass_count,
              AVG(EXTRACT(EPOCH FROM (exited_at - entered_at))) FILTER (WHERE exited_at IS NOT NULL) AS avg_seconds
       FROM bp_node_execution_log l
       JOIN bp_process_instances i ON l.instance_id = i.id
       WHERE i.process_id = $1
       GROUP BY node_id`,
      [processId]
    )
    const row = instancesResult.rows[0]
    res.json({
      process_id: Number(processId),
      total_runs: parseInt(row?.total || 0, 10),
      completed_runs: parseInt(row?.completed || 0, 10),
      avg_duration_seconds: row?.avg_duration_seconds ? parseFloat(row.avg_duration_seconds) : null,
      by_node: (logResult.rows || []).map((r) => ({
        node_id: r.node_id,
        pass_count: parseInt(r.pass_count, 10),
        avg_seconds: r.avg_seconds ? parseFloat(r.avg_seconds) : null,
      })),
    })
  } catch (err) {
    console.error('getProcessAnalytics:', err)
    res.status(500).json({ error: 'Ошибка при получении аналитики' })
  }
}

module.exports = { getProcessAnalytics }
