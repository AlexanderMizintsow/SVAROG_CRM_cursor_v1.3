import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { FaAndroid, FaTrash, FaUpload } from 'react-icons/fa'
import { API_BASE_URL } from '../../../../config'
import useThemeStore from '../../../store/themeStore'
import './androidAppModal.scss'

const formatSize = (bytes) => {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`
}

const formatWhen = (value) => {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return String(value)
  }
}

/**
 * Модалка скачивания Android APK + загрузка новой версии (только Администратор).
 */
const AndroidAppModal = ({ open, onClose, user }) => {
  const { theme } = useThemeStore()
  const isAdmin = user?.role_name === 'Администратор'
  const fileInputRef = useRef(null)
  const [status, setStatus] = useState({ available: false })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const loadStatus = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.get(`${API_BASE_URL}5000/api/mobile-app/android`)
      setStatus(data || { available: false })
    } catch (err) {
      setError(err?.response?.data?.error || 'Не удалось проверить наличие APK')
      setStatus({ available: false })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadStatus()
  }, [open])

  if (!open) return null

  const handleDownload = () => {
    if (!status.available) return
    window.location.href = `${API_BASE_URL}5000/api/mobile-app/android/download`
  }

  const handlePickFile = () => {
    fileInputRef.current?.click()
  }

  const handleDelete = async () => {
    if (!status.available || !user?.id) return
    if (!window.confirm('Удалить APK с сервера? Скачивание станет недоступно, пока не загрузите новый файл.')) {
      return
    }

    setDeleting(true)
    setError('')
    setInfo('')
    try {
      await axios.delete(`${API_BASE_URL}5000/api/mobile-app/android`, {
        params: { userId: user.id },
      })
      setStatus({ available: false })
      setInfo('APK удалён. Скачивание недоступно, пока не загрузите новый файл.')
    } catch (err) {
      setError(err?.response?.data?.error || 'Не удалось удалить APK')
    } finally {
      setDeleting(false)
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!String(file.name || '').toLowerCase().endsWith('.apk')) {
      setError('Можно загружать только файл с расширением .apk')
      return
    }

    setUploading(true)
    setError('')
    setInfo('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('userId', String(user.id))
      const { data } = await axios.post(
        `${API_BASE_URL}5000/api/mobile-app/android/upload`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setStatus({
        available: true,
        fileName: data.fileName,
        size: data.size,
        uploadedAt: data.uploadedAt,
        uploadedByName: data.uploadedByName,
      })
      setInfo('Новая версия APK сохранена и доступна для скачивания.')
    } catch (err) {
      setError(err?.response?.data?.error || 'Не удалось загрузить APK')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className={`android-app-modal-backdrop ${theme}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`android-app-modal ${theme}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="android-app-modal-title"
      >
        <div className="android-app-modal__header">
          <FaAndroid className="android-app-modal__icon" aria-hidden />
          <h3 id="android-app-modal-title">Мобильное приложение для Android</h3>
          <button type="button" className="android-app-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="android-app-modal__body">
          <p>Скачайте файл на свой мобильный телефон (Android).</p>
          <p>
            <strong>Важно:</strong> телефон может предупредить, что приложение не проверено в Google
            Play и «опасно» или «неизвестно». Это обычное сообщение для APK вне магазина. Приложение
            внутреннее (ПОЗ-сотрудники), опасности не несёт.
          </p>
          <p>
            <strong>Как установить:</strong>
          </p>
          <ol>
            <li>Откройте скачанный файл (обычно в «Загрузки» или уведомлении о скачивании).</li>
            <li>Если система спросит разрешение на установку из этого источника — разрешите.</li>
            <li>
              На предупреждении о неизвестном приложении нажмите «Всё равно установить» /
              «Продолжить» / «Установить» (формулировка зависит от версии Android).
            </li>
            <li>Дождитесь установки и откройте приложение «ПОЗ-сотрудники».</li>
          </ol>

          {loading ? <p className="android-app-modal__muted">Проверка файла…</p> : null}

          {!loading && status.available ? (
            <p className="android-app-modal__meta">
              Файл: <strong>{status.fileName || 'poz-staff.apk'}</strong>
              {status.size ? ` · ${formatSize(status.size)}` : ''}
              {status.uploadedAt ? ` · загружен ${formatWhen(status.uploadedAt)}` : ''}
              {status.uploadedByName ? ` · ${status.uploadedByName}` : ''}
            </p>
          ) : null}

          {!loading && !status.available ? (
            <p className="android-app-modal__warn">
              Файл для скачивания пока не загружен
              {isAdmin ? '. Загрузите APK ниже.' : '. Обратитесь к администратору.'}
            </p>
          ) : null}

          {error ? <p className="android-app-modal__error">{error}</p> : null}
          {info ? <p className="android-app-modal__ok">{info}</p> : null}

          {isAdmin ? (
            <div className="android-app-modal__admin">
              <p className="android-app-modal__admin-title">Администратор</p>
              <p className="android-app-modal__muted">
                Загрузите новый .apk — он заменит предыдущий файл. В git файл не попадает.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div className="android-app-modal__admin-actions">
                <button
                  type="button"
                  className="android-app-modal__btn android-app-modal__btn--secondary"
                  onClick={handlePickFile}
                  disabled={uploading || deleting}
                >
                  <FaUpload aria-hidden /> {uploading ? 'Загрузка…' : 'Загрузить APK'}
                </button>
                {status.available ? (
                  <button
                    type="button"
                    className="android-app-modal__btn android-app-modal__btn--danger"
                    onClick={handleDelete}
                    disabled={uploading || deleting || loading}
                  >
                    <FaTrash aria-hidden /> {deleting ? 'Удаление…' : 'Удалить APK'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="android-app-modal__actions">
          <button type="button" className="android-app-modal__btn android-app-modal__btn--ghost" onClick={onClose}>
            Закрыть
          </button>
          <button
            type="button"
            className="android-app-modal__btn android-app-modal__btn--primary"
            onClick={handleDownload}
            disabled={!status.available || loading}
          >
            Скачать
          </button>
        </div>
      </div>
    </div>
  )
}

export default AndroidAppModal
