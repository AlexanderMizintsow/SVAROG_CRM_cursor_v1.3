import { useEffect, useState } from 'react'
import './tagsManager.scss'
import axios from 'axios'
import { RiCloseLine } from 'react-icons/ri'
import { API_BASE_URL } from '../../../config'

const TagsManager = ({ onClose }) => {
  const [tags, setTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)

  // Загрузка тегов при монтировании
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}5000/api/tags`)
      .then((res) => {
        setTags(res.data)
      })
      .catch((err) => console.error('Ошибка загрузки тегов:', err))
  }, [])

  // Добавление тега
  const addTag = () => {
    const trimmedName = newTag.trim()
    if (!trimmedName) return

    // Проверка уникальности локально
    if (tags.some((tag) => tag.name === trimmedName)) return

    axios
      .post(`${API_BASE_URL}5000/api/tags`, {
        name: trimmedName,
        // Удаляем выбор иконки
      })
      .then((res) => {
        const newTagFromServer = res.data
        setTags([...tags, newTagFromServer])
        setNewTag('')
        setIsAddingTag(false)
      })
      .catch((err) => console.error('Ошибка при добавлении тега:', err))
  }

  // Удаление тега
  const removeTag = (id) => {
    axios
      .delete(`${API_BASE_URL}5000/api/tags/${id}`)
      .then(() => {
        setTags((prev) => prev.filter((tag) => tag.id !== id))
      })
      .catch((err) => console.error('Ошибка при удалении тега:', err))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      addTag()
    } else if (e.key === 'Escape') {
      setIsAddingTag(false)
      setNewTag('')
    }
  }

  return (
    <div className="tags-manager-container">
      <div className="tags-manager-card">
        <span className="tags-manager-close" onClick={onClose} title="Закрыть">
          <RiCloseLine />
        </span>
        <div className="tags-manager-header">
          <h2 className="title">Теги</h2>

          {!isAddingTag && (
            <button onClick={() => setIsAddingTag(true)} className="add-button">
              <i className="fas fa-plus"></i> Добавить
            </button>
          )}
        </div>

        <div className="tags-list">
          {tags.map((tag) => (
            <div key={tag.id} className="tag-item">
              {/* Отображение без иконок */}
              <span>{tag.name}</span>
              <span
                onClick={() => removeTag(tag.id)}
                className="remove-tag-button"
              >
                <i className="fas fa-times"></i>
              </span>
            </div>
          ))}
        </div>

        {isAddingTag && (
          <div className="tag-input-section">
            <div className="input-container">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Название тега..."
                className="tag-input"
                autoFocus
              />
            </div>

            <div className="buttons-group">
              <button
                onClick={() => {
                  setIsAddingTag(false)
                  setNewTag('')
                }}
                className="tags-manager-cancel-button"
              >
                Отмена
              </button>
              <button onClick={addTag} className="tags-manager-save-button">
                Сохранить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TagsManager
