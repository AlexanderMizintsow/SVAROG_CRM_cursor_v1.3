// Статистика звонков отдела за период.
// Доступ: руководитель отдела или галочка show_call_stats.
// Компании и пропущенные считаются так же, как список дел.

const { ensureCallCardSchema } = require("../asterisk_server/callCardStore");
const {
  collectLists,
  headedDepartmentIds,
  canEditMissedMinutes,
  resolveSilenceDays,
} = require("./callDay");

const viewerSql = `
  SELECT u.department_id,
         p.name AS position_name,
         r.name AS role_name,
         EXISTS (SELECT 1 FROM departments d WHERE d.head_user_id = u.id) AS heads_department,
         COALESCE(s.show_call_stats, false) AS show_call_stats
  FROM users u
  LEFT JOIN positions p ON p.id = u.position_id
  LEFT JOIN roles r ON r.id = u.role_id
  LEFT JOIN calls_settings_users s ON s.user_id = u.id
  WHERE u.id = $1
`;

const isDepartmentHead = (viewer) =>
  Boolean(viewer) &&
  (viewer.position_name === "Руководитель отдела" || viewer.heads_department === true);

const canViewCallStats = (viewer) =>
  isDepartmentHead(viewer) || Boolean(viewer && viewer.show_call_stats);

const canGrantCallStats = (viewer) => canEditMissedMinutes(viewer);

const scopeCompaniesSql = `
  SELECT DISTINCT c.id, c.name_companies,
    COALESCE(c.regional_manager_id, c.mpp_id, c.mpr_id) AS manager_user_id,
    COALESCE(
      NULLIF(btrim(concat_ws(' ', ru.last_name, ru.first_name)), ''),
      NULLIF(btrim(concat_ws(' ', mu.last_name, mu.first_name)), ''),
      NULLIF(btrim(concat_ws(' ', pu.last_name, pu.first_name)), '')
    ) AS manager_name
  FROM companies c
  LEFT JOIN users ru ON ru.id = c.regional_manager_id
  LEFT JOIN users mu ON mu.id = c.mpp_id
  LEFT JOIN users pu ON pu.id = c.mpr_id
  WHERE (
      $1::int[] IS NULL
      OR c.regional_manager_id IN (SELECT id FROM users WHERE department_id = ANY($1::int[]))
      OR c.mpp_id IN (SELECT id FROM users WHERE department_id = ANY($1::int[]))
      OR c.mpr_id IN (SELECT id FROM users WHERE department_id = ANY($1::int[]))
      OR EXISTS (
        SELECT 1 FROM replacing_mpr r
        JOIN users u ON u.id = r.user_id
        WHERE r.company_id = c.id AND u.department_id = ANY($1::int[])
      )
      OR EXISTS (
        SELECT 1 FROM replacing_mpp r
        JOIN users u ON u.id = r.user_id
        WHERE r.company_id = c.id AND u.department_id = ANY($1::int[])
      )
    )
    AND (
      c.regional_manager_id IS NOT NULL
      OR c.mpp_id IS NOT NULL
      OR c.mpr_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM replacing_mpr r WHERE r.company_id = c.id)
      OR EXISTS (SELECT 1 FROM replacing_mpp r WHERE r.company_id = c.id)
    )
`;

const callsSql = `
  WITH company_phones AS (
    SELECT DISTINCT ON (company_id, key)
      company_id, key
    FROM (
      SELECT d.company_id, phone_key(dpn.phone_number) AS key, 1 AS source_rank
      FROM dealers d
      JOIN dealer_phone_numbers dpn ON dpn.dealer_id = d.id
      WHERE d.company_id = ANY($1::int[])
      UNION ALL
      SELECT pnc.company_id, phone_key(pnc.phone_number), 2
      FROM phone_numbers_companies pnc
      WHERE pnc.company_id = ANY($1::int[])
    ) raw_phones
    WHERE key IS NOT NULL AND length(key) > 5
    ORDER BY company_id, key, source_rank
  )
  SELECT DISTINCT ON (cp.company_id, c.id)
    cp.company_id,
    c.id AS call_id,
    c.accepted_at,
    c.status,
    c.talk_seconds,
    c.extension,
    CASE
      WHEN c.direction IN ('incoming', 'outgoing') THEN c.direction
      WHEN phone_key(c.caller_number) = cp.key THEN 'incoming'
      ELSE 'outgoing'
    END AS call_direction
  FROM company_phones cp
  JOIN calls c
    ON phone_key(c.caller_number) = cp.key
    OR phone_key(c.receiver_number) = cp.key
  WHERE COALESCE(c.direction, '') <> 'internal'
  ORDER BY cp.company_id, c.id
`;

