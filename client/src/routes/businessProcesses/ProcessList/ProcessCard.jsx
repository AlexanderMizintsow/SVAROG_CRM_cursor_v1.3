import { FcFlowChart } from 'react-icons/fc'
import { IoPlay, IoCreateOutline, IoTrashOutline, IoPersonOutline  } from 'react-icons/io5'
import './ProcessCard.scss'

const ProcessCard = ({ process, isDraft = false, onStart, onPublish, onEdit, onDelete }) => {
  return (
    <div className="process-card">
      {isDraft && <span className="process-card__badge">Черновик</span>}
      <div className="process-card__header">
        <FcFlowChart className="process-card__icon" />
        <h3 className="process-card__title">{process.name || 'Без названия'}</h3>
      </div>
      {process.description && (
        <p className="process-card__description">{process.description}</p>
      )}
      <div className="process-card__actions">
        {isDraft ? (
          typeof onPublish === 'function' && (
            <button
              type="button"
              className="process-card__btn-publish"
              onClick={onPublish}
            >
              <IoPersonOutline  className="process-card__btn-icon" />
              Опубликовать
            </button>
          )
        ) : (
          <button
            type="button"
            className="process-card__btn-start"
            onClick={onStart}
          >
            <IoPlay className="process-card__btn-icon" />
            Запустить
          </button>
        )}

        <button
          type="button"
          className="process-card__btn-edit"
          onClick={onEdit}
          title="Редактировать"
        >
          <IoCreateOutline className="process-card__btn-icon" />
          Редактировать
        </button>

        <button
          type="button"
          className="process-card__btn-delete"
          onClick={onDelete}
          title="Удалить"
        >
          <IoTrashOutline className="process-card__btn-icon" />
          Удалить
        </button>
      </div>
    </div>
  )
}

export default ProcessCard
