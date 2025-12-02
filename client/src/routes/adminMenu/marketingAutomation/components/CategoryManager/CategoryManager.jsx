import { useState, useEffect } from 'react'
import axios from 'axios'
import Toastify from 'toastify-js'
import { API_BASE_URL } from '../../../../../../config'
import ConfirmationDialog from '../../../../../components/confirmationDialog/ConfirmationDialog'
import './CategoryManager.scss'

const CategoryManager = ({ canEdit, refreshKey }) => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [deleteCategoryId, setDeleteCategoryId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    display_order: 0,
  })

  useEffect(() => {
    loadCategories()
  }, [refreshKey])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/categories`)
      setCategories(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке категорий:', error)
      Toastify({
        text: 'Ошибка при загрузке категорий',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingCategory(null)
    setFormData({
      name: '',
      description: '',
      icon: '',
      display_order: categories.length,
    })
    setOpenDialog(true)
  }

  const handleEdit = (category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name || '',
      description: category.description || '',
      icon: category.icon || '',
      display_order: category.display_order || 0,
    })
    setOpenDialog(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Toastify({
        text: 'Название категории обязательно',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
      return
    }

    try {
      if (editingCategory) {
        await axios.put(
          `${API_BASE_URL}5778/api/marketing/categories/${editingCategory.id}`,
          formData
        )
        Toastify({
          text: 'Категория обновлена',
          close: true,
          backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
        }).showToast()
      } else {
        await axios.post(`${API_BASE_URL}5778/api/marketing/categories`, formData)
        Toastify({
          text: 'Категория создана',
          close: true,
          backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
        }).showToast()
      }
      setOpenDialog(false)
      loadCategories()
    } catch (error) {
      console.error('Ошибка при сохранении категории:', error)
      Toastify({
        text: error.response?.data?.error || 'Ошибка при сохранении категории',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleDelete = (id) => {
    setDeleteCategoryId(id)
  }

  const confirmDelete = async () => {
    try {
      await axios.delete(`${API_BASE_URL}5778/api/marketing/categories/${deleteCategoryId}`)
      Toastify({
        text: 'Категория удалена',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      setDeleteCategoryId(null)
      loadCategories()
    } catch (error) {
      console.error('Ошибка при удалении категории:', error)
      Toastify({
        text: error.response?.data?.error || 'Ошибка при удалении категории',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  if (loading) {
    return <div className="category-manager__loading">Загрузка...</div>
  }

  return (
    <div className="category-manager">
      <div className="category-manager__header">
        <div className="category-manager__header-content">
          <div>
            <h2>Управление категориями</h2>
            <p className="category-manager__description">
              Категории будут отображаться у дилера в чат-боте в виде кнопок. При нажатии на кнопку
              категории будут отображаться существующие в этой категории кампании. Если в категории
              кампании отсутствуют, то кнопка отображаться не будет.
            </p>
          </div>
        </div>

        {canEdit && (
          <button className="category-manager__btn" onClick={handleCreate}>
            + Создать категорию
          </button>
        )}
      </div>

      <div className="category-manager__list">
        {categories.length === 0 ? (
          <div className="category-manager__empty">Категории не найдены</div>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="category-manager__item">
              <div className="category-manager__item-content">
                <div className="category-manager__item-icon">{category.icon || '📁'}</div>
                <div className="category-manager__item-info">
                  <h3 className="category-manager__item-name">{category.name}</h3>
                  {category.description && (
                    <p className="category-manager__item-description">{category.description}</p>
                  )}
                  <span className="category-manager__item-order">
                    Порядок: {category.display_order}
                  </span>
                </div>
              </div>
              {canEdit && (
                <div className="category-manager__item-actions">
                  <button
                    className="category-manager__btn-edit"
                    onClick={() => handleEdit(category)}
                  >
                    Редактировать
                  </button>
                  <button
                    className="category-manager__btn-delete"
                    onClick={() => handleDelete(category.id)}
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {openDialog && (
        <div className="category-manager__dialog-overlay" onClick={() => setOpenDialog(false)}>
          <div className="category-manager__dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="category-manager__dialog-title">
              {editingCategory ? 'Редактировать категорию' : 'Создать категорию'}
            </h2>
            <div className="category-manager__form">
              <div className="category-manager__form-group">
                <label>Название *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Акции"
                />
              </div>
              <div className="category-manager__form-group">
                <label>Описание</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Описание категории"
                  rows="3"
                />
              </div>
              <div className="category-manager__form-group">
                <label>Иконка (эмодзи)</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="🎯"
                  maxLength="10"
                />
              </div>
              <div className="category-manager__form-group">
                <label>Порядок отображения</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                  }
                  min="0"
                />
              </div>
              <div className="category-manager__form-actions">
                <button className="category-manager__btn-save" onClick={handleSave}>
                  Сохранить
                </button>
                <button
                  className="category-manager__btn-cancel"
                  onClick={() => setOpenDialog(false)}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteCategoryId && (
        <ConfirmationDialog
          open={!!deleteCategoryId}
          onClose={() => setDeleteCategoryId(null)}
          onConfirm={confirmDelete}
          title="Удаление категории"
          message="Вы уверены, что хотите удалить эту категорию? Все связанные кампании будут сохранены."
          btn1="Отмена"
          btn2="Удалить"
        />
      )}
    </div>
  )
}

export default CategoryManager
