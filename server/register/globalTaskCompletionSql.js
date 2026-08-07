/**
 * Единый расчёт completion_percentage проекта (alias таблицы global_tasks = gt).
 * База: задачи + согласования + итоговые решения.
 * Доработки: в знаменателе все, в числителе только is_completed = true —
 * учитываются только если база > 0 (иначе «пустой» проект не даёт 100% из доработок).
 */

const GLOBAL_TASK_COMPLETION_BASE_DONE_SQL = `(
  (SELECT COALESCE(SUM(CASE WHEN t.is_completed THEN 1 ELSE 0 END), 0)
   FROM tasks t WHERE t.global_task_id = gt.id)
  + (SELECT COUNT(*) FROM global_task_responsibles gtra
     WHERE gtra.global_task_id = gt.id
       AND gtra.requires_approval = true
       AND gtra.approval_status = 'approved')
  + (SELECT COUNT(*) FROM global_task_final_solutions
     WHERE global_task_id = gt.id
       AND (NOT COALESCE(is_from_supplier_reply, false) OR COALESCE(is_published, false)))
)`

const GLOBAL_TASK_COMPLETION_BASE_TOTAL_SQL = `(
  (SELECT COUNT(*) FROM tasks t WHERE t.global_task_id = gt.id)
  + (SELECT COUNT(*) FROM global_task_responsibles gtra
     WHERE gtra.global_task_id = gt.id AND gtra.requires_approval = true)
  + (SELECT COUNT(*) FROM global_task_final_solutions
     WHERE global_task_id = gt.id
       AND (NOT COALESCE(is_from_supplier_reply, false) OR COALESCE(is_published, false)))
)`

const GLOBAL_TASK_COMPLETION_REWORK_DONE_SQL = `(
  SELECT COUNT(*) FROM global_task_reworks gtrw
  WHERE gtrw.global_task_id = gt.id AND gtrw.is_completed = TRUE
)`

const GLOBAL_TASK_COMPLETION_REWORK_TOTAL_SQL = `(
  SELECT COUNT(*) FROM global_task_reworks gtrw WHERE gtrw.global_task_id = gt.id
)`

const GLOBAL_TASK_COMPLETION_DONE_SQL = `(
  ${GLOBAL_TASK_COMPLETION_BASE_DONE_SQL}
  + CASE
      WHEN ${GLOBAL_TASK_COMPLETION_BASE_TOTAL_SQL} > 0
      THEN ${GLOBAL_TASK_COMPLETION_REWORK_DONE_SQL}
      ELSE 0
    END
)`

const GLOBAL_TASK_COMPLETION_TOTAL_SQL = `(
  ${GLOBAL_TASK_COMPLETION_BASE_TOTAL_SQL}
  + CASE
      WHEN ${GLOBAL_TASK_COMPLETION_BASE_TOTAL_SQL} > 0
      THEN ${GLOBAL_TASK_COMPLETION_REWORK_TOTAL_SQL}
      ELSE 0
    END
)`

/** Выражение для SELECT-списка (as completion_percentage). */
const GLOBAL_TASK_COMPLETION_PCT_SELECT_SQL = `COALESCE(
  ROUND(
    100.0 * ${GLOBAL_TASK_COMPLETION_DONE_SQL}
    / NULLIF(${GLOBAL_TASK_COMPLETION_TOTAL_SQL}, 0),
    2
  ),
  0
)`

module.exports = {
  GLOBAL_TASK_COMPLETION_DONE_SQL,
  GLOBAL_TASK_COMPLETION_TOTAL_SQL,
  GLOBAL_TASK_COMPLETION_PCT_SELECT_SQL,
  /** alias для analytics */
  GLOBAL_TASK_COMPLETION_PCT_SQL: GLOBAL_TASK_COMPLETION_PCT_SELECT_SQL,
}
