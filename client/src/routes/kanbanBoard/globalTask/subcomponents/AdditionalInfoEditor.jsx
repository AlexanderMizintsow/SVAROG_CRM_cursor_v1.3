import { useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import UserStore from '../../../../store/userStore'
import './AdditionalInfoEditor.scss'

const AdditionalInfoEditor = ({
  currentInfo,
  globalTaskId,
  onClose,
  onRefresh,
}) => {
  const { user } = UserStore()
  const [info, setInfo] = useState(currentInfo || {})
  const [keyInput, setKeyInput] = useState('')
  const [valueInput, setValueInput] = useState('')
  const userId = user ? user.id : null

  console.log(info)
  // Функция для определения изменений (оставляем без изменений)
  const getDifferences = (oldInfo, newInfo) => {
    const oldKeys = new Set(Object.keys(oldInfo))
    const newKeys = new Set(Object.keys(newInfo))

    const addedKeys = [...newKeys].filter((k) => !oldKeys.has(k))
    const removedKeys = [...oldKeys].filter((k) => !newKeys.has(k))

    return { addedKeys, removedKeys }
  }

  // В функции логирования добавим получение значений
  const logHistoryChange = async (
    addedKeys,
    removedKeys,
    currentInfo,
    originalInfo
  ) => {
    let description = ''

    if (addedKeys.length > 0) {
      const addedEntries = addedKeys.map((k) => `${k}: ${currentInfo[k] ?? ''}`)
      description += `Добавлена дополнительная информация: ${addedEntries.join(
        ', '
      )}. `
    }
    if (removedKeys.length > 0) {
      const removedEntries = removedKeys.map(
        (k) => `${k}: ${originalInfo[k] ?? ''}`
      )
      description += `Удалена дополнительная информация: ${removedEntries.join(
        ', '
      )}.`
    }

    await axios.post(
      `${API_BASE_URL}5000/api/global-task/${globalTaskId}/history`,
      {
        eventType: 'обновление',
        description,
        createdBy: userId,
        data: null,
      }
    )
  }

  const handleAddInfo = () => {
    const trimmedKey = keyInput.trim()
    const trimmedValue = valueInput.trim()
    if (trimmedKey !== '') {
      setInfo({ ...info, [trimmedKey]: trimmedValue })
      setKeyInput('')
      setValueInput('')
    }
  }

  const handleRemoveKey = (key) => {
    const newInfo = { ...info }
    delete newInfo[key]
    setInfo(newInfo)
  }

  const handleSave = async () => {
    try {
      // Определяем изменения
      const { addedKeys, removedKeys } = getDifferences(currentInfo || {}, info)

      if (addedKeys.length > 0 || removedKeys.length > 0) {
        await logHistoryChange(addedKeys, removedKeys, info, currentInfo)
      }

      await axios.put(
        `${API_BASE_URL}5000/api/tasks/${globalTaskId}/update-additional-info`,
        {
          additional_info: info,
        }
      )
      if (onClose) {
        onClose()
      }
      if (onRefresh) {
        onRefresh(globalTaskId)
      }
    } catch (err) {
      console.error('Ошибка при сохранении доп. информации:', err)
    }
  }

  return (
    <div className="global-task-additional-info-overlay">
      <div className="additional-info-editor">
        <h3>Редактор доп. информации</h3>
        <ul>
          {Object.entries(info).map(([key, value]) => (
            <li key={key}>
              <strong>{key}:</strong> {value}
              <button
                className="additional-info-editor__button additional-info-editor__delete"
                onClick={() => handleRemoveKey(key)}
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
        <input
          className="additional-info-editor__input"
          placeholder="Ключ"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
        />
        <input
          className="additional-info-editor__input"
          placeholder="Значение"
          value={valueInput}
          onChange={(e) => setValueInput(e.target.value)}
        />
        <div className="additional-info-editor__buttons">
          <button
            className="additional-info-editor__button additional-info-editor__add-btn"
            onClick={handleAddInfo}
          >
            Добавить
          </button>
          <button
            className="additional-info-editor__button additional-info-editor__save-btn"
            onClick={handleSave}
          >
            Сохранить
          </button>
          <button
            className="additional-info-editor__button additional-info-editor__cancel-btn"
            onClick={onClose}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdditionalInfoEditor
