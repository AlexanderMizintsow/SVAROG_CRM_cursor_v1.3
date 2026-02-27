import { useState } from 'react'
import { FcFlowChart } from 'react-icons/fc'
import { IoPlay, IoCreateOutline, IoTrashOutline, IoPersonOutline, IoChevronDown, IoChevronUp } from 'react-icons/io5'
import ProcessCardSchedule from './ProcessCardSchedule'
import './ProcessCard.scss'

const ProcessCard = ({ process, isDraft = false, currentUserId, roleName, onStart, onPublish, onEdit, onDelete }) => {
  const [isCollapsed, setIsCollapsed] = useState(true)

  const hasSchedule = !isDraft && process.id != null
  const canEditAndDelete = roleName === 'Администратор' || Number(process.created_by) === Number(currentUserId)

  return (
    <div className="process-card">
      {isDraft && <span className="process-card__badge">Черновик</span>}
      <div className="process-card__header">
        <FcFlowChart className="process-card__icon" />
        <h3 className="process-card__title">{process.name || 'Без названия'}</h3>
        {hasSchedule && (
          <button
            type="button"
            className="process-card__toggle"
            onClick={() => setIsCollapsed((v) => !v)}
            title={isCollapsed ? 'Развернуть' : 'Свернуть'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <IoChevronDown /> : <IoChevronUp />}
          </button>
        )}
      </div>
      {!isCollapsed && (
        <>
          {process.description && (
            <p className="process-card__description">{process.description}</p>
          )}
          {hasSchedule && (
            <ProcessCardSchedule
              processId={process.id}
              currentUserId={currentUserId}
              collapsed={false}
            />
          )}
        </>
      )}
      {isCollapsed && hasSchedule && (
        <ProcessCardSchedule
          processId={process.id}
          currentUserId={currentUserId}
          collapsed={true}
        />
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

        {canEditAndDelete && (
          <button
            type="button"
            className="process-card__btn-edit"
            onClick={onEdit}
            title="Редактировать"
          >
            <IoCreateOutline className="process-card__btn-icon" />
            Редактировать
          </button>
        )}

        {canEditAndDelete && (
          <button
            type="button"
            className="process-card__btn-delete"
            onClick={onDelete}
            title="Удалить"
          >
            <IoTrashOutline className="process-card__btn-icon" />
            Удалить
          </button>
        )}
      </div>
    </div>
  )
}

export default ProcessCard
