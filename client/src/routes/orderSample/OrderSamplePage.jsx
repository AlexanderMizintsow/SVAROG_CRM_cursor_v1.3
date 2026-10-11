import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { MdHelpOutline, MdAdd, MdClose } from 'react-icons/md'
import { RiFileExcel2Line } from 'react-icons/ri'
import { BsFiletypePdf } from 'react-icons/bs'
import { API_BASE_URL } from '../../../config.js'
import useUserStore from '../../store/userStore'
import { ORDER_STATUSES, fieldById, fieldGroups } from './orderSampleFields'
import { exportOrdersExcel, exportOrdersPdf, flattenOrders } from './orderSampleExport'
import HelpModalOrderSample from './HelpModalOrderSample'
import styles from './orderSample.module.scss'

const emptyCatalogs = {
  profiles: [],
  furniture: [],
  glassSystems: [],
  colors: [],
  itemTypes: [],
  stuffTypes: [],
  bases: [],
}

const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const monthStart = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

const SEARCH_PAUSE_MS = 10000

const conditionIsFilled = (condition) => {
  if (condition.field === 'radiusOnly') return true
  return String(condition.value || '').trim() !== '' || String(condition.valueTo || '').trim() !== ''
}

const periodTooWide = (dateFrom, dateTo, orderNumber, conditions) => {
  const narrowed = String(orderNumber || '').trim() !== '' || conditions.some(conditionIsFilled)
  if (narrowed) return false
  const start = new Date(`${dateFrom}T00:00:00`)
  const end = new Date(`${dateTo}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
  const monthLater = new Date(start)
  monthLater.setMonth(monthLater.getMonth() + 1)
  return end > monthLater
}

const newCondition = () => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  field: 'profile',
  mode: 'eq',
  value: '',
  valueTo: '',
})

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString('ru-RU')
}

const CatalogSelect = ({ options, value, onChange, placeholder }) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find((item) => String(item.id) === String(value))
  const filtered = options
    .filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 60)

  return (
    <div className={styles.catalog} onBlur={() => setTimeout(() => setOpen(false), 120)}>
      <input
        className={styles.input}
        value={open ? query : selected?.name || ''}
        placeholder={placeholder}
        onFocus={() => {
          setQuery('')
          setOpen(true)
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
      />
      {open && (
        <ul className={styles.catalogList}>
          {filtered.length === 0 && <li className={styles.catalogEmpty}>Ничего не найдено</li>}
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(String(item.id))
                  setOpen(false)
                  setQuery('')
                }}
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const OrderSamplePage = () => {
  const userId = useUserStore((state) => state.user?.id)
  const yearNow = new Date().getFullYear()
  const years = [yearNow, yearNow - 1, yearNow - 2, yearNow - 3]
  const [year, setYear] = useState(String(yearNow))
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(today())
  const [orderNumber, setOrderNumber] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [scope, setScope] = useState('item')
  const [exactText, setExactText] = useState(false)
  const [conditions, setConditions] = useState([])
  const [catalogs, setCatalogs] = useState(emptyCatalogs)
  const [catalogError, setCatalogError] = useState('')
  const [orders, setOrders] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [openOrders, setOpenOrders] = useState({})
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [tick, setTick] = useState(Date.now())
  const abortRef = useRef(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return undefined
    const timer = setInterval(() => setTick(Date.now()), 250)
    return () => clearInterval(timer)
  }, [cooldownUntil])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5005/app/order-sample/catalogs/${year}`)
        if (!cancelled) {
          setCatalogs(response.data.result || emptyCatalogs)
          setCatalogError('')
        }
      } catch (err) {
        if (!cancelled) {
          setCatalogs(emptyCatalogs)
          setCatalogError('Справочники Альтавин сейчас недоступны. Текстовые условия можно задать.')
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [year])

  const groups = useMemo(() => fieldGroups(), [])

  const updateCondition = (key, patch) => {
    setConditions((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - tick) / 1000))
  const widePeriod = periodTooWide(dateFrom, dateTo, orderNumber, conditions)

  const search = async () => {
    if (loading || cooldownLeft > 0) return
    if (!dateFrom || !dateTo) {
      setError('Укажите период')
      return
    }
    if (periodTooWide(dateFrom, dateTo, orderNumber, conditions)) {
      setError('Без условий период не может быть больше месяца. Добавьте хотя бы одно условие или номер заказа.')
      return
    }
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setLoading(true)
    setError('')
    try {
      const response = await axios.post(
        `${API_BASE_URL}5005/app/order-sample/search`,
        {
          year,
          dateFrom,
          dateTo,
          orderNumber,
          orderStatus,
          scope,
          exactText,
          userId,
          conditions: conditions.map(({ field, mode, value, valueTo }) => ({
            field,
            mode,
            value,
            valueTo,
          })),
        },
        { signal: controller.signal }
      )
      const result = response.data.result
      setOrders(result.orders || [])
      setOpenOrders({})
      setCooldownUntil(Date.now() + SEARCH_PAUSE_MS)
    } catch (err) {
      if (controller.signal.aborted || err.code === 'ERR_CANCELED') return
      setOrders(null)
      const message = err.response?.data?.message || 'Не удалось выполнить выборку'
      setError(message)
      if (err.response?.status === 429) setCooldownUntil(Date.now() + SEARCH_PAUSE_MS)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const rows = orders ? flattenOrders(orders, formatDate) : []

  const renderValue = (condition) => {
    const field = fieldById(condition.field)
    if (!field || field.input === 'flag') {
      return <span className={styles.flagHint}>Признак включается самой строкой</span>
    }
    if (field.input === 'text') {
      return (
        <input
          className={styles.input}
          value={condition.value}
          placeholder="Значение"
          onChange={(event) => updateCondition(condition.key, { value: event.target.value })}
        />
      )
    }
    if (field.input === 'range') {
      return (
        <div className={styles.range}>
          <input
            className={styles.input}
            type="number"
            placeholder="от"
            value={condition.value}
            onChange={(event) => updateCondition(condition.key, { value: event.target.value })}
          />
          <input
            className={styles.input}
            type="number"
            placeholder="до"
            value={condition.valueTo}
            onChange={(event) => updateCondition(condition.key, { valueTo: event.target.value })}
          />
        </div>
      )
    }
    const options = field.input === 'choice' ? field.choices : catalogs[field.catalog] || []
    if (field.input === 'choice') {
      return (
        <select
          className={styles.input}
          value={condition.value}
          onChange={(event) => updateCondition(condition.key, { value: event.target.value })}
        >
          <option value="">Выберите</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      )
    }
    return (
      <CatalogSelect
        options={options}
        value={condition.value}
        placeholder="Начните вводить название"
        onChange={(next) => updateCondition(condition.key, { value: next })}
      />
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Выборка заказов</h1>
          <p>Поиск заказов Альтавин по параметрам изделия и составу</p>
        </div>
        <button type="button" className={styles.helpButton} onClick={() => setHelpOpen(true)}>
          <MdHelpOutline />
          Справка
        </button>
      </header>

      <section className={styles.panel}>
        <div className={styles.filters}>
          <label>
            Год базы
            <select className={styles.input} value={year} onChange={(event) => setYear(event.target.value)}>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Период с
            <input className={styles.input} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            по
            <input className={styles.input} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <label>
            Номер заказа
            <input className={styles.input} value={orderNumber} placeholder="Необязательно" onChange={(event) => setOrderNumber(event.target.value)} />
          </label>
          <label>
            Статус
            <select className={styles.input} value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}>
              <option value="">Любой</option>
              {ORDER_STATUSES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.scope}>
          <span>Искать</span>
          <button type="button" className={scope === 'item' ? styles.scopeOn : ''} onClick={() => setScope('item')}>
            В одном изделии
          </button>
          <button type="button" className={scope === 'order' ? styles.scopeOn : ''} onClick={() => setScope('order')}>
            В заказе целиком
          </button>
          <label className={styles.exact}>
            <input
              type="checkbox"
              checked={exactText}
              onChange={(event) => setExactText(event.target.checked)}
            />
            Точное совпадение текста
          </label>
        </div>

        {catalogError && <p className={styles.note}>{catalogError}</p>}

        <div className={styles.conditions}>
          {conditions.length === 0 && (
            <p className={styles.note}>Условий нет: будут показаны заказы за выбранный период.</p>
          )}
          {conditions.map((condition) => (
            <div className={styles.condition} key={condition.key}>
              <select
                className={styles.input}
                value={condition.field}
                onChange={(event) =>
                  updateCondition(condition.key, { field: event.target.value, value: '', valueTo: '' })
                }
              >
                {groups.map((group) => (
                  <optgroup key={group.title} label={group.title}>
                    {group.fields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <select
                className={styles.input}
                value={condition.mode}
                onChange={(event) => updateCondition(condition.key, { mode: event.target.value })}
              >
                <option value="eq">равно</option>
                <option value="except">кроме</option>
              </select>
              {renderValue(condition)}
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setConditions((prev) => prev.filter((item) => item.key !== condition.key))}
                aria-label="Удалить условие"
              >
                <MdClose />
              </button>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghost}
            disabled={loading}
            onClick={() => setConditions((prev) => [...prev, newCondition()])}
          >
            <MdAdd />
            Добавить условие
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={search}
            disabled={loading || cooldownLeft > 0 || !dateFrom || !dateTo || widePeriod}
          >
            {loading ? 'Идёт поиск…' : cooldownLeft > 0 ? `Повтор через ${cooldownLeft} с` : 'Найти'}
          </button>
        </div>
        {widePeriod && (
          <p className={styles.note}>
            Без условий период не может быть больше месяца. Добавьте условие или номер заказа.
          </p>
        )}
        {loading && (
          <div className={styles.waiting} role="status">
            <span className={styles.spinner} />
            <div>
              <strong>Идёт поиск в Альтавин</strong>
              <p>Запрос уже отправлен. Пока он выполняется, повторно нажимать «Найти» не нужно.</p>
            </div>
          </div>
        )}
      </section>

      {error && <p className={styles.error}>{error}</p>}

      {orders && (
        <section className={styles.results}>
          <div className={styles.resultsHead}>
            <div>
              <h2>Найдено заказов: {orders.length}</h2>
            </div>
            <div className={styles.exports}>
              <button type="button" disabled={!rows.length} onClick={() => exportOrdersExcel(rows)}>
                <RiFileExcel2Line />
                Excel
              </button>
              <button type="button" disabled={!rows.length} onClick={() => exportOrdersPdf(rows)}>
                <BsFiletypePdf />
                PDF
              </button>
            </div>
          </div>

          {orders.length === 0 && <p className={styles.note}>По этим условиям заказов нет.</p>}

          <ul className={styles.orderList}>
            {orders.map((order) => {
              const opened = openOrders[order.orderId]
              return (
                <li key={order.orderId} className={styles.orderCard}>
                  <button
                    type="button"
                    className={styles.orderHead}
                    onClick={() =>
                      setOpenOrders((prev) => ({ ...prev, [order.orderId]: !prev[order.orderId] }))
                    }
                  >
                    <span className={styles.orderTitle}>
                      <strong>{order.orderName || 'Без наименования'}</strong>
                      <span>№ {order.orderNumber}</span>
                    </span>
                    <span className={styles.party}>Менеджер: {order.managerName || '—'}</span>
                    <span className={styles.party}>Дилер: {order.dealerName || '—'}</span>
                    <span>{formatDate(order.dateCreated)}</span>
                    <span className={styles.status}>{order.statusLabel}</span>
                    <span className={styles.count}>{order.items.length} изд.</span>
                  </button>
                  {opened && (
                    <div className={styles.items}>
                      {order.items.length === 0 && <p>Для этого заказа отдельные изделия не отображаются.</p>}
                      {order.items.map((item) => (
                        <article key={item.key} className={styles.item}>
                          <h3>{item.itemName || 'Изделие'}</h3>
                          <p>
                            {item.profileName && <span>Профиль: {item.profileName}</span>}
                            {item.furnitureName && <span>Фурнитура: {item.furnitureName}</span>}
                            {(item.colorIn || item.colorOut) && (
                              <span>
                                Цвет: {item.colorIn || '—'} / {item.colorOut || '—'}
                              </span>
                            )}
                            {(item.width || item.height) && (
                              <span>
                                Размер: {item.width || '—'} × {item.height || '—'}
                              </span>
                            )}
                            {item.sashCount != null && item.sashCount !== '' && <span>Створки: {item.sashCount}</span>}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {helpOpen && <HelpModalOrderSample onClose={() => setHelpOpen(false)} />}
    </div>
  )
}

export default OrderSamplePage