const phonesSql = `
  SELECT DISTINCT ON (company_id) company_id, key AS phone
  FROM (
    SELECT d.company_id, phone_key(dpn.phone_number) AS key, 1 AS source_rank
    FROM dealers d
    JOIN dealer_phone_numbers dpn ON dpn.dealer_id = d.id
    WHERE d.company_id = ANY($1::int[])
    UNION ALL
    SELECT pnc.company_id, phone_key(pnc.phone_number), 2
    FROM phone_numbers_companies pnc
    WHERE pnc.company_id = ANY($1::int[])
  ) raw_phones
  WHERE key IS NOT NULL AND length(key) > 5
  ORDER BY company_id, source_rank, key
`;

const loadViewer = async (pool, userId) => {
  const result = await pool.query(viewerSql, [userId]);
  return result.rows[0] || null;
};

const scopeFor = async (pool, userId, viewer) => {
  const headed = await headedDepartmentIds(pool, userId, viewer);
  if (headed.size) {
    return { departmentIds: Array.from(headed), allManaged: false };
  }
  if (viewer.role_name === "Администратор" || viewer.role_name === "Директор") {
    return { departmentIds: null, allManaged: true };
  }
  if (viewer.department_id) {
    return { departmentIds: [viewer.department_id], allManaged: false };
  }
  return { departmentIds: [], allManaged: false };
};

const parseDay = (value, endOfDay) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
};

const topCounts = (rows, limit) =>
  rows
    .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name), "ru"))
    .slice(0, limit);

const getCallStats = async (pool, userId, from, to) => {
  await ensureCallCardSchema(pool);
  const viewer = await loadViewer(pool, userId);
  if (!viewer) return { status: 404, error: "Пользователь не найден" };
  if (!canViewCallStats(viewer)) {
    return { status: 403, error: "Статистику видит руководитель отдела или человек с галочкой доступа" };
  }

  const start = parseDay(from, false);
  const finish = parseDay(to, true);
  if (!start || !finish || start > finish) {
    return { status: 400, error: "Укажите период: дата начала и дата конца" };
  }
  if (finish - start > 366 * 86400000) {
    return { status: 400, error: "Период не длиннее года" };
  }

  const settings = await pool.query(
    "SELECT silence_days, missed_minutes FROM telephony_day_settings WHERE id = 1"
  );
  const silenceDefault = settings.rows[0] ? settings.rows[0].silence_days : 14;
  const missedMinutes = settings.rows[0] ? settings.rows[0].missed_minutes : 15;
  const scope = await scopeFor(pool, userId, viewer);
  const companies = scope.departmentIds && scope.departmentIds.length === 0
    ? []
    : (await pool.query(scopeCompaniesSql, [scope.departmentIds])).rows;

  if (!companies.length) {
    return {
      from,
      to,
      scope: scope.allManaged ? "all" : "department",
      silenceDefault,
      missedMinutes,
      companyCount: 0,
      silentCount: 0,
      overdueCount: 0,
      callCount: 0,
      averageTalkSeconds: 0,
      companies: [],
      managers: [],
      overdue: [],
      silent: [],
    };
  }

  const companyIds = companies.map((row) => row.id);
  const managerIds = [...new Set(companies.map((row) => row.manager_user_id).filter(Boolean))];
  const [callResult, phoneResult, silenceResult, extensionResult] = await Promise.all([
    pool.query(callsSql, [companyIds]),
    pool.query(phonesSql, [companyIds]),
    managerIds.length
      ? pool.query(
          `SELECT u.id, s.silence_days AS own_days, d.silence_days AS department_days
           FROM users u
           LEFT JOIN calls_settings_users s ON s.user_id = u.id
           LEFT JOIN departments d ON d.id = u.department_id
           WHERE u.id = ANY($1::int[])`,
          [managerIds]
        )
      : Promise.resolve({ rows: [] }),
    pool.query(
      `SELECT u.id, phone_key(up.phone_number) AS extension,
              NULLIF(btrim(concat_ws(' ', u.last_name, u.first_name)), '') AS name
       FROM user_phones up
       JOIN users u ON u.id = up.user_id
       WHERE length(phone_key(up.phone_number)) BETWEEN 2 AND 5`
    ),
  ]);

  const silenceByManager = new Map(
    silenceResult.rows.map((row) => [
      row.id,
      resolveSilenceDays({
        ownDays: row.own_days,
        departmentDays: row.department_days,
        defaultDays: silenceDefault,
      }).days,
    ])
  );
  const managerByCompany = new Map(companies.map((row) => [row.id, row.manager_user_id]));
  const lists = collectLists(companies, callResult.rows, phoneResult.rows, missedMinutes);
  const silent = [...lists.missed, ...lists.silence]
    .filter((row) => {
      const managerId = managerByCompany.get(row.companyId);
      const days = silenceByManager.get(managerId) || silenceDefault;
      return row.daysSilent === null || row.daysSilent >= days;
    })
    .sort((a, b) => (b.daysSilent || 0) - (a.daysSilent || 0));

  const periodRows = callResult.rows.filter((row) => {
    const at = new Date(row.accepted_at).getTime();
    return at >= start.getTime() && at <= finish.getTime();
  });
  const periodCalls = [...new Map(periodRows.map((row) => [row.call_id, row])).values()];
  const talked = periodCalls.filter((row) => Number(row.talk_seconds) > 0);
  const averageTalkSeconds = talked.length
    ? Math.round(talked.reduce((sum, row) => sum + Number(row.talk_seconds), 0) / talked.length)
    : 0;

  const companyNames = new Map(companies.map((row) => [row.id, row.name_companies]));
  const companyCounts = new Map();
  const seenCompanyCall = new Set();
  periodRows.forEach((row) => {
    const key = `${row.company_id}:${row.call_id}`;
    if (seenCompanyCall.has(key)) return;
    seenCompanyCall.add(key);
    companyCounts.set(row.company_id, (companyCounts.get(row.company_id) || 0) + 1);
  });
  const extensionNames = new Map();
  extensionResult.rows.forEach((row) => {
    if (row.extension && !extensionNames.has(row.extension)) {
      extensionNames.set(row.extension, row.name || `доб. ${row.extension}`);
    }
  });
  const managerCounts = new Map();
  periodCalls.forEach((row) => {
    const extension = String(row.extension || "").replace(/\D/g, "");
    if (!extension || !extensionNames.has(extension)) return;
    const name = extensionNames.get(extension);
    managerCounts.set(name, (managerCounts.get(name) || 0) + 1);
  });

  const byName = (a, b) =>
    String(a.companyName || "").localeCompare(String(b.companyName || ""), "ru");

  return {
    from,
    to,
    scope: scope.allManaged ? "all" : "department",
    silenceDefault,
    missedMinutes,
    companyCount: companies.length,
    silentCount: silent.length,
    overdueCount: lists.missed.filter((row) => row.overdue).length,
    callCount: periodCalls.length,
    averageTalkSeconds,
    companies: topCounts(
      [...companyCounts.entries()].map(([id, count]) => ({
        companyId: id,
        name: companyNames.get(id),
        count,
      })),
      8
    ),
    managers: topCounts(
      [...managerCounts.entries()].map(([name, count]) => ({ name, count })),
      8
    ),
    overdue: lists.missed
      .filter((row) => row.overdue)
      .sort(byName)
      .slice(0, 20),
    silent: silent.slice(0, 20).map((row) => ({
      companyId: row.companyId,
      companyName: row.companyName,
      managerName: row.managerName,
      daysSilent: row.daysSilent,
      phone: row.phone,
    })),
  };
};

