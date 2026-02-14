import { IoDocumentTextOutline, IoCreateOutline } from 'react-icons/io5'
import { MdSave, MdPublish } from 'react-icons/md'
import { IoTrashOutline } from 'react-icons/io5'
import './DesignerToolbar.scss'

const DesignerToolbar = ({
  processName,
  processDescription,
  isDraft,
  gatewayDebugNotify,
  canDelete,
  onProcessNameChange,
  onProcessDescriptionChange,
  onIsDraftChange,
  onGatewayDebugNotifyChange,
  onSaveDraft,
  onPublish,
  onNewProcess,
  onDelete,
}) => {
  return (
    <div className="designer-toolbar">
      <div className="designer-toolbar__fields">
        <label className="designer-toolbar__label">
          <IoDocumentTextOutline className="designer-toolbar__label-icon" />
          Название процесса
          <input
            type="text"
            className="designer-toolbar__input"
            value={processName}
            onChange={(e) => onProcessNameChange(e.target.value)}
            placeholder="Например: Согласование заявки"
          />
        </label>
        <label className="designer-toolbar__label designer-toolbar__label--desc">
          Описание (необязательно)
          <input
            type="text"
            className="designer-toolbar__input"
            value={processDescription}
            onChange={(e) => onProcessDescriptionChange(e.target.value)}
            placeholder="Краткое описание процесса"
          />
        </label>
        <label className="designer-toolbar__checkbox">
          <input
            type="checkbox"
            checked={isDraft}
            onChange={(e) => onIsDraftChange(e.target.checked)}
          />
          <span>Черновик (не показывать в списке для запуска)</span>
        </label>
        <label className="designer-toolbar__checkbox" title="При срабатывании Развилки/Развилки-Слияния инициатору будет приходить «Системное сообщение» с отладочной информацией">
          <input
            type="checkbox"
            checked={gatewayDebugNotify === true}
            onChange={(e) => onGatewayDebugNotifyChange && onGatewayDebugNotifyChange(e.target.checked)}
          />
          <span>Тест-уведомление (Развилки) — «Системное сообщение» инициатору</span>
        </label>
      </div>
      <div className="designer-toolbar__actions">
        <button
          type="button"
          className="designer-toolbar__btn designer-toolbar__btn--secondary"
          onClick={onNewProcess}
        >
          <IoCreateOutline /> Новый процесс
        </button>
        {canDelete && (
          <button
            type="button"
            className="designer-toolbar__btn designer-toolbar__btn--danger"
            onClick={onDelete}
            title="Удалить процесс полностью"
          >
            <IoTrashOutline /> Удалить
          </button>
        )}
        <button
          type="button"
          className="designer-toolbar__btn designer-toolbar__btn--secondary"
          onClick={onSaveDraft}
        >
          <MdSave /> Сохранить черновик
        </button>
        <button
          type="button"
          className="designer-toolbar__btn designer-toolbar__btn--primary"
          onClick={onPublish}
        >
          <MdPublish /> Опубликовать
        </button>
      </div>
    </div>
  )
}

export default DesignerToolbar
