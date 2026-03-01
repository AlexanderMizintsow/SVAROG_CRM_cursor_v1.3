import { useEffect, useMemo, useState } from 'react'
import {
  getReferencesUsers,
  getReferencesDepartments,
  getReferencesRoles,
} from '../../../../api/businessProcessApi'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import './PropertiesPanel.scss'

const SOURCES = [
  { value: 'initiator', label: 'Инициатор процесса' },
  { value: 'users', label: 'Конкретные пользователи' },
  { value: 'department', label: 'Отдел' },
  { value: 'role', label: 'Роль' },
]

function normalizeKey(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\wа-яА-Я0-9_]/g, '')
}

const emptyField = () => ({
  key: '',
  value: '',
  requestAtStart: false,
  requiredAtRuntime: false,
  requiredFor: { source: 'initiator', userIds: [], departmentId: null, roleId: null },
  promptText: '',
  valueSource: { type: 'manual', config: {} },
})

const AdditionalInfoNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const { scheme } = useBusinessProcessStore()
  const fields = useMemo(() => (Array.isArray(settings.fields) ? settings.fields : []), [settings.fields])

  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])

  const nodesList = useMemo(() => (Array.isArray(scheme?.nodes) ? scheme.nodes : []), [scheme?.nodes])
  const decisionNodes = useMemo(() => nodesList.filter((n) => n.type === 'decision'), [nodesList])
  const timerNodes = useMemo(() => nodesList.filter((n) => n.type === 'timer'), [nodesList])

  useEffect(() => {
    const load = async () => {
      try {
        const [u, d, r] = await Promise.all([
          getReferencesUsers().catch(() => []),
          getReferencesDepartments().catch(() => []),
          getReferencesRoles().catch(() => []),
        ])
        setUsers(Array.isArray(u) ? u : [])
        setDepartments(Array.isArray(d) ? d : [])
        setRoles(Array.isArray(r) ? r : [])
      } catch (e) {
        // не ломаем панель настроек
      }
    }
    load()
  }, [])

  const updateFields = (next) => onUpdate({ settings: { ...settings, fields: next } })

  const keysInfo = useMemo(() => {
    const list = fields.map((f) => normalizeKey(f.key)).filter(Boolean)
    const seen = new Set()
    const duplicates = []
    for (const k of list) {
      if (seen.has(k)) duplicates.push(k)
      seen.add(k)
    }
    return { duplicates }
  }, [fields])

  const patchField = (idx, patch) => {
    const next = fields.map((f, i) => (i === idx ? { ...(f || emptyField()), ...patch } : f))
    updateFields(next)
  }

  const addField = () => updateFields([...(fields || []), emptyField()])
  const removeField = (idx) => updateFields(fields.filter((_, i) => i !== idx))

  const renderRequiredFor = (f, idx) => {
    const rf = f.requiredFor || { source: 'initiator' }
    const source = rf.source || 'initiator'

    return (
      <div style={{ marginTop: 6 }}>
        <label className="properties-panel__label" style={{ fontSize: '0.8rem' }}>Кому показывать требование</label>
        <select
          className="properties-panel__select"
          value={source}
          onChange={(e) => patchField(idx, { requiredFor: { ...rf, source: e.target.value } })}
        >
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {source === 'users' && (
          <select
            className="properties-panel__select"
            multiple
            value={Array.isArray(rf.userIds) ? rf.userIds.map(String) : []}
            onChange={(e) => {
              const ids = Array.from(e.target.selectedOptions).map((o) => Number(o.value)).filter((x) => Number.isFinite(x))
              patchField(idx, { requiredFor: { ...rf, userIds: ids } })
            }}
            style={{ marginTop: 6, minHeight: 90 }}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}</option>
            ))}
          </select>
        )}

        {source === 'department' && (
          <select
            className="properties-panel__select"
            value={rf.departmentId ?? ''}
            onChange={(e) => patchField(idx, { requiredFor: { ...rf, departmentId: e.target.value ? Number(e.target.value) : null } })}
            style={{ marginTop: 6 }}
          >
            <option value="">— Выберите —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        {source === 'role' && (
          <select
            className="properties-panel__select"
            value={rf.roleId ?? ''}
            onChange={(e) => patchField(idx, { requiredFor: { ...rf, roleId: e.target.value ? Number(e.target.value) : null } })}
            style={{ marginTop: 6 }}
          >
            <option value="">— Выберите —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}
      </div>
    )
  }

  const renderValueSource = (f, idx) => {
    const vs = f.valueSource && typeof f.valueSource === 'object' ? f.valueSource : { type: 'manual', config: {} }
    const type = vs.type || 'manual'
    const cfg = vs.config && typeof vs.config === 'object' ? vs.config : {}

    const patchVs = (patch) => {
      patchField(idx, { valueSource: { type, config: { ...cfg, ...(patch || {}) } } })
    }

    const setType = (nextType) => {
      // сбрасываем config при смене типа, чтобы не тащить мусор
      patchField(idx, { valueSource: { type: nextType, config: {} } })
    }

    return (
      <div style={{ marginTop: 6 }}>
        <label className="properties-panel__label" style={{ fontSize: '0.8rem' }}>Источник значения</label>
        <select
          className="properties-panel__select"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="manual">Вручную (в этом блоке)</option>
          <option value="decision_last_button_id">Принятие решения: последняя нажатая кнопка (id)</option>
          <option value="decision_last_button_label">Принятие решения: последняя нажатая кнопка (название)</option>
          <option value="decision_node_button_id" disabled={decisionNodes.length === 0}>Принятие решения: конкретный блок (id кнопки)</option>
          <option value="decision_node_button_label" disabled={decisionNodes.length === 0}>Принятие решения: конкретный блок (название кнопки)</option>
          <option value="timer_node_resume_at" disabled={timerNodes.length === 0}>Таймер: время срабатывания (resume_at)</option>
        </select>

        {(type === 'decision_node_button_id' || type === 'decision_node_button_label') && (
          <select
            className="properties-panel__select"
            value={cfg.nodeId || ''}
            onChange={(e) => patchVs({ nodeId: e.target.value || '' })}
            style={{ marginTop: 6 }}
          >
            <option value="">— Выберите блок «Принятие решения» —</option>
            {decisionNodes.map((n) => (
              <option key={n.id} value={n.id}>{n.label || n.id}</option>
            ))}
          </select>
        )}

        {type === 'timer_node_resume_at' && (
          <select
            className="properties-panel__select"
            value={cfg.nodeId || ''}
            onChange={(e) => patchVs({ nodeId: e.target.value || '' })}
            style={{ marginTop: 6 }}
          >
            <option value="">— Выберите блок «Таймер» —</option>
            {timerNodes.map((n) => (
              <option key={n.id} value={n.id}>{n.label || n.id}</option>
            ))}
          </select>
        )}

        <div className="properties-panel__hint">
          Значение будет вычислено при выполнении узла. Если источник ещё не сработал — запишется <b>false</b>.
        </div>
      </div>
    )
  }

  return (
    <div className="properties-panel__fields">
      <p className="properties-panel__hint">
        Блок «Доп. информация» хранит пары <b>ключ → значение</b>. Ключи будут доступны как переменные в схеме
        (для подстановок и условий).
      </p>

      {keysInfo.duplicates.length > 0 && (
        <p className="properties-panel__hint" style={{ color: '#b45309' }}>
          Есть повторяющиеся ключи: {Array.from(new Set(keysInfo.duplicates)).join(', ')}. Лучше сделать ключи уникальными.
        </p>
      )}

      {fields.map((fRaw, idx) => {
        const f = fRaw || emptyField()
        const keyNorm = normalizeKey(f.key)
        return (
          <div key={idx} className="properties-panel__field" style={{ marginTop: 10, paddingLeft: 10, borderLeft: '2px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <label className="properties-panel__label">Ключ</label>
                <input
                  type="text"
                  className="properties-panel__input"
                  value={f.key ?? ''}
                  onChange={(e) => patchField(idx, { key: e.target.value })}
                  onBlur={() => {
                    // Нормализуем по blur, но не ломаем ввод пользователя во время набора
                    const nextKey = normalizeKey(f.key)
                    if (nextKey !== (f.key || '')) patchField(idx, { key: nextKey })
                  }}
                  placeholder="например: part_size_mm"
                />
                {keyNorm && keyNorm !== (f.key || '') && (
                  <div className="properties-panel__hint">Будет сохранено как: <b>{keyNorm}</b></div>
                )}
              </div>

              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <label className="properties-panel__label">Значение (можно оставить пустым)</label>
                <input
                  type="text"
                  className="properties-panel__input"
                  value={f.value ?? ''}
                  onChange={(e) => patchField(idx, { value: e.target.value })}
                  placeholder="например: 1200x800"
                />
                <div className="properties-panel__hint">Пустое значение на сервере трактуется как <b>false</b>.</div>
              </div>

              <button
                type="button"
                className="properties-panel__btn-remove"
                onClick={() => removeField(idx)}
                title="Удалить поле"
                style={{ marginTop: 22 }}
              >
                −
              </button>
            </div>

            <div style={{ marginTop: 8 }}>
              <label className="properties-panel__checkbox-row">
                <input
                  type="checkbox"
                  checked={!!f.requestAtStart}
                  onChange={(e) => patchField(idx, { requestAtStart: e.target.checked })}
                />
                <span>При запуске запрашивать параметры (модальное окно перед стартом)</span>
              </label>
            </div>

            <div style={{ marginTop: 8 }}>
              <label className="properties-panel__checkbox-row">
                <input
                  type="checkbox"
                  checked={!!f.requiredAtRuntime}
                  onChange={(e) => patchField(idx, { requiredAtRuntime: e.target.checked })}
                />
                <span>Требовать заполнение во время выполнения (процесс ждёт, пока не заполнится)</span>
              </label>
            </div>

            {!!f.requiredAtRuntime && (
              <>
                {renderRequiredFor(f, idx)}
                <div style={{ marginTop: 6 }}>
                  <label className="properties-panel__label" style={{ fontSize: '0.8rem' }}>Текст требования (что показать пользователю)</label>
                  <textarea
                    className="properties-panel__textarea"
                    rows={3}
                    value={f.promptText ?? ''}
                    onChange={(e) => patchField(idx, { promptText: e.target.value })}
                    placeholder="Например: Уточните размеры запчасти и заполните поле part_size_mm"
                  />
                </div>
              </>
            )}

            <div style={{ marginTop: 6 }}>
              {renderValueSource(f, idx)}
            </div>
          </div>
        )
      })}

      <button type="button" className="properties-panel__btn-add" onClick={addField} style={{ marginTop: 10 }}>
        + Добавить поле (ключ → значение)
      </button>
    </div>
  )
}

export default AdditionalInfoNodeProps