const listStatsPeople = async (pool, editorId) => {
  const editor = await loadViewer(pool, editorId);
  if (!editor) return { status: 404, error: "Пользователь не найден" };
  if (!canGrantCallStats(editor)) {
    return { status: 403, error: "Галочку ставит руководитель, администратор или директор" };
  }
  const headed = await headedDepartmentIds(pool, editorId, editor);
  const limitToDepartment =
    headed.size > 0 &&
    editor.role_name !== "Администратор" &&
    editor.role_name !== "Директор";
  const result = await pool.query(
    `SELECT u.id,
            NULLIF(btrim(concat_ws(' ', u.last_name, u.first_name)), '') AS name,
            d.name AS department_name,
            COALESCE(s.show_call_stats, false) AS show_call_stats
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN calls_settings_users s ON s.user_id = u.id
     WHERE $1::int[] IS NULL OR u.department_id = ANY($1::int[]) OR u.id = $2
     ORDER BY u.last_name, u.first_name`,
    [limitToDepartment ? Array.from(headed) : null, editorId]
  );
  return { people: result.rows };
};

const setCallStatsAccess = async (pool, { editorId, userId, showCallStats }) => {
  const editor = await loadViewer(pool, editorId);
  if (!editor) return { status: 404, error: "Пользователь не найден" };
  if (!canGrantCallStats(editor)) {
    return { status: 403, error: "Галочку ставит руководитель, администратор или директор" };
  }
  const people = await listStatsPeople(pool, editorId);
  if (people.error) return people;
  if (!people.people.some((row) => row.id === userId)) {
    return { status: 403, error: "Этому человеку доступ открывает его руководитель" };
  }
  await pool.query(
    `INSERT INTO calls_settings_users (user_id, show_call_stats)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET show_call_stats = EXCLUDED.show_call_stats`,
    [userId, Boolean(showCallStats)]
  );
  return { userId, showCallStats: Boolean(showCallStats) };
};

module.exports = {
  canViewCallStats,
  canGrantCallStats,
  getCallStats,
  listStatsPeople,
  setCallStatsAccess,
  loadViewer,
};
