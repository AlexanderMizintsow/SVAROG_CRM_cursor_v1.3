import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import useUserStore from '../../../../store/userStore'
import './FinalSolutionModal.scss'

const FinalSolutionModal = ({
  globalTaskId,
  mode,
  initialContent,
  solutionId,
  onClose,
  onSaved,
  isEmailThread,
}) => {
  const { user } = useUserStore()
  const [content, setContent] = useState(initialContent || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setContent(initialContent || '')
  }, [initialContent, mode, solutionId])

  const handleSave = async () => {
    const text = content.trim()
    if (!text) return
    setSaving(true)
    try {
      const userId = user?.id
      if (mode === 'edit' && solutionId) {
        if (isEmailThread) {
          await axios.put(
            `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}/final-solutions/${solutionId}/edit-email-thread`,
            { userId, content: text }
          )
        } else {
          await axios.put(
            `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}/final-solutions/${solutionId}`,
            { content: text, userId }
          )
        }
      } else {
        await axios.post(
          `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}/final-solutions`,
          { content: text, userId }
        )
      }
      onSaved?.()
      onClose?.()
    } catch (err) {
      console.error('Ошибка сохранения итогового решения:', err)
      alert(err.response?.data?.error || 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'edit' ? 'Редактировать итоговое решение' : 'Итоговое решение'

  return (
    <div className="final-solution-modal-overlay" onClick={onClose}>
      <div
        className="final-solution-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="final-solution-modal__title">{title}</h3>
        <textarea
          className="final-solution-modal__textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Введите текст итогового решения по проекту..."
          rows={6}
        />
        <div className="final-solution-modal__actions">
          <button
            type="button"
            className="final-solution-modal__btn final-solution-modal__btn--cancel"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className="final-solution-modal__btn final-solution-modal__btn--save"
            onClick={handleSave}
            disabled={saving || !content.trim()}
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default FinalSolutionModal
