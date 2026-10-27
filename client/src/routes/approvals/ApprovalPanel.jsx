import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { API_BASE_URL } from '../../../config'
import { approvalApi, ORDER_EVENTS, SEARCH_BY } from './approvalApi'
import useTaskStateTracker from '../../store/useTaskStateTracker'
import './approvalPanel.scss'

const STEP_HINTS = {
  decision: 'Человек соглашается или отклоняет эту заявку. Отказ только с комментарием. Если не подошло, автор запускает новое согласование.',
  external: 'Шаг без человека. Карточка ждёт одно событие заказа в Альтавин и сама идёт дальше.',
  both: 'Сотрудник согласует, и этот же шаг ждёт событие заказа. Пока событие не наступило, карточка остаётся у него в «Мне».',
  notice: 'Шаг только сообщает людям и сразу идёт дальше. Доступен в общем шаблоне.',
}

const DEADLINE_PRESETS = [
  { hours: 4, label: '4 часа' },
  { hours: 8, label: '8 часов' },
  { hours: 24, label: '1 сутки' },
  { hours: 48, label: '2 суток' },
  { hours: 72, label: '3 суток' },
  { hours: 120, label: '5 суток' },
  { hours: 168, label: '7 суток' },
]

function wordByCount(count, one, few, many) {
  const value = Math.abs(Number(count)) || 0
  const tail = value % 10
  const hundred = value % 100
  if (tail === 1 && hundred !== 11) return one
  if (tail >= 2 && tail <= 4 && (hundred < 12 || hundred > 14)) return few
  return many
}

function deadlinePhrase(hours) {
  const total = Math.round(Number(hours))
  if (!total || total < 1) return ''
  const days = Math.floor(total / 24)
  const rest = total % 24
  const parts = []
  if (days) parts.push(`${days} ${wordByCount(days, 'сутки', 'суток', 'суток')}`)
  if (rest) parts.push(`${rest} ${wordByCount(rest, 'час', 'часа', 'часов')}`)
  return parts.join(' и ')
}

function splitDeadline(hours) {
  const total = Math.max(0, Math.round(Number(hours) || 0))
  return { days: Math.floor(total / 24), hours: total % 24 }
}

function deadlineSelectValue(step) {
  if (step.deadlineCustom) return 'custom'
  const total = Number(step.deadlineHours)
  if (DEADLINE_PRESETS.some((item) => item.hours === total)) return String(total)
  if (total > 0) return 'custom'
  return ''
}

function deadlineHint(step) {
  const phrase = deadlinePhrase(step.deadlineHours)
  if (!phrase) {
    return 'Срок можно не ставить. Тогда напоминания о просрочке не будет. Заявка из-за срока не закрывается.'
  }
  return `Срок ${phrase} начнётся, когда откроется этот шаг, и идёт круглые сутки, включая ночь и выходные. Напоминание придёт один раз автору и тем, кто ещё не ответил, в рабочее время с 8:00 до 18:00. Если срок выйдет ночью, уведомление придёт утром. Заявка сама не закроется и не отклонится.`
}

const emptyStep = () => ({
  title: '',
  stepKind: 'decision',
  assigneeUserIds: [],
  quorum: 'all',
  deadlineHours: '',
  deadlineCustom: false,
  minAmount: '',
  onReject: 'stop',
  checks: [],
  orderEvent: '',
  orderFieldKey: 'order',
  externalMatch: 'all',
})

function blankDraft() {
  return {
    phase: 'free',
    kind: 'free',
    title: '',
    body: '',
    steps: [emptyStep()],
    useOrder: false,
    orderSearchBy: 'orderno',
    orderValue: '',
    amount: '',
    official: false,
    files: [],
  }
}

function personName(person) {
  return `${person.last_name || ''} ${person.first_name || ''}`.trim()
}

function PeoplePicker({ users, selectedIds, onChange }) {
  const [query, setQuery] = useState('')
  const selected = users.filter((person) => selectedIds.includes(person.id))
  const needle = query.trim().toLowerCase()
  const visible = users
    .filter((person) => !needle || personName(person).toLowerCase().includes(needle))
    .slice()
    .sort((a, b) => personName(a).localeCompare(personName(b), 'ru'))
  const toggle = (id) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id])
  }
  return (
    <div className="approval__people">
      <span className="approval__people-title">Кто выполняет шаг</span>
      <div className="approval__chips">
        {selected.map((person) => (
          <button key={person.id} type="button" className="approval__chip" onClick={() => toggle(person.id)}>
            {personName(person)}
            <span aria-hidden="true">×</span>
          </button>
        ))}
        {!selected.length && <span className="approval__hint">Никто не выбран</span>}
      </div>
      <input
        className="approval__people-search"
        value={query}
        placeholder="Фамилия сотрудника"
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="approval__people-list">
          {visible.length === 0 && <p className="approval__hint">Никого не нашли</p>}
          {visible.map((person) => {
            const on = selectedIds.includes(person.id)
            return (
              <button
                key={person.id}
                type="button"
                className={`approval__person ${on ? 'is-on' : ''}`}
                onClick={() => toggle(person.id)}
              >
                <span>{personName(person)}</span>
                <span>{on ? 'Выбран' : ''}</span>
              </button>
            )
          })}
      </div>
    </div>
  )
}

