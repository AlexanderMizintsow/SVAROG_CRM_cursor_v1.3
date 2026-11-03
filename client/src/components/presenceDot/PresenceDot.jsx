import usePresenceStore from '../../store/usePresenceStore'
import './presenceDot.scss'

const TITLES = {
  online: 'Окно CRM открыто',
  not_active: 'Окно CRM открыто, давно нет действий',
  offline: 'Окно CRM закрыто. Это не отпуск и не отсутствие',
}

export default function PresenceDot({ userId, fallbackStatus }) {
  const stored = usePresenceStore((state) =>
    userId == null || userId === '' ? undefined : state.byId[String(userId)]
  )
  const status = stored || fallbackStatus
  if (userId == null || userId === '' || !status) return null

  const kind =
    status === 'online' ? 'online' : status === 'not_active' ? 'idle' : 'offline'
  const title = TITLES[status] || TITLES.offline

  return (
    <span
      className={`presence-dot presence-dot--${kind}`}
      title={title}
      aria-label={title}
    />
  )
}
