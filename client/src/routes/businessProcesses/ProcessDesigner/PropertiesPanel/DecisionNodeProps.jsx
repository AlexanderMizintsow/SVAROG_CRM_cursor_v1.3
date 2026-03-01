/**
 * Свойства блока «Принятие решения».
 * Похож на Уведомление, но ожидает возврата решения (нажатия кнопки) от пользователя.
 */
import { useState, useEffect } from 'react'
import {
  getReferencesUsers,
  getReferencesDepartments,
  getReferencesRoles,
} from '../../../../api/businessProcessApi.js'
import { RECIPIENT_SOURCES } from '../../constants/blockTypes'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import UserCheckboxList from './UserCheckboxList'
import './PropertiesPanel.scss'

const DecisionNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const { scheme } = useBusinessProcessStore()
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])

  const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
  const taskSourceNodes = nodesList.filter(
    (n) => n.type === 'create_task' || n.type === 'assign_task'
  )

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
        console.error(e)
      }
    }
    load()
  }, [])

  const handleChange = (key, value) => {
    onUpdate({ settings: { ...settings, [key]: value } })
  }

  const buttons = Array.isArray(settings.buttons) ? settings.buttons : [{ id: 'approve', label: 'Принять' }, { id: 'reject', label: 'Отклонить' }]

  const handleButtonChange = (idx, field, val) => {
    const next = [...buttons]
    while (next.length <= idx) next.push({ id: `btn_${idx}`, label: '' })
    next[idx] = { ...next[idx], [field]: val }
    handleChange('buttons', next)
  }

  const addButton = () => {
    const id = `btn_${buttons.length}_${Date.now().toString(36)}`
    handleChange('buttons', [...buttons, { id, label: 'Новая кнопка' }])
  }

  const removeButton = (idx) => {
    const next = buttons.filter((_, i) => i !== idx)
    if (next.length === 0) next.push({ id: 'approve', label: 'Принять' })
    handleChange('buttons', next)
  }

  return (
    <div className="properties-panel__fields">
      <p className="properties-panel__hint" style={{ marginBottom: '0.5rem' }}>
        Блок ожидает нажатия одной из кнопок от получателя. Варианты ответа определяются ниже и могут использоваться в развилке для ветвления.
      </p>
      <div className="properties-panel__field">
        <label className="properties-panel__label">Получатели</label>
        <select
          className="properties-panel__select"
          value={settings.recipientSource ?? 'users'}
          onChange={(e) => handleChange('recipientSource', e.target.value)}
        >
          {RECIPIENT_SOURCES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {settings.recipientSource === 'users' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Пользователи</label>
          <UserCheckboxList
            users={users}
            selectedIds={settings.userIds || []}
            onChange={(ids) => handleChange('userIds', ids)}
          />
        </div>
      )}
      {settings.recipientSource === 'department' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Отдел</label>
          <select
            className="properties-panel__select"
            value={settings.departmentId ?? ''}
            onChange={(e) => handleChange('departmentId', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Выберите —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}
      {settings.recipientSource === 'role' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Роль</label>
          <select
            className="properties-panel__select"
            value={settings.roleId ?? ''}
            onChange={(e) => handleChange('roleId', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Выберите —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}
      {settings.recipientSource === 'task_assignee' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Исполнитель задачи из блока</label>
          <select
            className="properties-panel__select"
            value={settings.taskSourceNodeId ?? ''}
            onChange={(e) => handleChange('taskSourceNodeId', e.target.value || null)}
          >
            <option value="">— Выберите блок —</option>
            {taskSourceNodes.map((n) => (
              <option key={n.id} value={n.id}>{n.label || n.type}</option>
            ))}
          </select>
        </div>
      )}
      <div className="properties-panel__field">
        <label className="properties-panel__label">Текст сообщения</label>
        <textarea
          className="properties-panel__textarea"
          value={settings.messageText ?? ''}
          onChange={(e) => handleChange('messageText', e.target.value)}
          placeholder="Подстановки: {инициатор}, {название_процесса}, {доп:ключ}, {{ключ}}"
          rows={4}
        />
        <div className="properties-panel__hint">Подстановка: <b>{'{доп:ключ}'}</b> или <b>{'{{ключ}}'}</b></div>
      </div>
      <div className="properties-panel__field">
        <label className="properties-panel__label">Варианты ответа (кнопки)</label>
        <p className="properties-panel__hint" style={{ marginBottom: '0.35rem' }}>
          ID кнопки используется в развилке для условия «Нажата кнопка ответа».
        </p>
        {buttons.map((btn, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginBottom: '0.35rem' }}>
            <input
              type="text"
              className="properties-panel__input"
              value={btn.id || ''}
              onChange={(e) => handleButtonChange(idx, 'id', e.target.value)}
              placeholder="ID (латиница)"
              style={{ flex: '0 0 120px' }}
            />
            <input
              type="text"
              className="properties-panel__input"
              value={btn.label || ''}
              onChange={(e) => handleButtonChange(idx, 'label', e.target.value)}
              placeholder="Текст на кнопке"
              style={{ flex: 1 }}
            />
            <button type="button" className="properties-panel__btn-remove" onClick={() => removeButton(idx)} title="Удалить">−</button>
          </div>
        ))}
        <button type="button" className="properties-panel__btn-add" onClick={addButton}>+ Добавить кнопку</button>
      </div>
    </div>
  )
}

export default DecisionNodeProps
