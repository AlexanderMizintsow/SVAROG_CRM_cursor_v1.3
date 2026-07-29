import { useEffect, useState } from 'react'
import { FaTrash } from 'react-icons/fa'

/**
 * Админ: справочник категорий и тегов базы знаний.
 */
const KnowledgeTaxonomyAdmin = ({
  open,
  onClose,
  categories = [],
  tags = [],
  onAddCategory,
  onDeleteCategory,
  onAddTag,
  onDeleteTag,
  busy = false,
}) => {
  const [catLabel, setCatLabel] = useState('')
  const [tagName, setTagName] = useState('')

  useEffect(() => {
    if (!open) return
    setCatLabel('')
    setTagName('')
  }, [open])

  if (!open) return null

  const submitCategory = (e) => {
    e.preventDefault()
    if (!catLabel.trim() || busy) return
    onAddCategory(catLabel.trim())
    setCatLabel('')
  }

  const submitTag = (e) => {
    e.preventDefault()
    if (!tagName.trim() || busy) return
    onAddTag(tagName.trim())
    setTagName('')
  }

  return (
    <div className="kb-modal-overlay">
      <div className="kb-modal kb-modal--taxonomy" role="dialog" aria-modal="true">
        <div className="kb-modal__header">
          <h2>Категории и теги</h2>
          <button type="button" className="kb-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="kb-modal__form">
          <p className="kb-modal__hint">
            Справочники общие для всей базы знаний. Менять может только администратор.
            Удаление — только если нет документов с этой категорией / тегом.
          </p>

          <section className="kb-taxonomy">
            <h3>Категории</h3>
            <form className="kb-taxonomy__add" onSubmit={submitCategory}>
              <input
                type="text"
                value={catLabel}
                onChange={(e) => setCatLabel(e.target.value)}
                placeholder="Новая категория"
                maxLength={200}
                disabled={busy}
              />
              <button type="submit" className="kb-btn kb-btn--primary" disabled={busy}>
                Добавить
              </button>
            </form>
            <ul className="kb-taxonomy__list">
              {(categories || []).map((c) => (
                <li key={c.id}>
                  <span title={c.id}>{c.label}</span>
                  <button
                    type="button"
                    className="kb-taxonomy__del"
                    title="Удалить"
                    disabled={busy}
                    onClick={() => onDeleteCategory(c)}
                  >
                    <FaTrash />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="kb-taxonomy">
            <h3>Теги</h3>
            <form className="kb-taxonomy__add" onSubmit={submitTag}>
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Новый тег"
                maxLength={100}
                disabled={busy}
              />
              <button type="submit" className="kb-btn kb-btn--primary" disabled={busy}>
                Добавить
              </button>
            </form>
            <ul className="kb-taxonomy__list">
              {(tags || []).length === 0 ? (
                <li className="kb-taxonomy__empty">Пока нет тегов — добавьте первый</li>
              ) : (
                (tags || []).map((t) => (
                  <li key={t.id}>
                    <span>{t.name}</span>
                    <button
                      type="button"
                      className="kb-taxonomy__del"
                      title="Удалить"
                      disabled={busy}
                      onClick={() => onDeleteTag(t)}
                    >
                      <FaTrash />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <div className="kb-modal__actions">
            <button type="button" className="kb-btn kb-btn--ghost" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KnowledgeTaxonomyAdmin
