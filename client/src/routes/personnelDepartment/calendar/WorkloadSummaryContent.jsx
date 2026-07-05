import { formatDeadlineRu } from './workloadSummaryFormat'

const CRITICAL_LABELS = {
  executor: 'Исполнитель задач',
  task_approval: 'Согласование задач',
  project_approval: 'Согласование проектов',
}

const WorkloadSummaryContent = ({ data, loading = false, compact = false }) => {
  if (loading) {
    return <p className="workload-summary__loading">Загрузка сводки…</p>
  }

  if (!data) {
    return <p className="workload-summary__empty">Не удалось загрузить сводку</p>
  }

  const { summary, totals, details } = data
  const critical = summary?.critical || {}
  const informational = summary?.informational || {}

  const hasCritical = totals?.critical > 0
  const hasInfo = totals?.informational > 0
  const hasNothing = !hasCritical && !hasInfo

  return (
    <div className={`workload-summary ${compact ? 'workload-summary--compact' : ''}`}>
      <div className="workload-summary__totals">
        {hasCritical ? (
          <p className="workload-summary__line workload-summary__line--warn">
            <strong>Важно:</strong>{' '}
            {[
              critical.executor > 0 && `${critical.executor} исполн.`,
              critical.task_approval > 0 && `${critical.task_approval} согл. задач`,
              critical.project_approval > 0 && `${critical.project_approval} согл. проектов`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : (
          <p className="workload-summary__line workload-summary__line--ok">
            Нет активных исполнений и ожидающих согласований
          </p>
        )}
        {hasInfo && (
          <p className="workload-summary__line workload-summary__line--muted">
            <strong>Справочно:</strong>{' '}
            {[
              informational.observer > 0 && `${informational.observer} наблюд.`,
              informational.author > 0 && `${informational.author} автор`,
              informational.project_participant > 0 &&
                `${informational.project_participant} уч. проектов`,
              informational.project_author > 0 && `${informational.project_author} автор проектов`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {hasNothing && (
          <p className="workload-summary__line workload-summary__line--ok">
            Открытых ролей в задачах и проектах нет
          </p>
        )}
      </div>

      {!compact && hasCritical && (
        <div className="workload-summary__sections">
          {critical.executor > 0 && details?.executor?.length > 0 && (
            <WorkloadSection
              title={CRITICAL_LABELS.executor}
              count={critical.executor}
              items={details.executor}
              type="task"
            />
          )}
          {critical.task_approval > 0 && details?.task_approval?.length > 0 && (
            <WorkloadSection
              title={CRITICAL_LABELS.task_approval}
              count={critical.task_approval}
              items={details.task_approval}
              type="task"
            />
          )}
          {critical.project_approval > 0 && details?.project_approval?.length > 0 && (
            <WorkloadSection
              title={CRITICAL_LABELS.project_approval}
              count={critical.project_approval}
              items={details.project_approval}
              type="project"
            />
          )}
        </div>
      )}

      <p className="workload-summary__note">
        Только для сведения. Задачи и проекты не изменяются автоматически.
      </p>
    </div>
  )
}

const WorkloadSection = ({ title, count, items, type }) => (
  <div className="workload-summary__section">
    <h4 className="workload-summary__section-title">
      {title} ({count})
    </h4>
    <ul className="workload-summary__list">
      {items.map((item) => (
        <li key={`${type}-${item.task_id || item.project_id}-${item.title}`}>
          <span className="workload-summary__item-title">{item.title}</span>
          {type === 'task' && item.project_title && (
            <span className="workload-summary__item-meta"> · {item.project_title}</span>
          )}
          {type === 'project' && item.role && (
            <span className="workload-summary__item-meta"> · {item.role}</span>
          )}
          {item.deadline && (
            <span className="workload-summary__item-deadline">
              {' '}
              — до {formatDeadlineRu(item.deadline)}
            </span>
          )}
        </li>
      ))}
      {count > items.length && (
        <li className="workload-summary__more">…и ещё {count - items.length}</li>
      )}
    </ul>
  </div>
)

export default WorkloadSummaryContent
