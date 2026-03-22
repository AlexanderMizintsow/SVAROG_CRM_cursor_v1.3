import { useEffect, useMemo, useState } from 'react'
import { getReferencesUsers } from '../../../../api/businessProcessApi'
import { CREATE_PROJECT_MODES } from '../../constants/blockTypes'
import './PropertiesPanel.scss'

const emptyInfoRow = () => ({ key: '', value: '' })

// Значение для input type="datetime-local": дата/время в локальной зоне в формате YYYY-MM-DDTHH:mm
function toDateTimeLocalValue(deadline) {
  if (!deadline) return ''
  const d = new Date(deadline)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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
  const addResponsible = () =>
    handleChange({ responsibles: [...responsibles, { id: null, role: 'Исполнитель', requires_approval: false }] })
  const removeResponsible = (idx) => handleChange({ responsibles: responsibles.filter((_, i) => i !== idx) })

  const goalsText = useMemo(() => {
    const g = Array.isArray(settings.goals) ? settings.goals : []
    return g.map((x) => (x != null ? String(x) : '')).join('\n')
  }, [settings.goals])

  const priority = settings.priority || 'medium'

  const createMode = settings.createMode ?? 'prepared'

  return (
    <div className="properties-panel__fields">
      <p className="properties-panel__hint">
        Этот блок создаёт <b>Проект</b> (global task) и сохраняет его ID в контексте процесса (как «последний проект»).
        Далее вы можете управлять проектом через блоки «Проект: …», а задачи создавать как <b>подзадачи проекта</b>.
      </p>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Режим создания проекта</label>
        <select
          className="properties-panel__select"
          value={createMode}
          onChange={(e) => handleChange({ createMode: e.target.value })}
        >
          {CREATE_PROJECT_MODES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p className="properties-panel__hint">
          {createMode === 'prepared'
            ? 'Проект создаётся сразу при прохождении процесса по данным шаблона ниже.'
            : 'При запуске процесса пользователю откроется окно создания проекта с подставленными данными шаблона.'}
        </p>
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Название проекта</label>
        <input
          type="text"
          className="properties-panel__input"
          value={settings.title ?? ''}
          onChange={(e) => handleChange({ title: e.target.value })}
          placeholder="Например: Заявка {доп:order_number}"
        />
        <div className="properties-panel__hint">Подстановка: <b>{'{доп:ключ}'}</b> или <b>{'{{ключ}}'}</b></div>
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
        <div className="properties-panel__hint">Подстановка: <b>{'{доп:ключ}'}</b> или <b>{'{{ключ}}'}</b></div>
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
        <label className="properties-panel__label">Режим дедлайна</label>
        <select
          className="properties-panel__select"
            value={
              settings.deadlineMode ??
              (settings.deadline
                ? 'fixed'
                : settings.deadlineOffsetFromNowValue != null
                  ? 'offset_from_now'
                  : settings.deadlineStartDayTime
                    ? 'start_day_time'
                    : settings.deadlineOffsetDays != null
                      ? 'offset'
                      : 'none')
            }
          onChange={(e) => {
            const mode = e.target.value
            const patch = { deadlineMode: mode }
            if (mode === 'none') {
              patch.deadline = null
              patch.deadlineStartDayTime = null
              patch.deadlineOffsetDays = null
              patch.deadlineOffsetTime = null
                patch.deadlineOffsetFromNowValue = null
                patch.deadlineOffsetFromNowUnit = null
              patch.conditionalDeadline = null
            } else if (mode === 'fixed') {
              patch.deadlineStartDayTime = null
              patch.deadlineOffsetDays = null
              patch.deadlineOffsetTime = null
                patch.deadlineOffsetFromNowValue = null
                patch.deadlineOffsetFromNowUnit = null
              patch.conditionalDeadline = null
            } else if (mode === 'start_day_time') {
              patch.deadline = null
              patch.deadlineOffsetDays = null
              patch.deadlineOffsetTime = null
              patch.conditionalDeadline = null
                patch.deadlineOffsetFromNowValue = null
                patch.deadlineOffsetFromNowUnit = null
            } else if (mode === 'offset') {
              patch.deadline = null
              patch.deadlineStartDayTime = null
              patch.conditionalDeadline = null
                patch.deadlineOffsetFromNowValue = null
                patch.deadlineOffsetFromNowUnit = null
            } else if (mode === 'conditional') {
              patch.deadline = null
              patch.deadlineStartDayTime = null
              patch.deadlineOffsetDays = null
              patch.deadlineOffsetTime = null
                patch.deadlineOffsetFromNowValue = null
                patch.deadlineOffsetFromNowUnit = null
              patch.conditionalDeadline = {
                boundary: settings.conditionalDeadline?.boundary ?? '12:00',
                sameDayTime: settings.conditionalDeadline?.sameDayTime ?? '18:00',
                nextDayTime: settings.conditionalDeadline?.nextDayTime ?? '16:00',
              }
              } else if (mode === 'offset_from_now') {
                patch.deadline = null
                patch.deadlineStartDayTime = null
                patch.deadlineOffsetDays = null
                patch.deadlineOffsetTime = null
                patch.conditionalDeadline = null
            }
            handleChange(patch)
          }}
        >
          <option value="none">Без дедлайна</option>
          <option value="fixed">Конкретная дата и время</option>
          <option value="start_day_time">Сегодня (от запуска) + время</option>
          <option value="offset">Смещение в днях (от запуска) + время</option>
            <option value="offset_from_now">От текущего времени запуска + (мин/часов)</option>
          <option value="conditional">По условию (граница времени)</option>
        </select>
        {(settings.deadlineMode ?? (settings.deadline ? 'fixed' : 'none')) === 'fixed' && (
          <input
            type="datetime-local"
            className="properties-panel__input"
            value={toDateTimeLocalValue(settings.deadline)}
            onChange={(e) => handleChange({ deadline: e.target.value || null })}
            style={{ marginTop: 6 }}
          />
        )}
        {(settings.deadlineMode ?? '') === 'start_day_time' && (
          <div style={{ marginTop: 8 }}>
            <label className="properties-panel__label" style={{ marginTop: 6 }}>Время (ЧЧ:ММ)</label>
            <input
              type="time"
              className="properties-panel__input"
              value={settings.deadlineStartDayTime ?? '00:00'}
              onChange={(e) => handleChange({ deadlineStartDayTime: e.target.value || '00:00' })}
              style={{ marginTop: 6 }}
            />
            <p className="properties-panel__hint" style={{ marginTop: 4, fontSize: '0.8rem' }}>
              Дата берётся от дня запуска процесса, время — указанное.
            </p>
          </div>
        )}
        {(settings.deadlineMode ?? '') === 'offset' && (
          <div style={{ marginTop: 8 }}>
            <label className="properties-panel__label" style={{ marginTop: 6 }}>Дней от запуска процесса</label>
            <input
              type="number"
              className="properties-panel__input"
              value={settings.deadlineOffsetDays ?? ''}
              onChange={(e) => handleChange({ deadlineOffsetDays: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="0 = сегодня"
              min={0}
              style={{ marginTop: 6 }}
            />
            <label className="properties-panel__label" style={{ marginTop: 6 }}>Время (ЧЧ:ММ)</label>
            <input
              type="time"
              className="properties-panel__input"
              value={settings.deadlineOffsetTime ?? '00:00'}
              onChange={(e) => handleChange({ deadlineOffsetTime: e.target.value || '00:00' })}
              style={{ marginTop: 6 }}
            />
            <p className="properties-panel__hint" style={{ marginTop: 4, fontSize: '0.8rem' }}>
              Дата = день запуска процесса + указанное кол-во дней.
            </p>
          </div>
        )}
        {(settings.deadlineMode ?? '') === 'offset_from_now' && (
          <div style={{ marginTop: 8 }}>
            <label className="properties-panel__label" style={{ marginTop: 6 }}>
              Смещение от времени запуска
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                className="properties-panel__input"
                value={settings.deadlineOffsetFromNowValue ?? ''}
                onChange={(e) =>
                  handleChange({ deadlineOffsetFromNowValue: e.target.value === '' ? null : Number(e.target.value) })
                }
                placeholder="Например: 120"
                min={0}
                style={{ marginTop: 6, flex: '1 1 120px' }}
              />
              <select
                className="properties-panel__select"
                value={settings.deadlineOffsetFromNowUnit ?? 'hours'}
                onChange={(e) => handleChange({ deadlineOffsetFromNowUnit: e.target.value })}
                style={{ marginTop: 6, flex: '0 0 120px' }}
              >
                <option value="hours">Часов</option>
                <option value="minutes">Минут</option>
              </select>
            </div>
            <p className="properties-panel__hint" style={{ marginTop: 4, fontSize: '0.8rem' }}>
              Дедлайн = момент запуска процесса + указанное смещение. Например: запуск в 12:00 и +2 часа → дедлайн 14:00.
            </p>
          </div>
        )}
        {(settings.deadlineMode ?? '') === 'conditional' && (
          <div style={{ marginTop: 8 }}>
            <p className="properties-panel__hint">Если момент обработки ≤ границы — дедлайн сегодня в «Время сегодня»; иначе — завтра в «Время след. дня».</p>
            <label className="properties-panel__label" style={{ marginTop: 6 }}>Граница времени (ЧЧ:ММ)</label>
            <input
              type="text"
              className="properties-panel__input"
              value={settings.conditionalDeadline?.boundary ?? '12:00'}
              onChange={(e) => handleChange({ conditionalDeadline: { ...settings.conditionalDeadline, boundary: e.target.value || '12:00' } })}
              placeholder="12:00"
            />
            <label className="properties-panel__label" style={{ marginTop: 6 }}>Время сегодня (ЧЧ:ММ)</label>
            <input
              type="text"
              className="properties-panel__input"
              value={settings.conditionalDeadline?.sameDayTime ?? '18:00'}
              onChange={(e) => handleChange({ conditionalDeadline: { ...settings.conditionalDeadline, sameDayTime: e.target.value || '18:00' } })}
              placeholder="18:00"
            />
            <label className="properties-panel__label" style={{ marginTop: 6 }}>Время след. дня (ЧЧ:ММ)</label>
            <input
              type="text"
              className="properties-panel__input"
              value={settings.conditionalDeadline?.nextDayTime ?? '16:00'}
              onChange={(e) => handleChange({ conditionalDeadline: { ...settings.conditionalDeadline, nextDayTime: e.target.value || '16:00' } })}
              placeholder="16:00"
            />
          </div>
        )}
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Цели (каждая строка — цель)</label>
        <textarea
          className="properties-panel__input properties-panel__textarea"
          rows={4}
          value={goalsText}
          onChange={(e) => {
            const raw = String(e.target.value ?? '')
            const lines = raw.split('\n')
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
            <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', marginTop: 6 }}>
              <select
                className="properties-panel__select"
                style={{ flex: '1 1 120px' }}
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
                style={{ flex: '1 1 100px' }}
                value={r?.role ?? ''}
                onChange={(e) => patchResponsible(idx, { role: e.target.value })}
                placeholder="Роль"
              />
              <label className="properties-panel__checkbox-row" style={{ flex: '0 0 auto', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={!!r?.requires_approval}
                  onChange={(e) => patchResponsible(idx, { requires_approval: e.target.checked })}
                />
                <span>Согласование</span>
              </label>
              <button type="button" className="properties-panel__btn-remove" onClick={() => removeResponsible(idx)} title="Удалить">
                −
              </button>
            </div>
          ))
        )}
        <button type="button" className="properties-panel__btn-add" onClick={addResponsible} style={{ marginTop: 8 }}>
          + Добавить участника
        </button>
      </div>
    </div>
  )
}

export default CreateProjectNodeProps