function whenText(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

function StepFacts({ step }) {
  const people = step.assignees || []
  return (
    <div className="approval__facts">
      {people.map((person) => (
        <small key={`${person.userId}-${person.isSubstitute ? 's' : 'o'}`}>
          {person.name || 'Сотрудник'}
          {person.isSubstitute ? ` вместо ${(step.assignees || []).find((item) => item.userId === person.coversUserId)?.name || 'отсутствующего'}` : ''}
          {person.decision === 'approved' && ` · согласовал ${whenText(person.decidedAt)}`}
          {person.decision === 'rejected' && ` · отклонил ${whenText(person.decidedAt)}${person.comment ? `: ${person.comment}` : ''}`}
          {!person.decision && step.status === 'active' && ' · ждёт'}
        </small>
      ))}
      {step.result_comment ? <small>{step.result_comment}</small> : null}
    </div>
  )
}

function StepEditor({ step, index, count, users, official, onChange, onRemove, onUp }) {
  const patch = (part) => onChange({ ...step, ...part })
  return (
    <div className="approval__step">
      <input
        value={step.title}
        onChange={(event) => patch({ title: event.target.value })}
        placeholder={step.stepKind === 'decision' ? 'Название шага, например Бухгалтерия' : 'Название шага, например Ждём производство'}
      />
      <select value={step.stepKind} onChange={(event) => patch({ stepKind: event.target.value })}>
        <option value="decision">Согласование</option>
        <option value="external">Событие заказа</option>
        <option value="both">Согласование и событие</option>
        {official && <option value="notice">Уведомить</option>}
      </select>
      {step.stepKind !== 'external' && (
        <>
          <PeoplePicker users={users} selectedIds={step.assigneeUserIds} onChange={(assigneeUserIds) => patch({ assigneeUserIds })} />
          <select value={step.quorum} onChange={(event) => patch({ quorum: event.target.value })}>
            <option value="all">Нужны все</option>
            <option value="any">Достаточно одного</option>
          </select>
          <p className="approval__hint">
            {step.quorum === 'any'
              ? 'Шаг закроется, как только согласится любой из выбранных. Остальным отвечать уже не нужно. Отказ любого всё равно останавливает заявку.'
              : 'Шаг закроется, только когда согласятся все выбранные. Отказ любого останавливает заявку.'}
          </p>
          <label className="approval__label">
            Срок на ответ
            <select
              value={deadlineSelectValue(step)}
              onChange={(event) => {
                const value = event.target.value
                if (value === 'custom') {
                  const current = Number(step.deadlineHours)
                  patch({ deadlineCustom: true, deadlineHours: current > 0 ? String(current) : '24' })
                  return
                }
                patch({ deadlineCustom: false, deadlineHours: value })
              }}
            >
              <option value="">Без срока</option>
              {DEADLINE_PRESETS.map((item) => (
                <option key={item.hours} value={String(item.hours)}>{item.label}</option>
              ))}
              <option value="custom">Свой срок: дни и часы</option>
            </select>
          </label>
          {deadlineSelectValue(step) === 'custom' && (
            <div className="approval__deadline">
              <label>
                Дни
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={splitDeadline(step.deadlineHours).days}
                  onChange={(event) => {
                    const days = Math.min(60, Math.max(0, Math.floor(Number(event.target.value) || 0)))
                    const hours = splitDeadline(step.deadlineHours).hours
                    const total = days * 24 + hours
                    patch({ deadlineCustom: true, deadlineHours: total ? String(total) : '' })
                  }}
                />
              </label>
              <label>
                Часы, от 0 до 23
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={splitDeadline(step.deadlineHours).hours}
                  onChange={(event) => {
                    const hours = Math.min(23, Math.max(0, Math.floor(Number(event.target.value) || 0)))
                    const days = splitDeadline(step.deadlineHours).days
                    const total = days * 24 + hours
                    patch({ deadlineCustom: true, deadlineHours: total ? String(total) : '' })
                  }}
                />
              </label>
            </div>
          )}
          <p className="approval__hint">{deadlineHint(step)}</p>
        </>
      )}
      {official && (
        <input type="number" min="0" value={step.minAmount} onChange={(event) => patch({ minAmount: event.target.value })} placeholder="Открывать, если сумма от" />
      )}
      {official && index > 0 && (step.stepKind === 'decision' || step.stepKind === 'both') && (
        <select value={step.onReject} onChange={(event) => patch({ onReject: event.target.value })}>
          <option value="stop">Отказ останавливает</option>
          <option value="return">Вернуть на прошлый шаг</option>
        </select>
      )}
      {(step.stepKind === 'external' || step.stepKind === 'both') && (
        <div className="approval__checks">
          {ORDER_EVENTS.map((event) => (
            <label key={event.id}>
              <input
                type="radio"
                name={`order-event-${index}`}
                checked={step.orderEvent === event.id}
                onChange={() => patch({ orderEvent: event.id })}
              />
              {event.label}
            </label>
          ))}
        </div>
      )}
      <div className="approval__step-actions">
        {index > 0 && <button type="button" className="approval__text" onClick={onUp}>Выше</button>}
        {count > 1 && <button type="button" className="approval__text" onClick={onRemove}>Убрать шаг</button>}
      </div>
    </div>
  )
}

function stepChecks(step) {
  const value = step?.checks
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      return []
    }
  }
  return []
}

function waitsOrder(step) {
  return step?.step_kind === 'decision' && stepChecks(step).length > 0
}

function canDecideStep(step, userId) {
  return (step?.assignees || []).some((person) => Number(person.userId) === Number(userId) && !person.decision)
}

function orderStateText(step) {
  const snap = step.external_snapshot
  if (!snap || snap.found === 'none') return snap?.error || 'Заказ не найден'
  if (snap.found === 'many') return 'Найдено несколько заказов'
  const order = snap.order || {}
  const wait = (snap.checks || []).filter((item) => !item.passed).map((item) => item.detail).join('; ')
  const name = order.orderNo ? `Заказ «${order.orderNo}»` : 'Заказ найден'
  return wait ? `Событие ещё не наступило: ${wait}. ${name}` : `Событие наступило. ${name}`
}

function idList(value) {
  if (Array.isArray(value)) return value.map(Number).filter(Boolean)
  if (typeof value === 'string') {
    return value.replace(/[{}]/g, '').split(',').map(Number).filter(Boolean)
  }
  return []
}

function routeKind(step) {
  const kind = step.step_kind || step.stepKind
  if (kind === 'notice') return 'Уведомление'
  if (kind === 'external') return 'Событие заказа'
  if (stepChecks(step).length) return 'Согласование и событие'
  return 'Согласование'
}

function routeEvent(step) {
  const check = stepChecks(step)[0]
  if (!check) return ''
  const code = check.check_code || check.code
  return ORDER_EVENTS.find((event) => event.code === code)?.label || ''
}

