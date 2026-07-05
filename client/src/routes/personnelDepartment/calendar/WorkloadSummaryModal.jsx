import WorkloadSummaryContent from './WorkloadSummaryContent'

const WorkloadSummaryModal = ({
  open,
  employeeName,
  statusLabel,
  periodLabel,
  data,
  loading,
  saving,
  onConfirm,
  onClose,
}) => {
  if (!open) return null

  return (
    <div className="workload-summary-modal__overlay" onClick={onClose}>
      <div
        className="workload-summary-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="workload-summary-title"
      >
        <div className="workload-summary-modal__header">
          <h3 id="workload-summary-title">Сводка перед назначением статуса</h3>
          <button
            type="button"
            className="workload-summary-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="workload-summary-modal__employee">
          <strong>{employeeName}</strong>
          {statusLabel && <span> — {statusLabel}</span>}
          {periodLabel && <span className="workload-summary-modal__period"> ({periodLabel})</span>}
        </div>

        <WorkloadSummaryContent data={data} loading={loading} />

        <div className="workload-summary-modal__actions">
          <button
            type="button"
            className="workload-summary-modal__btn workload-summary-modal__btn--secondary"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="button"
            className="workload-summary-modal__btn workload-summary-modal__btn--primary"
            onClick={onConfirm}
            disabled={loading || saving}
          >
            {saving ? 'Сохранение…' : 'Сохранить статус'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WorkloadSummaryModal
