// Список дел менеджера на день.
// Компании берутся из карточки: региональный менеджер, МПП, МПР и замещающие.

const { ensureCallCardSchema } = require("../asterisk_server/callCardStore");
const { resolveWorkHours } = require("./workHours");

const callsSql = `
  WITH company_phones AS (
    SELECT DISTINCT ON (company_id, key)
      company_id,
      key
    FROM (
      SELECT d.company_id, phone_key(dpn.phone_number) AS key, 1 AS source_rank
      FROM dealers d
      JOIN dealer_phone_numbers dpn ON dpn.dealer_id = d.id
      UNION ALL
      SELECT pnc.company_id, phone_key(pnc.phone_number), 2
      FROM phone_numbers_companies pnc
    ) raw_phones
    WHERE key IS NOT NULL AND length(key) > 5
    ORDER BY company_id, key, source_rank
  ),
  my_companies AS (
    SELECT c.id, c.name_companies
    FROM companies c
    WHERE c.regional_manager_id = $1
       OR c.mpp_id = $1
       OR c.mpr_id = $1
       OR EXISTS (
         SELECT 1 FROM replacing_mpr r
         WHERE r.company_id = c.id AND r.user_id = $1
       )
       OR EXISTS (
         SELECT 1 FROM replacing_mpp r
         WHERE r.company_id = c.id AND r.user_id = $1
       )
  )
  SELECT DISTINCT ON (mc.id, c.id)
    mc.id AS company_id,
    mc.name_companies AS company_name,
    c.id AS call_id,
    c.accepted_at,
    c.status,
    c.talk_seconds,
    CASE
      WHEN c.direction IN ('incoming', 'outgoing') THEN c.direction
      WHEN phone_key(c.caller_number) = cp.key THEN 'incoming'
      ELSE 'outgoing'
    END AS call_direction,
    phone_key(
      CASE
        WHEN (
          CASE
            WHEN c.direction IN ('incoming', 'outgoing') THEN c.direction
            WHEN phone_key(c.caller_number) = cp.key THEN 'incoming'
            ELSE 'outgoing'
          END
        ) = 'outgoing' THEN c.receiver_number
        ELSE c.caller_number
      END
    ) AS external_number
  FROM my_companies mc
  JOIN company_phones cp ON cp.company_id = mc.id
  JOIN calls c
    ON phone_key(c.caller_number) = cp.key
    OR phone_key(c.receiver_number) = cp.key
  WHERE COALESCE(c.direction, '') <> 'internal'
  ORDER BY mc.id, c.id
`;

const phonesSql = `
  SELECT DISTINCT ON (company_id)
    company_id,
    key AS phone
  FROM (
    SELECT d.company_id, phone_key(dpn.phone_number) AS key, 1 AS source_rank
    FROM dealers d
    JOIN dealer_phone_numbers dpn ON dpn.dealer_id = d.id
    WHERE d.company_id IN (
      SELECT id FROM companies
      WHERE regional_manager_id = $1 OR mpp_id = $1 OR mpr_id = $1
    )
       OR d.company_id IN (SELECT company_id FROM replacing_mpr WHERE user_id = $1)
       OR d.company_id IN (SELECT company_id FROM replacing_mpp WHERE user_id = $1)
    UNION ALL
    SELECT pnc.company_id, phone_key(pnc.phone_number), 2
    FROM phone_numbers_companies pnc
    WHERE pnc.company_id IN (
      SELECT id FROM companies
      WHERE regional_manager_id = $1 OR mpp_id = $1 OR mpr_id = $1
    )
       OR pnc.company_id IN (SELECT company_id FROM replacing_mpr WHERE user_id = $1)
       OR pnc.company_id IN (SELECT company_id FROM replacing_mpp WHERE user_id = $1)
  ) raw_phones
  WHERE key IS NOT NULL AND length(key) > 5
  ORDER BY company_id, source_rank, key
`;

const remindersSql = `
  SELECT
    r.id,
    r.date_time,
    r.comment,
    r.title,
    r.company_id,
    comp.name_companies AS company_name,
    c.id AS call_id,
    c.caller_number,
    c.receiver_number,
    c.direction,
    c.accepted_at
  FROM reminders r
  LEFT JOIN companies comp ON comp.id = r.company_id
  LEFT JOIN calls c ON c.reminder_id = r.id OR c.id = r.related_id
  WHERE r.user_id = $1
    AND r.type_reminders = 'call'
    AND COALESCE(r.is_completed, false) = false
  ORDER BY r.date_time
`;

