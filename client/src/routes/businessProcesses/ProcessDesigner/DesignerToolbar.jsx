import { IoDocumentTextOutline, IoCreateOutline } from 'react-icons/io5'
import { MdSave, MdPublish } from 'react-icons/md'
import './DesignerToolbar.scss'

const DesignerToolbar = ({
  processName,
  processDescription,
  isDraft,
  onProcessNameChange,
  onProcessDescriptionChange,
  onIsDraftChange,
  onSaveDraft,
  onPublish,
  onNewProcess,
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
      </div>
      <div className="designer-toolbar__actions">
        <button
          type="button"
          className="designer-toolbar__btn designer-toolbar__btn--secondary"
          onClick={onNewProcess}
        >
          <IoCreateOutline /> Новый процесс
        </button>
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
