import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Toastify from 'toastify-js'
import useUserStore from '../../store/userStore'
import {
  managerRequestsApi,
  saveManagerRequestTaskDraft,
} from './managerRequestsApi'
import './managerRequests.scss'

const TYPES = [
  { id: 'question', label: 'Вопрос' },
  { id: 'proposal', label: 'Предложение' },
  { id: 'escalation', label: 'Эскалация' },
]

const toast = (text, ok = true) => {
  Toastify({
    text,
    duration: 3000,
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

const ManagerRequestsPage = () => {
  const { user } = useUserStore()
  const navigate = useNavigate()
  const userId = user?.id

  const [tab, setTab] = useState('mine')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mine, setMine] = useState([])
  const [inbox, setInbox] = useState([])
  const [manager, setManager] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)

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
      const [mineList, inboxList, mgr] = await Promise.all([
        managerRequestsApi.listMine(userId),
        managerRequestsApi.listInbox(userId, 'all'),
        managerRequestsApi.getMyManager(userId),
      ])
      setMine(mineList)
      setInbox(inboxList)
      setManager(mgr)
    } catch (err) {
      const message =
        err?.response?.data?.error || err.message || 'Не удалось загрузить обращения'
      setError(message)
    }
  }, [userId])

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

  const isManagerView =
    selected && Number(selected.toUserId) === Number(userId)
  const canAct = isManagerView && selected?.status === 'open'

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
      setSelectedId(created.id)
      toast('Обращение отправлено')
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
      toast('Ответ отправлен')
    } catch (err) {
      toast(err?.response?.data?.error || 'Не удалось ответить', false)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async () => {
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
    navigate('/task-manager')
  }

  if (!userId) {
    return <div className="mgr-req">Войдите в систему</div>
  }

  return (
    <div className="mgr-req">
      <header className="mgr-req__header">
        <div>
          <h1>Обращения</h1>
          <p>
            Канал к непосредственному руководителю: вопрос, предложение или
            эскалация. Задачу на Директора ставить нельзя — пишите сюда.
          </p>
        </div>
        {tab === 'mine' ? (
          <button
            type="button"
            className="mgr-req__btn mgr-req__btn--primary"
            onClick={() => setShowCreateForm((v) => !v)}
          >
            {showCreateForm ? 'Скрыть форму' : 'Написать руководителю'}
          </button>
        ) : null}
      </header>

      <div className="mgr-req__tabs">
        <button
          type="button"
          className={tab === 'mine' ? 'is-active' : ''}
          onClick={() => {
            setTab('mine')
            setSelectedId(null)
          }}
        >
          Мои обращения
        </button>
        <button
          type="button"
          className={tab === 'inbox' ? 'is-active' : ''}
          onClick={() => {
            setTab('inbox')
            setSelectedId(null)
          }}
        >
          Входящие{openInboxCount > 0 ? ` (${openInboxCount})` : ''}
        </button>
      </div>

      {error ? <div className="mgr-req__error">{error}</div> : null}

      {tab === 'mine' && showCreateForm ? (
        <form className="mgr-req__create" onSubmit={handleCreate}>
          <div className="mgr-req__manager">
            <span className="mgr-req__label">Кому</span>
            {manager ? (
              <strong>
                {manager.name}
                {manager.positionName ? ` · ${manager.positionName}` : ''}
              </strong>
            ) : (
              <span className="mgr-req__warn">
                Руководитель не назначен в иерархии
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
              {tab === 'mine'
                ? 'Вы ещё не писали руководителю'
                : 'Входящих обращений нет'}
            </div>
          ) : (
            list.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`mgr-req__row ${
                  selectedId === item.id ? 'is-selected' : ''
                }`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="mgr-req__row-title">{item.title}</div>
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
                  <div className="mgr-req__label">Ответ руководителя</div>
                  <p className="mgr-req__body">{selected.answerText}</p>
                </div>
              ) : null}

              {selected.relatedTaskId ? (
                <div className="mgr-req__row-meta">
                  Связанная задача №{selected.relatedTaskId}
                </div>
              ) : null}

              {canAct ? (
                <div className="mgr-req__actions">
                  <label className="mgr-req__label" htmlFor="mgr-answer">
                    Ваш ответ
                  </label>
                  <textarea
                    id="mgr-answer"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    rows={4}
                    placeholder="Текст ответа"
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
                      Закрыть
                    </button>
                  </div>
                </div>
              ) : null}

              {isManagerView && selected.status === 'answered' ? (
                <div className="mgr-req__actions-row">
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
                    Закрыть
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default ManagerRequestsPage