const departmentCompaniesSql = `
  SELECT DISTINCT c.id, c.name_companies,
    COALESCE(
      NULLIF(btrim(concat_ws(' ', ru.last_name, ru.first_name)), ''),
      NULLIF(btrim(concat_ws(' ', mu.last_name, mu.first_name)), ''),
      NULLIF(btrim(concat_ws(' ', pu.last_name, pu.first_name)), '')
    ) AS manager_name
  FROM companies c
  LEFT JOIN users ru ON ru.id = c.regional_manager_id
  LEFT JOIN users mu ON mu.id = c.mpp_id
  LEFT JOIN users pu ON pu.id = c.mpr_id
  WHERE c.regional_manager_id IN (SELECT id FROM users WHERE department_id = ANY($1::int[]))
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
`;

const companyCallsSql = `
  WITH company_phones AS (
    SELECT DISTINCT ON (company_id, key)
      company_id,
      key
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
  SELECT DISTINCT ON (mc.id, c.id)
    mc.id AS company_id,
    mc.name_companies AS company_name,
    c.id AS call_id,
    c.accepted_at,
    c.status,
    c.talk_seconds,
    CASE
      WHEN c.direction IN ('incoming', 'outgoing') THEN c.direction
      WHEN phone_key(c.caller_number) = cp.key THEN 'incoming'
      ELSE 'outgoing'
    END AS call_direction,
    phone_key(
      CASE
        WHEN (
          CASE
            WHEN c.direction IN ('incoming', 'outgoing') THEN c.direction
            WHEN phone_key(c.caller_number) = cp.key THEN 'incoming'
            ELSE 'outgoing'
          END
        ) = 'outgoing' THEN c.receiver_number
        ELSE c.caller_number
      END
    ) AS external_number
  FROM companies mc
  JOIN company_phones cp ON cp.company_id = mc.id
  JOIN calls c
    ON phone_key(c.caller_number) = cp.key
    OR phone_key(c.receiver_number) = cp.key
  WHERE mc.id = ANY($1::int[])
    AND COALESCE(c.direction, '') <> 'internal'
  ORDER BY mc.id, c.id
`;

const companyPhonesSql = `
  SELECT DISTINCT ON (company_id)
    company_id,
    key AS phone
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

const companiesSql = `
  SELECT c.id, c.name_companies
  FROM companies c
  WHERE c.regional_manager_id = $1
     OR c.mpp_id = $1
     OR c.mpr_id = $1
     OR EXISTS (
       SELECT 1 FROM replacing_mpr r
       WHERE r.company_id = c.id AND r.user_id = $1
     )
     OR EXISTS (
       SELECT 1 FROM replacing_mpp r
       WHERE r.company_id = c.id AND r.user_id = $1
     )
  ORDER BY c.name_companies
`;

const closesMissed = (call) =>
  call.call_direction === "outgoing" ||
  call.status === "accepted" ||
  call.status === "processed" ||
  Number(call.talk_seconds) > 0;

const isMissedOverdue = (missedAt, minutes, now = Date.now()) => {
  if (!missedAt || !minutes) return false;
  return now - new Date(missedAt).getTime() >= minutes * 60000;
};

const daysSilent = (acceptedAt) => {
  if (!acceptedAt) return null;
  const last = new Date(acceptedAt);
  const today = new Date();
  const from = Date.UTC(last.getFullYear(), last.getMonth(), last.getDate());
  const to = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((to - from) / 86400000));
};

const byCompany = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.company_id)) map.set(row.company_id, []);
    map.get(row.company_id).push(row);
  });
  map.forEach((list) => {
    list.sort((a, b) => new Date(a.accepted_at) - new Date(b.accepted_at));
  });
  return map;
};

const phoneByCompany = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.company_id)) map.set(row.company_id, row.phone);
  });
  return map;
};

const matchCompany = (call, phones) => {
  if (!call) return null;
  const caller = call.caller_number;
  const receiver = call.receiver_number;
  for (const [companyId, phone] of phones) {
    if (!phone) continue;
    const callerKey = String(caller || "").replace(/\D/g, "");
    const receiverKey = String(receiver || "").replace(/\D/g, "");
    const normalizedCaller =
      callerKey.length === 11 && callerKey.startsWith("8")
        ? `7${callerKey.slice(1)}`
        : callerKey;
    const normalizedReceiver =
      receiverKey.length === 11 && receiverKey.startsWith("8")
        ? `7${receiverKey.slice(1)}`
        : receiverKey;
    if (normalizedCaller === phone || normalizedReceiver === phone) {
      return companyId;
    }
  }
  return null;
};

const viewerSql = `
  SELECT u.department_id,
         p.name AS position_name,
         r.name AS role_name,
         EXISTS (SELECT 1 FROM departments d WHERE d.head_user_id = u.id) AS heads_department
  FROM users u
  LEFT JOIN positions p ON p.id = u.position_id
  LEFT JOIN roles r ON r.id = u.role_id
  WHERE u.id = $1
