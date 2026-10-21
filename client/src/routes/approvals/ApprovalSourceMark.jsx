import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { approvalApi } from './approvalApi'
import './approvalSource.scss'

const queue = []
let timer = null

function flushMarks() {
  const batch = queue.splice(0, queue.length)
  const byUser = new Map()
  batch.forEach((item) => {
    if (!byUser.has(item.userId)) byUser.set(item.userId, [])
    byUser.get(item.userId).push(item)
  })
  byUser.forEach((items, userId) => {
    const taskIds = items.map((item) => item.taskId).filter(Boolean)
    const globalTaskIds = items.map((item) => item.globalTaskId).filter(Boolean)
    approvalApi.marks(userId, taskIds, globalTaskIds).then((rows) => {
      const list = Array.isArray(rows) ? rows : []
      items.forEach((item) => {
        const mark = list.find((row) => (
          item.taskId
            ? Number(row.taskId) === Number(item.taskId)
            : Number(row.globalTaskId) === Number(item.globalTaskId)
        ))
        item.onData(mark || null)
      })
    }).catch(() => {
      items.forEach((item) => item.onData(null))
    })
  })
}

function watchMark(userId, taskId, globalTaskId, onData) {
  const item = { userId, taskId, globalTaskId, onData }
  queue.push(item)
  clearTimeout(timer)
  timer = setTimeout(flushMarks, 40)
  return () => {
    const index = queue.indexOf(item)
    if (index >= 0) queue.splice(index, 1)
  }
}

function Approvers({ people }) {
  const list = Array.isArray(people) ? people.filter((person) => person?.name) : []
  if (!list.length) return null
  const steps = new Set(list.map((person) => person.stepTitle).filter(Boolean))
  const showStep = steps.size > 1
  return (
    <div className="approval-source__approvers">
      <p>Согласовали</p>
      <ul>
        {list.map((person, index) => (
          <li key={`${person.name}-${person.decidedAt || index}`}>
            {person.name}
            {person.insteadOf ? ` вместо ${person.insteadOf}` : ''}
            {showStep && person.stepTitle ? ` · ${person.stepTitle}` : ''}
            {person.decidedAt ? ` · ${whenText(person.decidedAt)}` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}

function whenText(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

export default function ApprovalSourceMark({ userId, taskId, globalTaskId }) {
  const [mark, setMark] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!userId || (!taskId && !globalTaskId)) return undefined
    return watchMark(userId, taskId, globalTaskId, setMark)
  }, [userId, taskId, globalTaskId])

  if (!mark) return null

  return (
    <>
      <button
        type="button"
        className={`approval-source-mark ${mark.authorDoneAt ? 'is-done' : ''}`}
        title="Было согласование"
        onClick={(event) => {
          event.stopPropagation()
          event.preventDefault()
          setOpen(true)
        }}
      >
        Было согласование
      </button>
      {open && createPortal(
        <div className="approval-source" onClick={() => setOpen(false)}>
          <div className="approval-source__card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="approval-source__close" onClick={() => setOpen(false)}>Закрыть</button>
            <p className="approval-source__status">Согласование успешно завершено</p>
            {mark.finishedAt ? <p className="approval-source__date">{whenText(mark.finishedAt)}</p> : null}
            {mark.authorDoneAt ? <p className="approval-source__done">Автор отметил: сделано · {whenText(mark.authorDoneAt)}</p> : null}
            <Approvers people={mark.approvers} />
            <h3>{mark.title}</h3>
            {mark.body ? <p className="approval-source__body">{mark.body}</p> : null}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
