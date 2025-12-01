import { useState, useEffect } from 'react'
import axios from 'axios'
import Toastify from 'toastify-js'
import { API_BASE_URL } from '../../../../../../config'
import ConfirmationDialog from '../../../../../components/confirmationDialog/ConfirmationDialog'
import './TagManager.scss'

const TagManager = ({ canEdit, refreshKey }) => {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [deleteTagId, setDeleteTagId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    color: '#667eea',
  })

  useEffect(() => {
    loadTags()
  }, [refreshKey])

  const loadTags = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/tags`)
      setTags(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке тегов:', error)
      Toastify({
        text: 'Ошибка при загрузке тегов',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setFormData({
      name: '',
      color: '#667eea',
    })
    setOpenDialog(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Toastify({
        text: 'Название тега обязательно',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
      return
    }

    try {
      await axios.post(`${API_BASE_URL}5778/api/marketing/tags`, formData)
      Toastify({
        text: 'Тег создан',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      setOpenDialog(false)
      loadTags()
    } catch (error) {
      console.error('Ошибка при сохранении тега:', error)
      Toastify({
        text: error.response?.data?.error || 'Ошибка при сохранении тега',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleDelete = (id) => {
    setDeleteTagId(id)
  }

  const confirmDelete = async () => {
    try {
      await axios.delete(`${API_BASE_URL}5778/api/marketing/tags/${deleteTagId}`)
      Toastify({
        text: 'Тег удален',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      setDeleteTagId(null)
      loadTags()
    } catch (error) {
      console.error('Ошибка при удалении тега:', error)
      Toastify({
        text: error.response?.data?.error || 'Ошибка при удалении тега',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  if (loading) {
    return <div className="tag-manager__loading">Загрузка...</div>
  }

  return (
    <div className="tag-manager">
      <div className="tag-manager__header">
        <h2>Управление тегами</h2>
        {canEdit && (
          <button className="tag-manager__btn" onClick={handleCreate}>
            + Создать тег
          </button>
        )}
      </div>

      <div className="tag-manager__info">
        <p className="tag-manager__description">
          Теги помогают организовать и категоризировать кампании для удобного поиска и фильтрации.
          Они не влияют на выбор получателей рассылки.
        </p>
      </div>

      <div className="tag-manager__list">
        {tags.length === 0 ? (
          <div className="tag-manager__empty">Теги не найдены</div>
        ) : (
          tags.map((tag) => (
            <div key={tag.id} className="tag-manager__item">
              <div className="tag-manager__item-content">
                <div
                  className="tag-manager__item-color"
                  style={{ backgroundColor: tag.color || '#667eea' }}
                />
                <div className="tag-manager__item-info">
                  <h3 className="tag-manager__item-name">{tag.name}</h3>
                </div>
              </div>
              {canEdit && (
                <div className="tag-manager__item-actions">
                  <button className="tag-manager__btn-delete" onClick={() => handleDelete(tag.id)}>
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {openDialog && (
        <div className="tag-manager__dialog-overlay" onClick={() => setOpenDialog(false)}>
          <div className="tag-manager__dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="tag-manager__dialog-title">Создать тег</h2>
            <div className="tag-manager__form">
              <div className="tag-manager__form-group">
                <label>Название *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Скидка, Новинка, Важно"
                />
              </div>
              <div className="tag-manager__form-group">
                <label>Цвет</label>
                <div className="tag-manager__color-input">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#667eea"
                    pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                  />
                </div>
              </div>
              <div className="tag-manager__form-actions">
                <button className="tag-manager__btn-save" onClick={handleSave}>
                  Сохранить
                </button>
                <button className="tag-manager__btn-cancel" onClick={() => setOpenDialog(false)}>
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTagId && (
        <ConfirmationDialog
          open={!!deleteTagId}
          onClose={() => setDeleteTagId(null)}
          onConfirm={confirmDelete}
          title="Удаление тега"
          message="Вы уверены, что хотите удалить этот тег? Тег будет удален из всех связанных кампаний."
          btn1="Отмена"
          btn2="Удалить"
        />
      )}
    </div>
  )
}

export default TagManager
