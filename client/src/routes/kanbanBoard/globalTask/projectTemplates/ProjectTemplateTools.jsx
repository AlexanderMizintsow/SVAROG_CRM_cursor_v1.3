import { useCallback, useEffect, useMemo, useState } from 'react'
import { MdOutlineBookmarkAdd, MdOutlineLibraryBooks } from 'react-icons/md'
import { FaPen, FaTrash } from 'react-icons/fa'
import Toastify from 'toastify-js'
import {
  PROJECT_PRIORITY_LABELS,
  formatOffsetLabel,
  projectFormHasContent,
  responsiblesPreview,
} from './projectTemplateFields'
import {
  createUserProjectTemplate,
  deleteUserProjectTemplate,
  fetchUserProjectTemplates,
} from './projectTemplateApi'

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

const ProjectTemplateTools = ({
  userId,
  users,
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
      const data = await fetchUserProjectTemplates(userId)
      setTemplates(Array.isArray(data) ? data : [])
    } catch (error) {
      showError(error, 'Не удалось загрузить шаблоны')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!panelOpen) return undefined
    loadTemplates()
    return undefined
  }, [panelOpen, loadTemplates, templatesVersion])

  const visibleTemplates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return templates
    return templates.filter((template) => {
      const goals = (template.goals || []).join(' ').toLowerCase()
      return (
        String(template.name || '').toLowerCase().includes(q) ||
        String(template.title || '').toLowerCase().includes(q) ||
        String(template.description || '').toLowerCase().includes(q) ||
        goals.includes(q)
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
      await createUserProjectTemplate(userId, body)
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
    if (projectFormHasContent(current)) {
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
      await deleteUserProjectTemplate(userId, template.id)
      setDeleteCandidateId(null)
      setTemplates((prev) => prev.filter((item) => item.id !== template.id))
      showOk('Шаблон удалён')
    } catch (error) {
      showError(error, 'Не удалось удалить шаблон')
    }
  }

  if (!userId) return null

  return (
    <div className="project-template-layer">
      <div className="project-template-rail">
        <button
          type="button"
          className="project-template-rail__btn"
          aria-label="Создать шаблон"
          onClick={openCreateDialog}
        >
          <MdOutlineBookmarkAdd aria-hidden />
          <span className="project-template-rail__tip">Создать шаблон</span>
        </button>
        <button
          type="button"
          className={`project-template-rail__btn project-template-rail__btn--alt ${
            panelOpen ? 'project-template-rail__btn--active' : ''
          }`}
          aria-label="Шаблоны"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((open) => !open)}
        >
          <MdOutlineLibraryBooks aria-hidden />
          <span className="project-template-rail__tip">Шаблоны</span>
        </button>
      </div>

      {panelOpen && (
        <div className="project-template-panel" onMouseDown={(e) => e.stopPropagation()}>
          <div className="project-template-panel__header">
            <h3>Шаблоны</h3>
            <button
              type="button"
              className="project-template-panel__close"
              aria-label="Закрыть шаблоны"
              onClick={() => setPanelOpen(false)}
            >
              ×
            </button>
          </div>
          <p className="project-template-panel__hint">
            В шаблон входят поля формы, без файлов. Срок сохранится как «через N дней».
          </p>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти шаблон"
            className="project-template-search"
            autoComplete="off"
          />
          <div className="project-template-list">
            {loading && <p className="project-template-empty">Загрузка…</p>}
            {!loading && visibleTemplates.length === 0 && (
              <p className="project-template-empty">
                {templates.length === 0
                  ? 'Шаблонов пока нет. Заполните форму и нажмите «Создать шаблон».'
                  : 'Ничего не найдено.'}
              </p>
            )}
            {!loading &&
              visibleTemplates.map((template) => {
                const description = String(template.description || '').trim()
                const goals = (template.goals || []).filter((goal) => String(goal || '').trim())
                const people = responsiblesPreview(users, template.responsibles)
                const confirmingDelete = deleteCandidateId === template.id
                return (
                  <article key={template.id} className="project-template-card">
                    <button
                      type="button"
                      className="project-template-card__main"
                      onClick={() => requestInsert(template)}
                    >
                      <span className="project-template-card__name">{template.name}</span>
                      <span className="project-template-card__title">
                        {template.title?.trim() || 'Без названия'}
                      </span>
                      <span className="project-template-card__meta">
                        <span className="project-template-card__priority">
                          {PROJECT_PRIORITY_LABELS[template.priority] || 'Средний'}
                        </span>
                        <span>
                          {formatOffsetLabel(template.deadlineOffsetDays, template.deadlineTime)}
                        </span>
                      </span>
                      {description && (
                        <span className="project-template-card__text">{description}</span>
                      )}
                      {goals.length > 0 && (
                        <span className="project-template-card__goals">
                          {goals.slice(0, 2).join(' · ')}
                          {goals.length > 2 ? ` +${goals.length - 2}` : ''}
                        </span>
                      )}
                      {people && <span className="project-template-card__people">{people}</span>}
                    </button>
                    {confirmingDelete ? (
                      <div className="project-template-card__confirm">
                        <span>Удалить шаблон?</span>
                        <button type="button" onClick={() => removeTemplate(template)}>
                          Да
                        </button>
                        <button type="button" onClick={() => setDeleteCandidateId(null)}>
                          Нет
                        </button>
                      </div>
                    ) : (
                      <div className="project-template-card__actions">
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
        <div className="project-template-dialog-backdrop" onMouseDown={(e) => e.stopPropagation()}>
          <div className="project-template-dialog">
            <h3>Название шаблона</h3>
            <p>Сохранится то, что сейчас заполнено в форме. Пустые поля можно оставить.</p>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Например, Запуск объекта"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveNewTemplate()
              }}
            />
            <div className="project-template-dialog__actions">
              <button
                type="button"
                className="project-template-dialog__save"
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
        <div className="project-template-dialog-backdrop" onMouseDown={(e) => e.stopPropagation()}>
          <div className="project-template-dialog">
            <h3>Заменить данные формы?</h3>
            <p>
              В форме уже есть заполненные поля. Подставить шаблон «{pendingInsert.name}»? Текущие
              значения будут заменены, проект это ещё не создаст.
            </p>
            <div className="project-template-dialog__actions">
              <button type="button" className="project-template-dialog__save" onClick={confirmInsert}>
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

export default ProjectTemplateTools
