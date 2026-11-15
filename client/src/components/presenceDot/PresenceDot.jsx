import usePresenceStore from '../../store/usePresenceStore'
import useLineStore from '../../store/useLineStore'
import './presenceDot.scss'

const LINE_LABEL = {
  free: 'свободен',
  ringing: 'звонит',
  talking: 'говорит',
}

const TITLES = {
  online: 'Окно CRM открыто',
  not_active: 'Окно CRM открыто, давно нет действий',
  offline: 'Окно CRM закрыто. Это не отпуск и не отсутствие',
}

export default function PresenceDot({ userId, fallbackStatus }) {
  const stored = usePresenceStore((state) =>
    userId == null || userId === '' ? undefined : state.byId[String(userId)]
  )
  const line = useLineStore((state) =>
    userId == null || userId === '' ? undefined : state.byId[String(userId)]
  )
  const status = stored || fallbackStatus
  if (userId == null || userId === '' || !status) return null

  const kind =
    status === 'online' ? 'online' : status === 'not_active' ? 'idle' : 'offline'
  const title = TITLES[status] || TITLES.offline
  const lineLabel = LINE_LABEL[line]

  return (
    <span className="presence-with-line">
      <span
        className={`presence-dot presence-dot--${kind}`}
        title={title}
        aria-label={title}
      />
      {lineLabel ? (
        <span className={`line-state line-state--${line}`}>{lineLabel}</span>
      ) : null}
    </span>
  )
}
