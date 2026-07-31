import { useEffect, useMemo, useState } from 'react'

const emptyForm = {
  title: '',
  description: '',
  category: '',
  ownerDepartmentId: '',
  visibilityMode: 'all',
  selectedTags: [],
  departmentIds: [],
  userIds: [],
  isFolder: false,
}

const KnowledgeDocumentForm = ({
  open,
  onClose,
  onSubmit,
  saving,
  departments,
  users,
  categories,
  tags = [],
  visibilityModes,
  headDepartmentIds,
  isElevated,
  initial = null,
  overlayClassName = '',
}) => {
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [files, setFiles] = useState([])
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    if (!open) return
    const defaultCategory =
      (categories || []).find((c) => c.id === 'other')?.id ||
      (categories || [])[0]?.id ||
      ''
    if (initial) {
      const selectedTags = (Array.isArray(initial.tags) ? initial.tags : []).filter(Boolean)
      setForm({
        title: initial.title || '',
        description: initial.description || '',
        category: initial.category || defaultCategory,
        ownerDepartmentId: String(initial.ownerDepartmentId || ''),
        visibilityMode: initial.visibilityMode || 'all',
        selectedTags,
        departmentIds: (initial.segments?.departments || []).map(String),
        userIds: (initial.segments?.users || []).map(String),
        isFolder: Boolean(initial.isFolder),
      })
    } else {
      const defaultDept =
        !isElevated && headDepartmentIds?.length === 1
          ? String(headDepartmentIds[0])
          : ''
      setForm({
        ...emptyForm,
        category: defaultCategory,
        ownerDepartmentId: defaultDept,
      })
    }
    setFile(null)
    setFiles([])
    setUserSearch('')
  }, [open, initial, isElevated, headDepartmentIds, categories, tags])

  const ownerOptions = useMemo(() => {
    if (isElevated) return departments
    const allowed = new Set((headDepartmentIds || []).map(String))
    return departments.filter((d) => allowed.has(String(d.id)))
  }, [departments, headDepartmentIds, isElevated])

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    const list = users || []
    if (!q) return list.slice(0, 80)
    return list
      .filter((u) => {
        const name = `${u.last_name || ''} ${u.first_name || ''} ${u.middle_name || ''}`.toLowerCase()
        return name.includes(q)
      })
      .slice(0, 80)
  }, [users, userSearch])

  const tagOptions = useMemo(() => {
    const map = new Map()
    ;(tags || []).forEach((t) => {
      map.set(String(t.name).toLowerCase(), { id: t.id, name: t.name })
    })
    ;(form.selectedTags || []).forEach((name) => {
      const key = String(name).toLowerCase()
      if (!map.has(key)) map.set(key, { id: `legacy-${key}`, name })
    })
    return [...map.values()]
  }, [tags, form.selectedTags])

  if (!open) return null

  const isEdit = Boolean(initial)
  const isFolderMode = Boolean(form.isFolder) && !isEdit
  const titleLocked = isEdit && Boolean(file) && !form.isFolder

  const toggleId = (key, id) => {
    const sid = String(id)
    setForm((prev) => {
      const set = new Set(prev[key])
      if (set.has(sid)) set.delete(sid)
      else set.add(sid)
      return { ...prev, [key]: [...set] }
    })
  }

  const toggleTag = (name) => {
    setForm((prev) => {
      const set = new Set(prev.selectedTags)
      if (set.has(name)) set.delete(name)
      else set.add(name)
      return { ...prev, selectedTags: [...set] }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (!form.ownerDepartmentId) return
    if (!form.category) return
    if (!initial) {
      if (isFolderMode && (!files || files.length === 0)) return
      if (!isFolderMode && !file) return
    }
    onSubmit({
      ...form,
      tags: form.selectedTags.join(', '),
      title: titleLocked ? initial.title || form.title : form.title,
      ownerDepartmentId: titleLocked
        ? String(initial.ownerDepartmentId || form.ownerDepartmentId)
        : form.ownerDepartmentId,
      file: isFolderMode ? null : file,
      files: isFolderMode ? files : file ? [file] : [],
      isFolder: isFolderMode || Boolean(initial?.isFolder),
      isEdit: Boolean(initial),
      id: initial?.id,
    })
  }

  const handleFileChange = (e) => {
    const next = e.target.files?.[0] || null
    setFile(next)
    if (next && initial) {
      setForm((p) => ({
        ...p,
        title: initial.title || p.title,
        ownerDepartmentId: String(initial.ownerDepartmentId || p.ownerDepartmentId),
      }))
    }
  }

  const handleFilesChange = (e) => {
    const list = Array.from(e.target.files || [])
    setFiles(list)
  }

  const removeSelectedFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div
      className={`kb-modal-overlay${overlayClassName ? ` ${overlayClassName}` : ''}`}
    >
      <div className="kb-modal" role="dialog" aria-modal="true">
        <div className="kb-modal__header">
          <h2>
            {initial
              ? initial.isFolder
                ? 'Редактировать папку'
                : 'Редактировать документ'
              : form.isFolder
                ? 'Создать папку'
                : 'Загрузить документ'}
          </h2>
          <button type="button" className="kb-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="kb-modal__form" onSubmit={handleSubmit}>
          {!isEdit ? (
            <div className="kb-modal__mode">
              <p className="kb-modal__seg-title">Тип</p>
              <div className="kb-modal__chips">
                <label className={!form.isFolder ? 'is-on' : ''}>
                  <input
                    type="radio"
                    name="kb-type"
                    checked={!form.isFolder}
                    onChange={() => {
                      setForm((p) => ({ ...p, isFolder: false }))
                      setFiles([])
                    }}
                  />
                  Один документ
                </label>
                <label className={form.isFolder ? 'is-on' : ''}>
                  <input
                    type="radio"
                    name="kb-type"
                    checked={form.isFolder}
                    onChange={() => {
                      setForm((p) => ({ ...p, isFolder: true }))
                      setFile(null)
                    }}
                  />
                  Папка (несколько файлов)
                </label>
              </div>
              {form.isFolder ? (
                <span className="kb-modal__hint">
                  Укажите название папки (например «Фурнитура ФУТУРУСС») и вложите
                  все связанные файлы. Позже можно добавить ещё файлы в карточке.
                </span>
              ) : null}
            </div>
          ) : null}

          <label>
            {form.isFolder || initial?.isFolder ? 'Название папки' : 'Название'}
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
              maxLength={500}
              disabled={titleLocked}
              placeholder={
                form.isFolder || initial?.isFolder
                  ? 'Например: Фурнитура ФУТУРУСС'
                  : 'Например: Регламент согласования счетов'
              }
            />
            {titleLocked && (
              <span className="kb-modal__hint">
                При замене файла название карточки не меняется. Если имя выбранного
                файла отличается от текущего — система попросит подтверждение.
              </span>
            )}
            {isEdit && !file && (
              <span className="kb-modal__hint">
                Переименование карточки — измените название и сохраните без нового
                файла.
              </span>
            )}
          </label>

          <label>
            Описание
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="Кратко, о чём материалы"
            />
          </label>

          <div className="kb-modal__row">
            <label>
              Категория
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                required
              >
                <option value="">Выберите категорию</option>
                {(categories || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Отдел-владелец
              <select
                value={form.ownerDepartmentId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, ownerDepartmentId: e.target.value }))
                }
                required
                disabled={titleLocked}
              >
                <option value="">Выберите отдел</option>
                {ownerOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="kb-modal__seg-title">Теги</p>
            {tagOptions.length === 0 ? (
              <span className="kb-modal__hint">
                Справочник тегов пуст. Администратор может добавить теги в разделе
                «Категории и теги».
              </span>
            ) : (
              <div className="kb-modal__chips">
                {tagOptions.map((t) => {
                  const checked = form.selectedTags.includes(t.name)
                  return (
                    <label key={t.id} className={checked ? 'is-on' : ''}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTag(t.name)}
                      />
                      {t.name}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <label>
            Видимость
            <select
              value={form.visibilityMode}
              onChange={(e) =>
                setForm((p) => ({ ...p, visibilityMode: e.target.value }))
              }
            >
              {(visibilityModes || []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          {form.visibilityMode === 'segments' && (
            <div className="kb-modal__segments">
              <div>
                <p className="kb-modal__seg-title">Отделы</p>
                <div className="kb-modal__chips">
                  {departments.map((d) => {
                    const checked = form.departmentIds.includes(String(d.id))
                    return (
                      <label key={d.id} className={checked ? 'is-on' : ''}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleId('departmentIds', d.id)}
                        />
                        {d.name}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="kb-modal__seg-title">Сотрудники</p>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Поиск по ФИО"
                  className="kb-modal__user-search"
                />
                <div className="kb-modal__chips kb-modal__chips--scroll">
                  {filteredUsers.map((u) => {
                    const checked = form.userIds.includes(String(u.id))
                    const name = `${u.last_name || ''} ${u.first_name || ''}`.trim()
                    return (
                      <label key={u.id} className={checked ? 'is-on' : ''}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleId('userIds', u.id)}
                        />
                        {name || `ID ${u.id}`}
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {isFolderMode ? (
            <label>
              Файлы папки
              <input
                type="file"
                multiple
                onChange={handleFilesChange}
                required={!initial}
              />
              {files.length ? (
                <ul className="kb-modal__file-list">
                  {files.map((f, index) => (
                    <li key={`${f.name}-${index}`}>
                      <span>{f.name}</span>
                      <button
                        type="button"
                        className="kb-btn kb-btn--ghost"
                        onClick={() => removeSelectedFile(index)}
                      >
                        Убрать
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="kb-modal__hint">Можно выбрать несколько файлов сразу</span>
              )}
            </label>
          ) : !initial?.isFolder ? (
            <label>
              Файл{' '}
              {isEdit
                ? '(новый файл = новая версия; название документа не меняется)'
                : ''}
              <input type="file" onChange={handleFileChange} required={!initial} />
            </label>
          ) : (
            <span className="kb-modal__hint">
              Файлы папки добавляются и удаляются в карточке папки.
            </span>
          )}

          <div className="kb-modal__actions">
            <button type="button" className="kb-btn kb-btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="kb-btn kb-btn--primary" disabled={saving}>
              {saving
                ? 'Сохранение…'
                : initial
                  ? 'Сохранить'
                  : form.isFolder
                    ? 'Создать папку'
                    : 'Загрузить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default KnowledgeDocumentForm
