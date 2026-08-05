import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Toastify from 'toastify-js'
import useUserStore from '../../store/userStore'
import useTaskStateTracker from '../../store/useTaskStateTracker'
import {
  managerRequestsApi,
  saveManagerRequestTaskDraft,
} from './managerRequestsApi'
import ManagerRequestChat from './ManagerRequestChat'
import './managerRequests.scss'

const TYPES = [
  { id: 'question', label: 'Вопрос' },
  { id: 'proposal', label: 'Предложение' },
  { id: 'escalation', label: 'Эскалация' },
]

const toast = (text, ok = true) => {
  Toastify({
    text,
    duration: 3500,
    close: true,
    gravity: 'top',
    position: 'right',
    backgroundColor: ok
      ? 'linear-gradient(to right, #0f766e, #14b8a6)'
      : 'linear-gradient(to right, #8B0000, #ff0000)',
  }).showToast()
}

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

const hasUnreadForUser = (item, userId, tab) => {
  if (!item || !userId) return false
  if (tab === 'mine') return Boolean(item.authorHasUnread)
  if (tab === 'inbox') return Boolean(item.recipientHasUnread)
  if (Number(item.fromUserId) === Number(userId)) return Boolean(item.authorHasUnread)
  if (Number(item.toUserId) === Number(userId)) return Boolean(item.recipientHasUnread)
  return false
}