`;

const canEditMissedMinutes = (viewer) => {
  if (!viewer) return false;
  return (
    viewer.position_name === "Руководитель отдела" ||
    viewer.heads_department === true ||
    viewer.role_name === "Администратор" ||
    viewer.role_name === "Директор"
  );
};

const canEditSilenceDefault = (viewer) =>
  Boolean(viewer) &&
  (viewer.role_name === "Администратор" || viewer.role_name === "Директор");

// Свой срок менеджера важнее срока отдела, срок отдела — общего.
const resolveSilenceDays = ({ ownDays, departmentDays, defaultDays }) => {
  const own = Number(ownDays);
  if (ownDays != null && ownDays !== "" && own > 0) {
    return { days: own, source: "user" };
  }
  const department = Number(departmentDays);
  if (departmentDays != null && departmentDays !== "" && department > 0) {
    return { days: department, source: "department" };
  }
  const fallback = Number(defaultDays) > 0 ? Number(defaultDays) : 14;
  return { days: fallback, source: "default" };
};

const silenceProfileSql = `
  SELECT u.department_id,
         d.name AS department_name,
         d.silence_days AS department_silence_days,
         s.silence_days AS own_silence_days,
         to_char(d.work_start, 'HH24:MI') AS department_work_start,
         to_char(d.work_end, 'HH24:MI') AS department_work_end
  FROM users u
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN calls_settings_users s ON s.user_id = u.id
  WHERE u.id = $1
