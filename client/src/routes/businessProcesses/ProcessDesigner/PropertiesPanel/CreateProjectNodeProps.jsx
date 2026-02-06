import { useEffect, useMemo, useState } from 'react'
import { getReferencesUsers } from '../../../../api/businessProcessApi'
import './PropertiesPanel.scss'

const emptyInfoRow = () => ({ key: '', value: '' })

const CreateProjectNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const [users, setUsers] = useState([])

  useEffect(() => {
    getReferencesUsers().then((u) => setUsers(Array.isArray(u) ? u : [])).catch(() => setUsers([]))
  }, [])

  const infoRows = useMemo(
    () => (Array.isArray(settings.additionalInfo) ? settings.additionalInfo : []),
    [settings.additionalInfo]
  )

  const responsibles = useMemo(
    () => (Array.isArray(settings.responsibles) ? settings.responsibles : []),
    [settings.responsibles]
  )

  const handleChange = (patch) => onUpdate({ settings: { ...settings, ...(patch || {}) } })

  const patchInfoRow = (idx, patch) => {
    const next = infoRows.map((r, i) => (i === idx ? { ...(r || emptyInfoRow()), ...(patch || {}) } : r))
    handleChange({ additionalInfo: next })
  }
  const addInfoRow = () => handleChange({ additionalInfo: [...infoRows, emptyInfoRow()] })
  const removeInfoRow = (idx) => handleChange({ additionalInfo: infoRows.filter((_, i) => i !== idx) })

  const patchResponsible = (idx, patch) => {
    const next = responsibles.map((r, i) => (i === idx ? { ...(r || {}), ...(patch || {}) } : r))
    handleChange({ responsibles: next })
  }
  const addResponsible = () => handleChange({ responsibles: [...responsibles, { id: null, role: 'Исполнитель' }] })
  const removeResponsible = (idx) => handleChange({ responsibles: responsibles.filter((_, i) => i !== idx) })

  const goalsText = useMemo(() => {
    const g = Array.isArray(settings.goals) ? settings.goals : []
    return g.join('\n')
  }, [settings.goals])

  const priority = settings.priority || 'medium'

  return (
    <div className="properties-panel__fields">
      <p className="properties-panel__hint">
        Этот блок создаёт <b>Проект</b> (global task) и сохраняет его ID в контексте процесса (как «последний проект»).
        Далее вы можете управлять проектом через блоки «Проект: …», а задачи создавать как <b>подзадачи проекта</b>.
      </p>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Название проекта</label>
        <input
          type="text"
          className="properties-panel__input"
          value={settings.title ?? ''}
          onChange={(e) => handleChange({ title: e.target.value })}
          placeholder="Например: Заявка {доп:order_number}"
        />
        <div className="properties-panel__hint">Поддерживается подстановка: <b>{'{доп:ключ}'}</b></div>
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Описание</label>
        <textarea
          className="properties-panel__input properties-panel__textarea"
          rows={3}
          value={settings.description ?? ''}
          onChange={(e) => handleChange({ description: e.target.value })}
          placeholder="Краткое описание проекта"
        />
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Приоритет</label>
        <select
          className="properties-panel__select"
          value={priority}
          onChange={(e) => handleChange({ priority: e.target.value })}
        >
          <option value="high">Высокий</option>
          <option value="medium">Средний</option>
          <option value="low">Низкий</option>
        </select>
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Дедлайн (опционально)</label>
        <input
          type="datetime-local"
          className="properties-panel__input"
          value={settings.deadline ?? ''}
          onChange={(e) => handleChange({ deadline: e.target.value || null })}
        />
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Цели (каждая строка — цель)</label>
        <textarea
          className="properties-panel__input properties-panel__textarea"
          rows={4}
          value={goalsText}
          onChange={(e) => {
            const lines = String(e.target.value || '')
              .split('\n')
              .map((x) => x.trim())
              .filter(Boolean)
            handleChange({ goals: lines })
          }}
          placeholder={'Например:\n- Уточнить размеры\n- Отправить на склад\n- Закрыть проект'}
        />
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Доп. информация проекта (key → value)</label>
        {infoRows.length === 0 ? (
          <p className="properties-panel__hint">Пока нет полей. Добавьте, если нужно хранить структурированные данные на проекте.</p>
        ) : (
          infoRows.map((r, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 6 }}>
              <input
                type="text"
                className="properties-panel__input"
                style={{ flex: '1 1 0' }}
                value={r?.key ?? ''}
                onChange={(e) => patchInfoRow(idx, { key: e.target.value })}
                placeholder="key"
              />
              <input
                type="text"
                className="properties-panel__input"
                style={{ flex: '1 1 0' }}
                value={r?.value ?? ''}
                onChange={(e) => patchInfoRow(idx, { value: e.target.value })}
                placeholder="value"
              />
              <button type="button" className="properties-panel__btn-remove" onClick={() => removeInfoRow(idx)} title="Удалить">
                −
              </button>
            </div>
          ))
        )}
        <button type="button" className="properties-panel__btn-add" onClick={addInfoRow} style={{ marginTop: 8 }}>
          + Добавить поле
        </button>
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Ответственные проекта</label>
        {responsibles.length === 0 ? (
          <p className="properties-panel__hint">Можно оставить пустым — проект создастся без ответственных.</p>
        ) : (
          responsibles.map((r, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 6 }}>
              <select
                className="properties-panel__select"
                style={{ flex: '1 1 0' }}
                value={r?.id ?? ''}
                onChange={(e) => patchResponsible(idx, { id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">— Выберите пользователя —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="properties-panel__input"
                style={{ flex: '1 1 0' }}
                value={r?.role ?? ''}
                onChange={(e) => patchResponsible(idx, { role: e.target.value })}
                placeholder="Роль (например: Исполнитель)"
              />
              <button type="button" className="properties-panel__btn-remove" onClick={() => removeResponsible(idx)} title="Удалить">
                −
              </button>
            </div>
          ))
        )}
        <button type="button" className="properties-panel__btn-add" onClick={addResponsible} style={{ marginTop: 8 }}>
          + Добавить ответственного
        </button>
      </div>
    </div>
  )
}

export default CreateProjectNodeProps