function searchLabel(id) {
  return SEARCH_BY.find((item) => item.id === id)?.label || 'Наименование заказа'
}

function stepFromStored(step) {
  const checks = stepChecks(step)
  const kind = step.step_kind || 'decision'
  const stepKind = kind === 'decision' && checks.length ? 'both' : kind
  const code = checks[0]?.check_code || checks[0]?.code
  const orderEvent = ORDER_EVENTS.find((event) => event.code === code)?.id || ''
  let enter = step.enter_rule
  if (typeof enter === 'string') {
    try {
      enter = JSON.parse(enter)
    } catch (error) {
      enter = null
    }
  }
  const minAmount = enter && enter.value != null && enter.value !== '' ? String(enter.value) : ''
  const hours = Number(step.deadline_hours)
  const hasHours = hours > 0
  return {
    ...emptyStep(),
    title: step.title || '',
    stepKind,
    assigneeUserIds: idList(step.assignee_user_ids),
    quorum: step.quorum === 'any' ? 'any' : 'all',
    deadlineHours: hasHours ? String(hours) : '',
    deadlineCustom: hasHours && !DEADLINE_PRESETS.some((item) => item.hours === hours),
    minAmount,
    onReject: step.on_reject === 'return' ? 'return' : 'stop',
    orderEvent,
  }
}

function storedSearchBy(fields) {
  const field = (fields || []).find((item) => item.field_key === 'order' || item.fieldKey === 'order')
  let config = field?.config
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config)
    } catch (error) {
      config = {}
    }
  }
  const id = config?.searchBy
  return SEARCH_BY.some((item) => item.id === id) ? id : 'orderno'
}

function routePeople(step, users) {
  const kind = step.step_kind || step.stepKind
  if (kind === 'external') return 'Сотрудник не нужен'
  const names = idList(step.assignee_user_ids || step.assigneeUserIds).map((id) => {
    const person = users.find((item) => Number(item.id) === Number(id))
    return person ? personName(person) : ''
  }).filter(Boolean)
  return names.length ? names.join(', ') : 'Исполнитель не указан'
}

function routeExtra(step) {
  const kind = step.step_kind || step.stepKind
  if (kind === 'external' || kind === 'notice') return ''
  const quorum = (step.quorum === 'any') ? 'Достаточно одного согласия' : 'Нужны согласия всех'
  const hours = step.deadline_hours || step.deadlineHours
  const phrase = deadlinePhrase(hours)
  return phrase ? `${quorum} · срок ${phrase}` : quorum
}

function stepLine(row) {
  const index = Number(row.sort_order || 0) + 1
  const total = Number(row.step_count || 0)
  if (row.waits_order) return `шаг ${index} из ${total} · ${row.step_title || 'шаг'} · согласование и событие`
  if (row.step_kind === 'external') return `шаг ${index} из ${total} · ждём событие заказа`
  return `шаг ${index} из ${total} · ${row.step_title || 'шаг'}`
}

function stateLine(card, steps) {
  const active = steps.find((step) => step.status === 'active')
  if (!active) return card.outcome_text || ''
  const index = steps.findIndex((step) => step.id === active.id) + 1
  const names = (active.assignees || []).map((person) => person.name).filter(Boolean).join(', ')
  if (active.step_kind === 'external' || waitsOrder(active)) {
    return `Сейчас шаг ${index} из ${steps.length}. ${orderStateText(active)}${names ? `. ${names}` : ''}`
  }
  return `Сейчас шаг ${index} из ${steps.length}. ${active.title}${names ? `. ${names}` : ''}`
}