`;

const headedDepartmentIds = async (pool, userId, viewer) => {
  const departmentIds = new Set();
  if (
    viewer &&
    viewer.department_id &&
    (viewer.position_name === "Руководитель отдела" || viewer.heads_department)
  ) {
    departmentIds.add(viewer.department_id);
  }
  if (viewer && viewer.heads_department) {
    const headed = await pool.query(
      "SELECT id FROM departments WHERE head_user_id = $1",
      [userId]
    );
    headed.rows.forEach((row) => departmentIds.add(row.id));
  }
  return departmentIds;
};

const collectLists = (companyRows, callRows, phoneRows, minutes) => {
  const companies = new Map(
    companyRows.map((row) => [row.id, row.name_companies])
  );
  const managers = new Map(
    companyRows.map((row) => [row.id, row.manager_name || null])
  );
  const calls = byCompany(callRows);
  const phones = phoneByCompany(phoneRows);
  const missed = [];
  const silence = [];

  companies.forEach((name, companyId) => {
    const history = calls.get(companyId) || [];
    const last = history[history.length - 1] || null;
    let openMissed = null;

    history.forEach((call, index) => {
      const incomingMissed =
        call.status === "missed" && call.call_direction !== "outgoing";
      if (!incomingMissed) return;
      const closedLater = history.slice(index + 1).some(closesMissed);
      if (!closedLater) openMissed = call;
    });

    const row = {
      companyId,
      companyName: name,
      managerName: managers.get(companyId) || null,
      phone: (openMissed && openMissed.external_number) || phones.get(companyId) || null,
      daysSilent: daysSilent(last && last.accepted_at),
      lastCallAt: last ? last.accepted_at : null,
      lastDirection: last ? last.call_direction : null,
    };

    if (openMissed) {
      missed.push({
        ...row,
        missedAt: openMissed.accepted_at,
        callId: openMissed.call_id,
        overdue: isMissedOverdue(openMissed.accepted_at, minutes),
      });
      return;
    }

    silence.push(row);
  });

  return { companies, phones, missed, silence };
};

const getCallDay = async (pool, userId) => {
  await ensureCallCardSchema(pool);

  const settings = await pool.query(
    `SELECT silence_days, missed_minutes, short_seconds, long_seconds,
            to_char(work_start, 'HH24:MI') AS work_start,
            to_char(work_end, 'HH24:MI') AS work_end
     FROM telephony_day_settings WHERE id = 1`
  );
  const silenceDefaultDays = settings.rows[0] ? settings.rows[0].silence_days : 14;
  const missedMinutes = settings.rows[0] ? settings.rows[0].missed_minutes : 15;
  const shortSeconds = settings.rows[0] ? settings.rows[0].short_seconds : 30;
  const longSeconds = settings.rows[0] ? settings.rows[0].long_seconds : 180;
  const workDefaultStart = settings.rows[0] ? settings.rows[0].work_start : "09:00";
  const workDefaultEnd = settings.rows[0] ? settings.rows[0].work_end : "18:00";

  const [companyResult, callResult, phoneResult, reminderResult, profileResult] =
    await Promise.all([
      pool.query(companiesSql, [userId]),
      pool.query(callsSql, [userId]),
      pool.query(phonesSql, [userId]),
      pool.query(remindersSql, [userId]),
      pool.query(silenceProfileSql, [userId]),
    ]);
  const profile = profileResult.rows[0] || {};
  const silenceRule = resolveSilenceDays({
    ownDays: profile.own_silence_days,
    departmentDays: profile.department_silence_days,
    defaultDays: silenceDefaultDays,
  });
  const silenceDays = silenceRule.days;

  const own = collectLists(
    companyResult.rows,
    callResult.rows,
    phoneResult.rows,
    missedMinutes
  );
  const remindedCompanies = new Set();
  const reminders = [];
  const seenReminders = new Set();
  reminderResult.rows.forEach((reminder) => {
    if (seenReminders.has(reminder.id)) return;
    seenReminders.add(reminder.id);
    const companyId = reminder.company_id || matchCompany(reminder, own.phones);
    if (companyId) remindedCompanies.add(companyId);
    reminders.push({
      reminderId: reminder.id,
      companyId,
      companyName:
        reminder.company_name || (companyId ? own.companies.get(companyId) : null),
      phone: (companyId && own.phones.get(companyId)) || null,
      dateTime: reminder.date_time,
      title: reminder.title,
      comment: reminder.comment,
      daysSilent: daysSilent(reminder.accepted_at),
    });
  });

  const silenceOnly = own.silence.filter(
    (row) =>
      !remindedCompanies.has(row.companyId) &&
      (row.daysSilent === null || row.daysSilent >= silenceDays)
  );

  const viewerResult = await pool.query(viewerSql, [userId]);
  const viewer = viewerResult.rows[0] || null;
  const departmentIds = await headedDepartmentIds(pool, userId, viewer);
  let silenceDepartments = [];
  let workDepartments = [];
  if (departmentIds.size) {
    const named = await pool.query(
      `SELECT id, name, silence_days,
              to_char(work_start, 'HH24:MI') AS work_start,
              to_char(work_end, 'HH24:MI') AS work_end
       FROM departments
       WHERE id = ANY($1::int[])
       ORDER BY name`,
      [Array.from(departmentIds)]
    );
    silenceDepartments = named.rows.map((row) => ({
      id: row.id,
      name: row.name,
      silenceDays: row.silence_days,
    }));
    workDepartments = named.rows.map((row) => ({
      id: row.id,
      name: row.name,
      workStart: row.work_start,
      workEnd: row.work_end,
    }));
  }

  let overdueDepartment = [];
  if (departmentIds.size) {
    const ids = Array.from(departmentIds);
    const departmentCompanies = await pool.query(departmentCompaniesSql, [ids]);
    const companyIds = departmentCompanies.rows
      .map((row) => row.id)
      .filter((id) => !own.missed.some((row) => row.companyId === id));
    if (companyIds.length) {
      const [deptCalls, deptPhones] = await Promise.all([
        pool.query(companyCallsSql, [companyIds]),
        pool.query(companyPhonesSql, [companyIds]),
      ]);
      const departmentLists = collectLists(
        departmentCompanies.rows.filter((row) => companyIds.includes(row.id)),
        deptCalls.rows,
        deptPhones.rows,
        missedMinutes
      );
      overdueDepartment = departmentLists.missed.filter((row) => row.overdue);
    }
  }

  const workRule = resolveWorkHours({
    departmentStart: profile.department_work_start,
    departmentEnd: profile.department_work_end,
    defaultStart: workDefaultStart,
    defaultEnd: workDefaultEnd,
  });

  const byName = (a, b) =>
    String(a.companyName || "").localeCompare(String(b.companyName || ""), "ru");

  return {
    silenceDays,
    silenceSource: silenceRule.source,
    silenceDefaultDays,
    ownSilenceDays: profile.own_silence_days,
    departmentSilenceDays: profile.department_silence_days,
    departmentName: profile.department_name || null,
    silenceDepartments,
    canEditSilenceDefault: canEditSilenceDefault(viewer),
    workStart: workRule.start,
    workEnd: workRule.end,
    workSource: workRule.source,
    workDefaultStart: workDefaultStart || "09:00",
    workDefaultEnd: workDefaultEnd || "18:00",
    workDepartments,
    canEditWorkDefault: canEditSilenceDefault(viewer),
    missedMinutes,
    canEditMissedMinutes: canEditMissedMinutes(viewer),
    shortSeconds: shortSeconds || 30,
    longSeconds: longSeconds || 180,
    missed: own.missed.sort(byName),
    overdueDepartment: overdueDepartment.sort(byName),
    reminders,
    silence: silenceOnly.sort(byName),
  };
};

module.exports = {
  getCallDay,
  isMissedOverdue,
  canEditMissedMinutes,
  canEditSilenceDefault,
  resolveSilenceDays,
  collectLists,
  headedDepartmentIds,
};
