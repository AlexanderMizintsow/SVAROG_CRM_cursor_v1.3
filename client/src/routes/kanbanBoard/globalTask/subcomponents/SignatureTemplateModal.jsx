import { useState, useEffect } from 'react'
import axios from 'axios'
import { FaTimes } from 'react-icons/fa'
import { API_BASE_URL } from '../../../../../config'
import './SignatureTemplateModal.scss'

const SignatureTemplateModal = ({ open, onClose, userId }) => {
  const [text, setText] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && userId) {
      setLoading(true)
      setError('')
      axios
        .get(`${API_BASE_URL}5000/api/users/${userId}/email-signature`)
        .then((res) => {
          const data = res.data
          if (data) {
            setText(data.text ?? '')
            setImageDataUrl(data.imageDataUrl ?? null)
          } else {
            setText('')
            setImageDataUrl(null)
          }
        })
        .catch((err) => {
          console.error('Ошибка загрузки подписи:', err)
          setError('Не удалось загрузить подпись')
          setText('')
          setImageDataUrl(null)
        })
        .finally(() => setLoading(false))
    }
  }, [open, userId])

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      setImageDataUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImageDataUrl(null)
  }

  const handleSave = () => {
    if (!userId) return
    setSaving(true)
    setError('')
    axios
      .put(`${API_BASE_URL}5000/api/users/${userId}/email-signature`, {
        text,
        imageDataUrl,
      })
      .then(() => {
        onClose()
      })
      .catch((err) => {
        console.error('Ошибка сохранения подписи:', err)
        setError(err.response?.data?.error || 'Не удалось сохранить подпись')
      })
      .finally(() => setSaving(false))
  }

  if (!open) return null

  return (
    <div className="signature-template-modal-overlay" onClick={onClose}>
      <div className="signature-template-modal" onClick={(e) => e.stopPropagation()}>
        <div className="signature-template-modal__header">
          <h3>Шаблон подписи к письму</h3>
          <button type="button" className="signature-template-modal__close" onClick={onClose} aria-label="Закрыть">
            <FaTimes />
          </button>
        </div>
        <p className="signature-template-modal__hint">
          Подпись будет добавлена в конец письма после основного текста и дополнительной информации.
        </p>
        {loading ? (
          <p className="signature-template-modal__loading">Загрузка...</p>
        ) : (
          <>
            <div className="signature-template-modal__field">
              <label>Текст подписи (например: С уважением, имя, телефон)</label>
              <textarea
                className="signature-template-modal__textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder={'С уважением,\nИванов Иван\n+7-777-777-77-77'}
              />
            </div>
            <div className="signature-template-modal__field">
              <label>Рисунок (логотип, подпись — опционально)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="signature-template-modal__file-input"
              />
              {imageDataUrl && (
                <div className="signature-template-modal__image-preview">
                  <img src={imageDataUrl} alt="Подпись" />
                  <button type="button" className="signature-template-modal__remove-img" onClick={handleRemoveImage}>
                    Удалить
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {error && <div className="signature-template-modal__error">{error}</div>}
        <div className="signature-template-modal__actions">
          <button type="button" className="signature-template-modal__btn-cancel" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="signature-template-modal__btn-save"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SignatureTemplateModal