const ManagerRequestsPage = () => {
  const { user } = useUserStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const userId = user?.id

  const [tab, setTab] = useState('mine')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mine, setMine] = useState([])
  const [inbox, setInbox] = useState([])
  const [manager, setManager] = useState(null)
  const [access, setAccess] = useState({
    canAccess: false,
    canCreate: false,
    isDirector: false,
  })
  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [inboxFilter, setInboxFilter] = useState('active')

  const [formType, setFormType] = useState('question')
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [answerText, setAnswerText] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const list = tab === 'mine' ? mine : inbox

  const loadLists = useCallback(async () => {
    if (!userId) return
    setError('')
    try {
      const [{ manager: mgr, access: acc }, mineList, inboxList] = await Promise.all([
        managerRequestsApi.getMyManager(userId),
        managerRequestsApi.listMine(userId),
        managerRequestsApi.listInbox(userId, inboxFilter === 'all' ? 'all' : 'active'),
      ])
      setManager(mgr)
      setAccess(acc || { canAccess: false, canCreate: false })
      setMine(mineList)
      setInbox(inboxList)
      if (acc?.isDirector) {
        setTab((prev) => (prev === 'mine' && !acc.canCreate ? 'inbox' : prev))
      }
    } catch (err) {
      const message =
        err?.response?.data?.error || err.message || 'Не удалось загрузить обращения'
      setError(message)
    }
  }, [userId, inboxFilter])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        if (active) await loadLists()
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [loadLists])

  useEffect(() => {
    const qId = Number(searchParams.get('id'))
    if (Number.isFinite(qId) && qId > 0) {
      setSelectedId(qId)
    }
  }, [searchParams])

  useEffect(() => {
    if (!selectedId || !userId) {
      setSelected(null)
      setAnswerText('')
      return
    }
    let active = true
    ;(async () => {
      try {
        const item = await managerRequestsApi.getOne(userId, selectedId)
        if (!active) return
        setSelected(item)
        setAnswerText(item?.answerText || '')
        if (Number(item?.toUserId) === Number(userId)) setTab('inbox')
        else if (Number(item?.fromUserId) === Number(userId)) setTab('mine')
        // Сброс непрочитанного локально после открытия
        setMine((prev) =>
          prev.map((r) =>
            r.id === item.id ? { ...r, authorHasUnread: false } : r
          )
        )
        setInbox((prev) =>
          prev.map((r) =>
            r.id === item.id ? { ...r, recipientHasUnread: false } : r
          )
        )
      } catch (err) {
        if (active) {
          toast(err?.response?.data?.error || 'Не удалось открыть обращение', false)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [selectedId, userId])

  const openInboxCount = useMemo(
    () => inbox.filter((x) => x.status === 'open').length,
    [inbox]
  )
  const answeredInboxCount = useMemo(
    () => inbox.filter((x) => x.status === 'answered').length,
    [inbox]
  )
  const unreadMineCount = useMemo(
    () => mine.filter((x) => x.authorHasUnread).length,
    [mine]
  )
  const unreadInboxCount = useMemo(
    () => inbox.filter((x) => x.recipientHasUnread).length,
    [inbox]
  )

  const isManagerView = selected && Number(selected.toUserId) === Number(userId)
  const isActiveStatus =
    selected && (selected.status === 'open' || selected.status === 'answered')
  const canDirectorAct = isManagerView && isActiveStatus
  const canChat = Boolean(selected && isActiveStatus)

  const selectRequest = (id) => {
    setSelectedId(id)
    setSearchParams(id ? { id: String(id) } : {})
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!formTitle.trim() || !formBody.trim()) {
      toast('Заполните тему и текст', false)
      return
    }
    setSaving(true)
    try {
      const created = await managerRequestsApi.create(userId, {
        type: formType,
        title: formTitle.trim(),
        body: formBody.trim(),
      })
      setFormTitle('')
      setFormBody('')
      setFormType('question')
      setShowCreateForm(false)
      await loadLists()
      setTab('mine')
      selectRequest(created.id)
      toast('Обращение отправлено директору')
    } catch (err) {
      toast(err?.response?.data?.error || 'Не удалось отправить', false)
    } finally {
      setSaving(false)
    }
  }

  const handleAnswer = async () => {
    if (!answerText.trim()) {
      toast('Введите ответ', false)
      return
    }
    setSaving(true)
    try {
      const updated = await managerRequestsApi.answer(
        userId,
        selected.id,
        answerText.trim()
      )
      setSelected(updated)
      await loadLists()
      toast('Ответ отправлен. Закройте обращение вручную, когда всё будет сделано.')
    } catch (err) {
      toast(err?.response?.data?.error || 'Не удалось ответить', false)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async () => {
    if (!window.confirm('Закрыть обращение? После закрытия чат будет недоступен.')) return
    setSaving(true)
    try {
      const updated = await managerRequestsApi.close(userId, selected.id)
      setSelected(updated)
      await loadLists()
      toast('Обращение закрыто')
    } catch (err) {
      toast(err?.response?.data?.error || 'Не удалось закрыть', false)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateTask = () => {
    if (!selected) return
    saveManagerRequestTaskDraft({
      managerRequestId: selected.id,
      title: selected.title,
      description: selected.body,
      userId,
    })
    toast('Откроется создание задачи. После сохранения она останется связанной с обращением.')
    navigate('/task-manager')
  }

  const openRelatedTask = () => {
    if (!selected?.relatedTaskId) return
    const { setTaskDecisionNavigate, setTaskCardBlinkYellow } =
      useTaskStateTracker.getState()
    setTaskCardBlinkYellow(selected.relatedTaskId)
    setTaskDecisionNavigate({ type: 'taskList', initialTab: 'created' })
    window.dispatchEvent(new CustomEvent('task-decision-navigate'))
    navigate('/task-manager')
  }

  if (!userId) {
    return <div className="mgr-req">Войдите в систему</div>
  }

  if (!loading && access && access.canAccess === false) {
    return (
      <div className="mgr-req">
        <header className="mgr-req__header">
          <div>
            <h1>Обращения</h1>
            <p>
              Раздел доступен директору, администратору и сотрудникам, у которых
              прямой руководитель — Директор.
            </p>
          </div>
        </header>
        <div className="mgr-req__error">Недостаточно прав для просмотра обращений</div>
      </div>
    )
  }

  return (
    <div className="mgr-req">
      <header className="mgr-req__header">
        <div>
          <h1>Обращения к директору</h1>
          <p>
            Канал к директору: вопрос, предложение или эскалация. Задачу на Директора
            ставить нельзя — пишите сюда. Ответ не закрывает обращение: директор
            закрывает его вручную после ответа или создания задачи. По каждому обращению
            доступен чат уточнений.
          </p>
        </div>
        {tab === 'mine' && access.canCreate ? (
          <button
            type="button"
            className="mgr-req__btn mgr-req__btn--primary"
            onClick={() => setShowCreateForm((v) => !v)}
          >
            {showCreateForm ? 'Скрыть форму' : 'Написать директору'}
          </button>
        ) : null}
      </header>

      <div className="mgr-req__tabs">
        {access.canCreate || !access.isDirector ? (
          <button
            type="button"
            className={tab === 'mine' ? 'is-active' : ''}
            onClick={() => {
              setTab('mine')
              selectRequest(null)
            }}
          >
            Мои обращения
            {unreadMineCount > 0 ? ` · ${unreadMineCount} новых` : ''}
          </button>
        ) : null}
        {(access.isDirector || access.isAdmin || inbox.length > 0) && (
          <button
            type="button"
            className={tab === 'inbox' ? 'is-active' : ''}
            onClick={() => {
              setTab('inbox')
              selectRequest(null)
            }}
          >
            Входящие
            {openInboxCount > 0 ? ` · ${openInboxCount} откр.` : ''}
            {answeredInboxCount > 0 ? ` · ${answeredInboxCount} ответ.` : ''}
            {unreadInboxCount > 0 ? ` · ${unreadInboxCount} новых` : ''}
          </button>
        )}
      </div>

      {tab === 'inbox' ? (
        <div className="mgr-req__filters">
          <button
            type="button"
            className={inboxFilter === 'active' ? 'is-active' : ''}
            onClick={() => setInboxFilter('active')}
          >
            В работе (открыто + отвечено)
          </button>
          <button
            type="button"
            className={inboxFilter === 'all' ? 'is-active' : ''}
            onClick={() => setInboxFilter('all')}
          >
            Все
          </button>
        </div>
      ) : null}

      {error ? <div className="mgr-req__error">{error}</div> : null}

      {tab === 'mine' && showCreateForm && access.canCreate ? (
        <form className="mgr-req__create" onSubmit={handleCreate}>
          <div className="mgr-req__manager">
            <span className="mgr-req__label">Кому</span>
            {manager ? (
              <strong>
                {manager.name}
                {manager.positionName ? ` · ${manager.positionName}` : ''}
                {' · Директор'}
              </strong>
            ) : (
              <span className="mgr-req__warn">
                В системе не найден пользователь с ролью «Директор»
              </span>
            )}
          </div>

          <div className="mgr-req__types">
            {TYPES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={formType === item.id ? 'is-active' : ''}
                onClick={() => setFormType(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="mgr-req__label" htmlFor="mgr-title">
            Тема
          </label>
          <input
            id="mgr-title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Кратко о сути"
            required
          />

          <label className="mgr-req__label" htmlFor="mgr-body">
            Текст
          </label>
          <textarea
            id="mgr-body"
            value={formBody}
            onChange={(e) => setFormBody(e.target.value)}
            placeholder="Опишите обращение"
            rows={5}
            required
          />

          <button
            type="submit"
            className="mgr-req__btn mgr-req__btn--primary"
            disabled={!manager || saving}
          >
            {saving ? 'Отправка…' : 'Отправить'}
          </button>
        </form>
      ) : null}

      <div className="mgr-req__layout">
        <section className="mgr-req__list">
          {loading ? (
            <div className="mgr-req__empty">Загрузка…</div>
          ) : list.length === 0 ? (
            <div className="mgr-req__empty">
              {tab === 'mine' ? 'Вы ещё не писали директору' : 'Входящих обращений нет'}
            </div>
          ) : (
            list.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`mgr-req__row ${
                  selectedId === item.id ? 'is-selected' : ''
                } ${hasUnreadForUser(item, userId, tab) ? 'is-unread' : ''}`}
                onClick={() => selectRequest(item.id)}
              >
                <div className="mgr-req__row-title">
                  {hasUnreadForUser(item, userId, tab) ? (
                    <span className="mgr-req__unread-dot" title="Есть обновление" />
                  ) : null}
                  {item.title}
                </div>
                <div className="mgr-req__row-meta">
                  {[
                    item.typeLabel,
                    item.statusLabel,
                    tab === 'inbox' ? item.fromUserName : item.toUserName,
                    formatDate(item.createdAt),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </button>
            ))
          )}
        </section>

        <section className="mgr-req__detail">
          {!selected ? (
            <div className="mgr-req__empty">Выберите обращение</div>
          ) : (
            <>
              <h2>{selected.title}</h2>
              <div className="mgr-req__row-meta">
                {[
                  selected.typeLabel,
                  selected.statusLabel,
                  selected.fromUserName,
                  selected.toUserName,
                  formatDate(selected.createdAt),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <p className="mgr-req__body">{selected.body}</p>

              {selected.answerText ? (
                <div className="mgr-req__answer-block">
                  <div className="mgr-req__label">Ответ директора</div>
                  <p className="mgr-req__body">{selected.answerText}</p>
                </div>
              ) : null}

              {selected.relatedTaskId ? (
                <div className="mgr-req__task-link">
                  <div className="mgr-req__label">Связанная задача</div>
                  <p>
                    №{selected.relatedTaskId}
                    {selected.relatedTaskTitle ? ` — ${selected.relatedTaskTitle}` : ''}
                  </p>
                  <button
                    type="button"
                    className="mgr-req__btn mgr-req__btn--primary"
                    onClick={openRelatedTask}
                  >
                    Открыть в менеджере задач
                  </button>
                  <p className="mgr-req__muted">
                    Задача создаётся в «Менеджере задач» (вкладка «Созданные»). Обращение
                    при этом не закрывается автоматически.
                  </p>
                </div>
              ) : null}

              {canDirectorAct ? (
                <div className="mgr-req__actions">
                  <label className="mgr-req__label" htmlFor="mgr-answer">
                    Официальный ответ
                  </label>
                  <textarea
                    id="mgr-answer"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    rows={4}
                    placeholder="Текст ответа автору"
                  />
                  <div className="mgr-req__actions-row">
                    <button
                      type="button"
                      className="mgr-req__btn mgr-req__btn--primary"
                      onClick={handleAnswer}
                      disabled={saving}
                    >
                      Ответить
                    </button>
                    <button
                      type="button"
                      className="mgr-req__btn"
                      onClick={handleCreateTask}
                      disabled={saving}
                    >
                      Создать задачу
                    </button>
                    <button
                      type="button"
                      className="mgr-req__btn"
                      onClick={handleClose}
                      disabled={saving}
                    >
                      Закрыть обращение
                    </button>
                  </div>
                  <p className="mgr-req__muted">
                    После ответа обращение остаётся «в работе», пока вы не нажмёте
                    «Закрыть». Можно сначала создать задачу, затем закрыть.
                  </p>
                </div>
              ) : null}

              {selected ? (
                <ManagerRequestChat
                  userId={userId}
                  requestId={selected.id}
                  canWrite={canChat}
                  onError={(msg) => toast(msg, false)}
                />
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default ManagerRequestsPage