export default function ApprovalPanel({ userId, dark }) {
  const [tab, setTab] = useState('inbox')
  const [mode, setMode] = useState('list')
  const [shown, setShown] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('approval-panel-open', shown)
    return () => document.body.classList.remove('approval-panel-open')
  }, [shown])
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [card, setCard] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [comment, setComment] = useState('')
  const [chat, setChat] = useState('')
  const [users, setUsers] = useState([])
  const [templates, setTemplates] = useState([])
  const [templateKind, setTemplateKind] = useState('personal')
  const [dropTemplateId, setDropTemplateId] = useState(null)
  const [canOfficial, setCanOfficial] = useState(false)
  const [officialForAll, setOfficialForAll] = useState(false)
  const [draft, setDraft] = useState(null)
  const [completed, setCompleted] = useState(null)
  const [admin, setAdmin] = useState(false)
  const [logs, setLogs] = useState([])
  const [doneKind, setDoneKind] = useState('done')
  const [authorNote, setAuthorNote] = useState('')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const cardRef = useRef(null)
  const modeRef = useRef('list')
  const chatLogRef = useRef(null)

  const applyTemplates = (data) => {
    const list = Array.isArray(data) ? data : (data?.templates || [])
    setTemplates(list)
    setCanOfficial(Boolean(data?.canOfficial))
    setOfficialForAll(Boolean(data?.officialForAll))
  }

  const loadLists = async () => {
    const [inbox, mine] = await Promise.all([approvalApi.inbox(userId), approvalApi.mine(userId)])
    setCount(inbox.length)
    setRows(tab === 'mine' ? mine.filter((row) => !row.mine_now) : inbox)
  }

  useEffect(() => {
    if (!userId) return
    loadLists().catch((err) => setError(err.response?.data?.message || 'Не удалось открыть согласования'))
    axios.get(`${API_BASE_URL}5000/api/users`).then((res) => setUsers(res.data || [])).catch(() => {})
    approvalApi.templates(userId).then(applyTemplates).catch(() => {})
    approvalApi.checkLogs(userId).then((data) => {
      setAdmin(Boolean(data?.admin))
      setLogs(data?.rows || [])
    }).catch(() => setAdmin(false))
  }, [userId, tab])

  useEffect(() => {
    cardRef.current = card
    modeRef.current = mode
    const node = chatLogRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [card, mode])

  useEffect(() => {
    if (!userId) return undefined
    const onUpdate = async (event) => {
      const cardId = Number(event.detail?.cardId)
      const kind = event.detail?.kind
      if (!cardId || modeRef.current === 'create') return
      loadLists().catch(() => {})
      const openId = Number(cardRef.current?.card?.id)
      const sameCard = openId === cardId
      const incoming = kind === 'chat' || kind === 'file'
      if (!incoming && !sameCard) return
      try {
        const data = await approvalApi.card(cardId, userId)
        setCard(data)
        setMode('card')
        setShown(true)
      } catch (err) {
        if (sameCard) {
          setCard(null)
          setMode('list')
        }
      }
    }
    const onOpen = (event) => {
      const cardId = Number(event.detail?.cardId)
      if (cardId) openCard(cardId)
    }
    const onTemplates = () => {
      approvalApi.templates(userId).then(applyTemplates).catch(() => {})
    }
    window.addEventListener('approval-updated', onUpdate)
    window.addEventListener('approval-templates', onTemplates)
    const onLinked = (event) => {
      const cardId = Number(event.detail?.cardId)
      if (!cardId || !cardRef.current || Number(cardRef.current.card?.id) !== cardId) return
      approvalApi.card(cardId, userId).then(setCard).catch(() => {})
    }
    window.addEventListener('approval-open', onOpen)
    window.addEventListener('approval-linked', onLinked)
    return () => {
      window.removeEventListener('approval-updated', onUpdate)
      window.removeEventListener('approval-templates', onTemplates)
      window.removeEventListener('approval-open', onOpen)
      window.removeEventListener('approval-linked', onLinked)
    }
  }, [userId, tab])

  useEffect(() => {
    setAuthorNote(card?.card?.author_note || '')
  }, [card?.card?.id, card?.card?.author_note])

  const openCard = async (id) => {
    setShown(true)
    setError('')
    setBusy(true)
    try {
      const data = await approvalApi.card(id, userId)
      setCard(data)
      setMode('card')
      setComment('')
    } catch (err) {
      setError(err.response?.data?.message || 'Не удалось открыть заявку')
    } finally {
      setBusy(false)
    }
  }

  const markDone = async (done) => {
    if (!card?.card?.id) return
    setError('')
    setBusy(true)
    try {
      const result = await approvalApi.setAuthorDone(card.card.id, userId, done)
      setCard({ ...card, card: { ...card.card, author_done_at: result.authorDoneAt } })
      setCompleted((rows) => (
        Array.isArray(rows)
          ? rows.map((row) => (row.id === card.card.id ? { ...row, author_done_at: result.authorDoneAt } : row))
          : rows
      ))
    } catch (err) {
      setError(err.response?.data?.message || 'Не удалось сохранить отметку')
    } finally {
      setBusy(false)
    }
  }

  const saveAuthorNote = async () => {
    if (!card?.card?.id) return
    setError('')
    setBusy(true)
    try {
      const result = await approvalApi.setAuthorNote(card.card.id, userId, authorNote)
      setCard({ ...card, card: { ...card.card, author_note: result.note } })
    } catch (err) {
      setError(err.response?.data?.message || 'Не удалось сохранить заметку')
    } finally {
      setBusy(false)
    }
  }

  const openLinkedTask = (taskId) => {
    useTaskStateTracker.getState().setTaskCardBlinkYellow(taskId)
    useTaskStateTracker.getState().setTaskDecisionNavigate({ type: 'taskList', initialTab: 'created' })
    window.dispatchEvent(new CustomEvent('task-decision-navigate'))
  }

  const openLinkedProject = (globalTaskId) => {
    useTaskStateTracker.getState().setTaskDecisionNavigate({ type: 'project', globalTaskId })
    window.dispatchEvent(new CustomEvent('task-decision-navigate'))
  }

  const refreshCard = async () => {
    if (!card) return
    setCard(await approvalApi.card(card.card.id, userId))
    await loadLists()
  }

  const act = async (fn) => {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await fn()
      await refreshCard()
    } catch (err) {
      setError(err.response?.data?.message || 'Не получилось выполнить действие')
    } finally {
      setBusy(false)
    }
  }

  const active = card?.steps?.find((step) => step.status === 'active')
  const myTurn = canDecideStep(active, userId)
  const iApproved = (active?.assignees || []).some((person) => Number(person.userId) === Number(userId) && person.decision === 'approved')

  const startNew = () => {
    setDraft({ phase: 'pick' })
    setMode('create')
  }

  const dropMissingTemplate = (err, templateId) => {
    const missing = err.response?.status === 404 || err.response?.data?.message === 'Шаблон не найден'
    if (!missing) return false
    setTemplates((list) => list.filter((item) => Number(item.id) !== Number(templateId)))
    setDropTemplateId(null)
    setError('Этот шаблон уже удалён')
    return true
  }

  const editTemplate = async (templateId) => {
    const data = await approvalApi.template(templateId, userId)
    const steps = (data.steps || []).map(stepFromStored)
    const useOrder = steps.some((step) => step.stepKind === 'external' || step.stepKind === 'both')
    setDropTemplateId(null)
    setDraft({
      phase: 'free',
      editingId: data.template.id,
      title: data.template.title || '',
      body: data.template.hint || '',
      steps: steps.length ? steps : [emptyStep()],
      useOrder,
      orderSearchBy: storedSearchBy(data.fields),
      orderValue: '',
      amount: '',
      official: data.template.scope === 'official' && canOfficial,
      files: [],
      saved: false,
    })
  }

  const removeTemplate = async (templateId) => {
    setError('')
    try {
      await approvalApi.deleteTemplate(templateId, userId)
      setDropTemplateId(null)
      if (Number(draft?.editingId) === Number(templateId)) setDraft({ phase: 'templates' })
      applyTemplates(await approvalApi.templates(userId))
    } catch (err) {
      setError(err.response?.data?.message || 'Не получилось удалить шаблон')
    }
  }

  const openTemplate = async (templateId) => {
    const data = await approvalApi.template(templateId, userId)
    const route = data.steps || []
    setDraft({
      phase: 'template',
      templateId,
      title: data.template?.title || '',
      body: data.template?.hint || '',
      route,
      useOrder: route.some((step) => step.step_kind === 'external' || (step.step_kind === 'decision' && (step.checks || []).length)),
      orderSearchBy: storedSearchBy(data.fields),
      orderValue: '',
      amount: '',
      files: [],
    })
  }

  const mapStep = (step, index, official) => ({
    title: step.title,
    stepKind: step.stepKind === 'both' ? 'decision' : step.stepKind,
    assigneeMode: 'users',
    assigneeUserIds: step.assigneeUserIds,
    quorum: step.quorum,
    deadlineHours: step.deadlineHours ? Number(step.deadlineHours) : null,
    onReject: official ? step.onReject : 'stop',
    returnToSortOrder: official && step.onReject === 'return' ? Math.max(0, index - 1) : null,
    externalMatch: step.externalMatch,
    enterRule: step.minAmount !== '' && step.minAmount != null
      ? { source: 'field', fieldKey: 'amount', op: 'gte', value: Number(step.minAmount) }
      : null,
    orderFieldKey: 'order',
    checks: step.stepKind === 'external' || step.stepKind === 'both'
      ? ORDER_EVENTS.filter((event) => event.id === step.orderEvent).map((event) => ({ code: event.code, params: event.params }))
      : [],
  })

  const submitDraft = async () => {
    setError('')
    try {
      if (draft.phase === 'template' && (draft.route || []).some((step) => step.step_kind === 'external' || (step.step_kind === 'decision' && (step.checks || []).length)) && !draft.orderValue.trim()) {
        setError(`Укажите: ${searchLabel(draft.orderSearchBy)}`)
        return
      }
      if (draft.phase === 'free') {
        for (const step of draft.steps) {
          const title = step.title || 'без названия'
          if ((step.stepKind === 'decision' || step.stepKind === 'both' || step.stepKind === 'notice') && !step.assigneeUserIds.length) {
            setError(`Укажите, кто выполняет шаг «${title}»`)
            return
          }
          if ((step.stepKind === 'external' || step.stepKind === 'both') && !step.orderEvent) {
            setError(`Выберите событие заказа на шаге «${title}»`)
            return
          }
        }
        if (!draft.official && draft.steps.some((step) => step.stepKind === 'notice')) {
          setError('Уведомление ставится только в общем шаблоне')
          return
        }
        if (draft.steps.some((step) => step.stepKind === 'external' || step.stepKind === 'both') && !draft.orderValue.trim()) {
          setError(`Укажите: ${searchLabel(draft.orderSearchBy)}`)
          return
        }
      }
      const fields = []
      if (draft.useOrder) {
        fields.push({
          fieldKey: 'order',
          label: searchLabel(draft.orderSearchBy),
          fieldType: 'order_ref',
          valueJson: { searchBy: draft.orderSearchBy, searchValue: draft.orderValue },
        })
      }
      if (draft.amount !== '' && draft.amount != null) {
        fields.push({ fieldKey: 'amount', label: 'Сумма', fieldType: 'number', valueNumber: Number(draft.amount) })
      }
      const created = await approvalApi.create({
        userId,
        templateId: draft.phase === 'template' ? draft.templateId : null,
        title: draft.title,
        body: draft.body,
        fields,
        steps: draft.phase === 'free' ? draft.steps.map((step, index) => mapStep(step, index, draft.official)) : undefined,
      })
      for (const file of draft.files) {
        await approvalApi.upload(created.id, userId, file)
      }
      setDraft(null)
      await openCard(created.id)
      await loadLists()
    } catch (err) {
      setError(err.response?.data?.message || 'Не удалось создать заявку')
    }
  }

  const saveDraftTemplate = async () => {
    setError('')
    try {
      const asOfficial = canOfficial && draft.official
      const body = {
        userId,
        scope: asOfficial ? 'official' : 'personal',
        title: draft.title,
        hint: draft.body || '',
        fields: draft.useOrder ? [{
          fieldKey: 'order',
          label: searchLabel(draft.orderSearchBy),
          fieldType: 'order_ref',
          config: { searchBy: draft.orderSearchBy },
        }] : [],
        steps: draft.steps.map((step, index) => mapStep(step, index, asOfficial)),
      }
      if (draft.editingId) await approvalApi.updateTemplate(draft.editingId, body)
      else await approvalApi.saveTemplate(body)
      applyTemplates(await approvalApi.templates(userId))
      setDraft({ ...draft, saved: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Не получилось сохранить шаблон')
    }
  }

  const finishedRows = (completed || []).filter((row) => (
    doneKind === 'rejected' ? row.status === 'rejected' : row.status !== 'rejected'
  ))

  const openLogs = async () => {
    const data = await approvalApi.checkLogs(userId)
    setAdmin(Boolean(data?.admin))
    setLogs(data?.rows || [])
    setMode('logs')
  }

  const openCompleted = async (value = month, kind = doneKind) => {
    setMonth(value)
    setDoneKind(kind)
    setCompleted(await approvalApi.completed(userId, value))
    setMode('done')
  }

  const drawer = (
    <div className={`approval-dock ${shown ? 'is-open' : ''}`}>
      <button type="button" className="approval-dock__tab" onClick={() => setShown((value) => !value)}>
        <span className="approval-dock__label">Согласования</span>
      </button>
    <aside className={`approval ${dark ? 'approval--dark' : ''}`}>
      <header className="approval__bar">
        <strong>Согласования{count ? ` ${count}` : ''}</strong>
        {mode === 'list' && <button type="button" className="approval__add" onClick={startNew}>Новая</button>}
        {mode !== 'list' && (
          <button type="button" className="approval__add" onClick={() => { setMode('list'); setCard(null); setCompleted(null); setDraft(null) }}>
            Назад
          </button>
        )}
      </header>

      {busy && <p className="approval__hint">Подождите…</p>}
      {error && <p className="approval__error">{error}</p>}

      {mode === 'list' && (
        <div className="approval__body">
          <div className="approval__tabs">
            <button type="button" className={tab === 'inbox' ? 'is-on' : ''} onClick={() => setTab('inbox')}>Мне{count ? ` ${count}` : ''}</button>
            <button type="button" className={tab === 'mine' ? 'is-on' : ''} onClick={() => setTab('mine')}>Мои</button>
          </div>
          <div className="approval__tabs">
            <button type="button" onClick={() => openCompleted(month, 'done')}>Завершённые</button>
            <button type="button" onClick={() => openCompleted(month, 'rejected')}>Отклонённые</button>
            {admin && <button type="button" onClick={openLogs}>Журнал</button>}
          </div>
          {!rows.length && <p className="approval__empty">Здесь появятся согласования</p>}
          {rows.map((row) => (
            <button type="button" key={row.id} className={`approval__row ${tab === 'inbox' ? 'is-mine' : ''}`} onClick={() => openCard(row.id)}>
              <span className="approval__row-title">{row.title}</span>
              <span className="approval__row-meta">{stepLine(row)}</span>
              <span className="approval__row-source">{row.source === 'free' ? 'свободное' : 'по шаблону'}</span>
            </button>
          ))}
          {templates.some((item) => item.scope !== 'official') && (
            <p className="approval__hint">Мои шаблоны: {templates.filter((item) => item.scope !== 'official').map((item) => item.title).join(', ')}</p>
          )}
        </div>
      )}

      {mode === 'card' && card && (
        <div className="approval__body approval__body--card">
          <div className="approval__main">
          <h2>{card.card.title}</h2>
          {card.card.status === 'approved' && card.card.author_done_at && (
            <p className="approval__done-banner">Автор отметил: сделано · {whenText(card.card.author_done_at)}</p>
          )}
          <p className="approval__state">{stateLine(card.card, card.steps)}</p>
          {card.card.status === 'approved' && Number(card.card.author_user_id) === Number(userId) && (
            <div className="approval__after">
              <button type="button" className="approval__done" onClick={() => markDone(!card.card.author_done_at)}>
                {card.card.author_done_at ? 'Снять отметку' : 'Отметить как сделано'}
              </button>
              <label className="approval__label">
                Личная заметка
                <textarea className="approval__note" value={authorNote} onChange={(event) => setAuthorNote(event.target.value)} />
              </label>
              <p className="approval__hint">Эту заметку видите только вы. Участники её не увидят.</p>
              <button type="button" className="approval__text" onClick={saveAuthorNote}>Сохранить заметку</button>
              {card.card.links?.taskId ? (
                <button type="button" className="approval__text" onClick={() => openLinkedTask(card.card.links.taskId)}>Открыть задачу</button>
              ) : (
                <button
                  type="button"
                  className="approval__text"
                  onClick={() => window.dispatchEvent(new CustomEvent('approval-create-task', {
                    detail: { cardId: card.card.id, title: card.card.title, description: card.card.body || '' },
                  }))}
                >
                  Создать задачу
                </button>
              )}
              {card.card.links?.globalTaskId ? (
                <button type="button" className="approval__text" onClick={() => openLinkedProject(card.card.links.globalTaskId)}>Открыть проект</button>
              ) : (
                <button
                  type="button"
                  className="approval__text"
                  onClick={() => window.dispatchEvent(new CustomEvent('approval-create-project', {
                    detail: { cardId: card.card.id, title: card.card.title, description: card.card.body || '' },
                  }))}
                >
                  Создать проект
                </button>
              )}
            </div>
          )}
          {card.card.body && <p>{card.card.body}</p>}
          <ol className="approval__route">
            {card.steps.map((step) => (
              <li key={step.id} className={`approval__step is-${step.status}`}>
                <span>{step.title}</span>
                <small>
                  {step.status === 'active' && 'сейчас'}
                  {step.status === 'done' && (step.result || 'готово')}
                  {step.status === 'rejected' && 'отказ'}
                  {step.status === 'skipped' && 'пропущен'}
                  {step.status === 'pending' && 'дальше'}
                  {step.acted_at ? ` · ${whenText(step.acted_at)}` : ''}
                  {step.status === 'active' && step.due_at ? ` · напоминание ${whenText(step.due_at)}` : ''}
                </small>
                <StepFacts step={step} />
                {step.status === 'active' && waitsOrder(step) && canDecideStep(step, userId) && (
                  <div className="approval__actions">
                    <button type="button" className="approval__primary" onClick={() => act(() => approvalApi.decide(card.card.id, step.id, userId, 'approved', comment))}>Согласовать</button>
                    <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий к отказу" />
                    <button type="button" className="approval__text" onClick={() => act(() => approvalApi.decide(card.card.id, step.id, userId, 'rejected', comment))}>Отклонить</button>
                  </div>
                )}
                {step.status === 'active' && (step.step_kind === 'external' || waitsOrder(step)) && (
                  <div className="approval__snap">
                    <p>{orderStateText(step)}</p>
                    {waitsOrder(step) && iApproved ? <p>Вы согласовали. Событие ещё не наступило, карточка остаётся у вас.</p> : null}
                    <small>{step.external_checked_at ? `Проверено ${new Date(step.external_checked_at).toLocaleString()}` : 'Ещё не проверяли'}</small>
                    {(canDecideStep(step, userId) || iApproved || Number(card.card.author_user_id) === Number(userId)) ? (
                      <div className="approval__actions">
                        <button type="button" className="approval__primary" onClick={() => act(() => approvalApi.check(card.card.id, step.id, userId, false))}>Проверить сейчас</button>
                        <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Почему закрываете вручную" />
                        <button type="button" className="approval__text" onClick={() => act(() => approvalApi.check(card.card.id, step.id, userId, true, comment))}>Закрыть вручную</button>
                      </div>
                    ) : null}
                  </div>
                )}
                {step.status === 'active' && step.step_kind === 'decision' && !waitsOrder(step) && canDecideStep(step, userId) && (
                  <div className="approval__actions">
                    <button type="button" className="approval__primary" onClick={() => act(() => approvalApi.decide(card.card.id, step.id, userId, 'approved', comment))}>Согласовать</button>
                    <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий к отказу" />
                    <button type="button" className="approval__text" onClick={() => act(() => approvalApi.decide(card.card.id, step.id, userId, 'rejected', comment))}>Отклонить</button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {card.card.author_user_id === userId && card.card.status === 'running' && (
            <button type="button" className="approval__text" onClick={() => act(() => approvalApi.cancel(card.card.id, userId))}>Отменить заявку</button>
          )}
          </div>
          <section className="approval__dock">
            <div className="approval__files">
              <span className="approval__box-title">Файлы</span>
              {(card.files || []).length === 0 && <p className="approval__hint">Файлов пока нет</p>}
              {(card.files || []).map((file) => (
                <a key={file.id} href={approvalApi.fileUrl(file.id, userId)}>{file.file_name}</a>
              ))}
            </div>
            <div className="approval__chat">
              <span className="approval__box-title">Чат</span>
              {card.card.status !== 'running' && <p className="approval__hint">Заявка уже завершена. Чат и файлы остаются общими.</p>}
              <div className="approval__chat-log" ref={chatLogRef}>
                {(card.messages || []).map((message) => {
                  const mine = Number(message.author_user_id) === Number(userId)
                  const side = message.author_user_id == null ? 'is-system' : mine ? 'is-mine' : 'is-other'
                  return (
                    <p key={message.id} className={`approval__msg ${side}`}>
                      <b>{mine ? 'Вы' : (message.author_name || 'Система')}</b>
                      <span>{message.body}</span>
                    </p>
                  )
                })}
              </div>
              <form
                className="approval__composer"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!chat.trim()) return
                  act(async () => { await approvalApi.message(card.card.id, userId, chat); setChat('') })
                }}
              >
                <input value={chat} onChange={(event) => setChat(event.target.value)} placeholder="Сообщение" />
                <button type="submit" className="approval__primary">Отправить</button>
                <label className="approval__file">
                  Прикрепить файл
                  <input
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (!file) return
                      act(async () => {
                        await approvalApi.upload(card.card.id, userId, file, { body: chat.trim() || `Файл: ${file.name}` })
                        setChat('')
                      })
                    }}
                  />
                </label>
              </form>
            </div>
          </section>
        </div>
      )}

      {mode === 'create' && draft?.phase === 'pick' && (
        <div className="approval__body">
          <button type="button" className="approval__primary" onClick={() => { setTemplateKind('personal'); setDraft({ phase: 'templates' }); approvalApi.templates(userId).then(applyTemplates).catch(() => {}) }}>По шаблону</button>
          <button type="button" className="approval__text" onClick={() => setDraft(blankDraft())}>Свободное согласование</button>
        </div>
      )}

      {mode === 'create' && draft?.phase === 'templates' && (
        <div className="approval__body">
          <div className="approval__tabs">
            <button type="button" className={templateKind === 'personal' ? 'is-on' : ''} onClick={() => setTemplateKind('personal')}>Личные</button>
            <button type="button" className={templateKind === 'official' ? 'is-on' : ''} onClick={() => setTemplateKind('official')}>Общие</button>
          </div>
          {!templates.filter((item) => (templateKind === 'official' ? item.scope === 'official' : item.scope !== 'official')).length && (
            <p className="approval__empty">
              {templateKind === 'official'
                ? 'Общих шаблонов для вас нет'
                : 'Личных шаблонов пока нет. Сохраните свободное согласование как свой шаблон.'}
            </p>
          )}
          {templates.filter((item) => (templateKind === 'official' ? item.scope === 'official' : item.scope !== 'official')).map((item) => {
            const mine = Number(item.owner_user_id) === Number(userId)
            return (
              <div className="approval__template" key={item.id}>
                <button type="button" className="approval__template-open" onClick={() => openTemplate(item.id).catch((err) => { if (!dropMissingTemplate(err, item.id)) setError(err.response?.data?.message || 'Не удалось открыть шаблон') })}>
                  <span className="approval__row-title">{item.title}</span>
                  {item.hint ? <span className="approval__row-source">{item.hint}</span> : null}
                </button>
                {mine && dropTemplateId === item.id && (
                  <div className="approval__template-actions">
                    <span>Удалить шаблон? Уже запущенные согласования останутся.</span>
                    <button type="button" className="approval__text" onClick={() => removeTemplate(item.id)}>Удалить</button>
                    <button type="button" className="approval__text" onClick={() => setDropTemplateId(null)}>Отмена</button>
                  </div>
                )}
                {mine && dropTemplateId !== item.id && (
                  <div className="approval__template-actions">
                    <button type="button" className="approval__text" onClick={() => editTemplate(item.id).catch((err) => { if (!dropMissingTemplate(err, item.id)) setError(err.response?.data?.message || 'Не удалось открыть шаблон') })}>Изменить</button>
                    <button type="button" className="approval__text" onClick={() => setDropTemplateId(item.id)}>Удалить</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {mode === 'create' && (draft?.phase === 'free' || draft?.phase === 'template') && (
        <div className="approval__body">
          <input className="approval__field" value={draft.title} placeholder="Название" onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <textarea className="approval__field approval__field--text" value={draft.body} placeholder="Что нужно согласовать" onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
          <label className="approval__file approval__file--row">
            {draft.files.length ? draft.files.map((file) => file.name).join(', ') : 'Прикрепить файлы к заявке'}
            <input
              type="file"
              multiple
              onChange={(event) => setDraft({ ...draft, files: [...draft.files, ...Array.from(event.target.files || [])] })}
            />
          </label>
          {draft.phase === 'free' && (
            <>
              <label className="approval__check">
                <input
                  type="checkbox"
                  checked={draft.useOrder}
                  onChange={(event) => setDraft({ ...draft, useOrder: event.target.checked })}
                />
                Ждать статус конкретного заказа
              </label>
              {draft.useOrder && (
                <label className="approval__label">
                  Что вводить для поиска заказа
                  <select value={draft.orderSearchBy} onChange={(event) => setDraft({ ...draft, orderSearchBy: event.target.value })}>
                    {SEARCH_BY.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <input value={draft.orderValue} placeholder={searchLabel(draft.orderSearchBy)} onChange={(event) => setDraft({ ...draft, orderValue: event.target.value })} />
                </label>
              )}
              {draft.useOrder && (
                <p className="approval__hint">В шаблоне сохранится, что нужно ввести: {searchLabel(draft.orderSearchBy)}.</p>
              )}
            </>
          )}
          {draft.phase === 'template' && draft.useOrder && (
            <label className="approval__label">
              {searchLabel(draft.orderSearchBy)}
              <input value={draft.orderValue} placeholder={searchLabel(draft.orderSearchBy)} onChange={(event) => setDraft({ ...draft, orderValue: event.target.value })} />
              <span className="approval__hint">По этому шаблону заказ ищут так: {searchLabel(draft.orderSearchBy)}.</span>
            </label>
          )}
          {draft.phase === 'template' && (draft.route || []).some((step) => step.enter_rule) && (
            <input className="approval__field" type="number" min="0" value={draft.amount} placeholder="Сумма" onChange={(event) => setDraft({ ...draft, amount: event.target.value })} />
          )}
          {draft.phase === 'template' && (
            <ol className="approval__route">
              {(draft.route || []).map((step, index) => (
                <li key={step.id || index} className="approval__step">
                  <span className="approval__box-title">{index + 1}. {step.title || 'Шаг'}</span>
                  <span>{routeKind(step)}{routeEvent(step) ? ` · ${routeEvent(step)}` : ''}</span>
                  <span>{routePeople(step, users)}</span>
                  {routeExtra(step) ? <small>{routeExtra(step)}</small> : null}
                </li>
              ))}
            </ol>
          )}
          {draft.phase === 'free' && draft.steps.map((step, index) => (
            <div key={index} className="approval__editor">
              <p className="approval__hint">{STEP_HINTS[step.stepKind]}</p>
              <StepEditor
                step={step}
                index={index}
                count={draft.steps.length}
                users={users}
                official={draft.official}
                onChange={(next) => {
                  const steps = [...draft.steps]
                  steps[index] = next
                  setDraft({ ...draft, steps, useOrder: draft.useOrder || next.stepKind === 'external' || next.stepKind === 'both', saved: false })
                }}
                onRemove={() => setDraft({ ...draft, steps: draft.steps.filter((_, item) => item !== index), saved: false })}
                onUp={() => {
                  const steps = [...draft.steps]
                  const previous = steps[index - 1]
                  steps[index - 1] = steps[index]
                  steps[index] = previous
                  setDraft({ ...draft, steps, saved: false })
                }}
              />
            </div>
          ))}
          {draft.phase === 'free' && (
            <>
              <button type="button" className="approval__text" onClick={() => setDraft({ ...draft, steps: [...draft.steps, emptyStep()], saved: false })}>Добавить шаг</button>
              {canOfficial && (
                <label className="approval__check">
                  <input type="checkbox" checked={draft.official} onChange={(event) => setDraft({ ...draft, official: event.target.checked, saved: false })} />
                  Сохранить как общий шаблон
                </label>
              )}
              {canOfficial && draft.official && (
                <p className="approval__hint">
                  {officialForAll
                    ? 'Общий шаблон увидят все сотрудники.'
                    : 'Общий шаблон увидят только сотрудники вашего отдела.'}
                  {' '}Возврат, уведомление и порог суммы записываются в общий шаблон.
                </p>
              )}
              <p className="approval__hint">В этой заявке отказ останавливает цепочку.</p>
              {draft.editingId && (
                <p className="approval__hint">Меняется только шаблон. Уже запущенные согласования останутся как есть.</p>
              )}
              <button type="button" className="approval__text" onClick={saveDraftTemplate}>
                {draft.editingId ? 'Сохранить изменения' : 'Сохранить как шаблон'}
              </button>
              {draft.saved && <p className="approval__hint">{draft.editingId ? 'Изменения сохранены' : 'Шаблон сохранён'}</p>}
            </>
          )}
          <button type="button" className="approval__primary" onClick={submitDraft}>Запустить</button>
        </div>
      )}

      {mode === 'logs' && (
        <div className="approval__body">
          <p className="approval__hint">Ошибки проверки заказа в Альтавин. Повтор одной и той же причины увеличивает счётчик, а не плодит строки.</p>
          {!logs.length && <p className="approval__empty">Проверки пока проходят без ошибок</p>}
          {logs.map((row) => (
            <button
              type="button"
              key={row.id}
              className="approval__row"
              onClick={() => { if (row.card_id) openCard(row.card_id) }}
            >
              <span className="approval__row-title">{row.card_title || 'Заявка'} · {row.step_title || 'шаг'}</span>
              <span className="approval__log-reason">{row.reason}</span>
              <span className="approval__row-source">
                {row.updated_at ? whenText(row.updated_at) : ''}
                {Number(row.repeat_count) > 1 ? ` · повторов ${row.repeat_count}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {mode === 'done' && (
        <div className="approval__body">
          <div className="approval__tabs">
            <button type="button" className={doneKind === 'done' ? 'is-on' : ''} onClick={() => openCompleted(month, 'done')}>Завершённые</button>
            <button type="button" className={doneKind === 'rejected' ? 'is-on' : ''} onClick={() => openCompleted(month, 'rejected')}>Отклонённые</button>
          </div>
          <input type="month" value={month} onChange={(event) => openCompleted(event.target.value, doneKind)} />
          {!finishedRows.length && (
            <p className="approval__empty">
              {doneKind === 'rejected' ? 'В этом месяце отклонённых согласований нет' : 'В этом месяце завершённых согласований нет'}
            </p>
          )}
          {finishedRows.map((row) => (
            <button type="button" key={row.id} className={`approval__row ${row.status === 'rejected' ? 'is-rejected' : ''} ${row.status === 'approved' && row.author_done_at ? 'is-author-done' : ''}`} onClick={() => openCard(row.id)}>
              <span className="approval__row-title">{row.title}</span>
              <span className="approval__row-meta">{row.outcome_text}</span>
              <span className="approval__row-source">{row.author_name}{row.finished_at ? ` · ${whenText(row.finished_at)}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
    </div>
  )

  return createPortal(drawer, document.body)
}
