import { useCallback, useEffect, useMemo, useState } from 'react'
import { MdOutlineBookmarkAdd, MdOutlineLibraryBooks } from 'react-icons/md'
import { FaPen, FaTrash } from 'react-icons/fa'
import Toastify from 'toastify-js'
import styles from '../AddModal.module.scss'
import { hasAddModalDraftContent } from '../addModalDraft'
import {
  formatOffsetLabel,
  peoplePreview,
  stripHtml,
} from './taskTemplateFields'
import {
  createUserTaskTemplate,
  deleteUserTaskTemplate,
  fetchUserTaskTemplates,
} from './taskTemplateApi'

const showError = (error, fallback) => {
  Toastify({
    text: error?.response?.data?.error || fallback,
    close: true,
    backgroundColor: 'linear-gradient(to right, #8B0000, #ff0000)',
  }).showToast()
}

const showOk = (text) => {
  Toastify({
    text,
    close: true,
    backgroundColor: 'linear-gradient(to right, #0f766e, #14b8a6)',
  }).showToast()
}

const TaskTemplateTools = ({
  userId,
  users,
  isOpen,
  getFormData,
  formToBody,
  onApply,
  onStartEdit,
  templatesVersion,
}) => {
  const [panelOpen, setPanelOpen] = useState(false)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [pendingInsert, setPendingInsert] = useState(null)
  const [deleteCandidateId, setDeleteCandidateId] = useState(null)

  const loadTemplates = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await fetchUserTaskTemplates(userId)
      setTemplates(Array.isArray(data) ? data : [])
    } catch (error) {
      showError(error, 'Не удалось загрузить шаблоны')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!isOpen) {
      setPanelOpen(false)
      setNameDialogOpen(false)
      setPendingInsert(null)
      setDeleteCandidateId(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !panelOpen) return undefined
    loadTemplates()
    return undefined
  }, [isOpen, panelOpen, loadTemplates, templatesVersion])

  const visibleTemplates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return templates
    return templates.filter((template) => {
      const description = stripHtml(template.description).toLowerCase()
      return (
        String(template.name || '').toLowerCase().includes(q) ||
        String(template.title || '').toLowerCase().includes(q) ||
        description.includes(q)
      )
    })
  }, [templates, query])

  const openCreateDialog = () => {
    setNameDraft('')
    setNameDialogOpen(true)
    setPendingInsert(null)
  }

  const saveNewTemplate = async () => {
    const name = nameDraft.trim()
    if (!name || !userId) return
    setSavingName(true)
    try {
      const body = formToBody(getFormData(), name)
      await createUserTaskTemplate(userId, body)
      setNameDialogOpen(false)
      showOk('Шаблон сохранён')
      if (panelOpen) loadTemplates()
    } catch (error) {
      showError(error, 'Не удалось сохранить шаблон')
    } finally {
      setSavingName(false)
    }
  }

  const requestInsert = (template) => {
    const current = getFormData()
    if (hasAddModalDraftContent(current)) {
      setPendingInsert(template)
      return
    }
    onApply(template)
    setPanelOpen(false)
  }

  const confirmInsert = () => {
    if (!pendingInsert) return
    onApply(pendingInsert)
    setPendingInsert(null)
    setPanelOpen(false)
  }

  const removeTemplate = async (template) => {
    try {
      await deleteUserTaskTemplate(userId, template.id)
      setDeleteCandidateId(null)
      setTemplates((prev) => prev.filter((item) => item.id !== template.id))
      showOk('Шаблон удалён')
    } catch (error) {
      showError(error, 'Не удалось удалить шаблон')
    }
  }

  if (!userId) return null

  return (
    <div className={styles.templateLayer}>
      <div className={styles.templateRail}>
        <button
          type="button"
          className={styles.templateRailBtn}
          aria-label="Создать шаблон"
          onClick={openCreateDialog}
        >
          <MdOutlineBookmarkAdd aria-hidden />
          <span className={styles.templateRailTip}>Создать шаблон</span>
        </button>
        <button
          type="button"
          className={`${styles.templateRailBtn} ${styles.templateRailBtnAlt} ${
            panelOpen ? styles.templateRailBtnActive : ''
          }`}
          aria-label="Шаблоны"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((open) => !open)}
        >
          <MdOutlineLibraryBooks aria-hidden />
          <span className={styles.templateRailTip}>Шаблоны</span>
        </button>
      </div>

      {panelOpen && (
        <div className={styles.templatePanel} onMouseDown={(e) => e.stopPropagation()}>
          <div className={styles.templatePanelHeader}>
            <h3>Шаблоны</h3>
            <button
              type="button"
              className={styles.templatePanelClose}
              aria-label="Закрыть шаблоны"
              onClick={() => setPanelOpen(false)}
            >
              ×
            </button>
          </div>
          <p className={styles.templatePanelHint}>
            В шаблон входят поля формы, без файлов. Срок сохранится как «через N дней».
          </p>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти шаблон"
            className={styles.templateSearch}
            autoComplete="off"
          />
          <div className={styles.templateList}>
            {loading && <p className={styles.templateEmpty}>Загрузка…</p>}
            {!loading && visibleTemplates.length === 0 && (
              <p className={styles.templateEmpty}>
                {templates.length === 0
                  ? 'Шаблонов пока нет. Заполните форму и нажмите «Создать шаблон».'
                  : 'Ничего не найдено.'}
              </p>
            )}
            {!loading &&
              visibleTemplates.map((template) => {
                const description = stripHtml(template.description)
                const people = [
                  peoplePreview(users, template.implementerIds),
                  peoplePreview(users, template.approverIds),
                  peoplePreview(users, template.viewerIds),
                ].filter(Boolean)
                const confirmingDelete = deleteCandidateId === template.id
                return (
                  <article key={template.id} className={styles.templateCard}>
                    <button
                      type="button"
                      className={styles.templateCardMain}
                      onClick={() => requestInsert(template)}
                    >
                      <span className={styles.templateCardName}>{template.name}</span>
                      <span className={styles.templateCardTitle}>
                        {template.title?.trim() || 'Без темы'}
                      </span>
                      <span className={styles.templateCardMeta}>
                        <span className={styles.templatePriority}>{template.priority}</span>
                        <span>{formatOffsetLabel(template.deadlineOffsetDays, template.deadlineTime)}</span>
                      </span>
                      {description && (
                        <span className={styles.templateCardText}>{description}</span>
                      )}
                      {people.length > 0 && (
                        <span className={styles.templateCardPeople}>{people.join(' · ')}</span>
                      )}
                    </button>
                    {confirmingDelete ? (
                      <div className={styles.templateCardConfirm}>
                        <span>Удалить шаблон?</span>
                        <button type="button" onClick={() => removeTemplate(template)}>
                          Да
                        </button>
                        <button type="button" onClick={() => setDeleteCandidateId(null)}>
                          Нет
                        </button>
                      </div>
                    ) : (
                      <div className={styles.templateCardActions}>
                        <button
                          type="button"
                          aria-label="Изменить шаблон"
                          title="Изменить"
                          onClick={() => {
                            onStartEdit(template)
                            setPanelOpen(false)
                          }}
                        >
                          <FaPen aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label="Удалить шаблон"
                          title="Удалить"
                          onClick={() => setDeleteCandidateId(template.id)}
                        >
                          <FaTrash aria-hidden />
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
          </div>
        </div>
      )}

      {nameDialogOpen && (
        <div className={styles.templateDialogBackdrop} onMouseDown={(e) => e.stopPropagation()}>
          <div className={styles.templateDialog}>
            <h3>Название шаблона</h3>
            <p>Сохранится то, что сейчас заполнено в форме. Пустые поля можно оставить.</p>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Например, Еженедельный отчёт"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveNewTemplate()
              }}
            />
            <div className={styles.templateDialogActions}>
              <button
                type="button"
                className={styles.templateDialogSave}
                disabled={!nameDraft.trim() || savingName}
                onClick={saveNewTemplate}
              >
                {savingName ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button type="button" onClick={() => setNameDialogOpen(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingInsert && (
        <div className={styles.templateDialogBackdrop} onMouseDown={(e) => e.stopPropagation()}>
          <div className={styles.templateDialog}>
            <h3>Заменить данные формы?</h3>
            <p>
              В форме уже есть заполненные поля. Подставить шаблон «{pendingInsert.name}»?
              Текущие значения будут заменены, задачу это ещё не создаст.
            </p>
            <div className={styles.templateDialogActions}>
              <button type="button" className={styles.templateDialogSave} onClick={confirmInsert}>
                Заменить
              </button>
              <button type="button" onClick={() => setPendingInsert(null)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskTemplateTools
