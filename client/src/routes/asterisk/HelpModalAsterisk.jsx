import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { AiFillCloseCircle } from 'react-icons/ai'
import {
  Phone,
  PhoneDisabled,
  Call,
  CallEnd,
  CallReceived,
  CallMissed,
  Assignment as AssignmentIcon,
  Edit,
  Schedule as ScheduleIcon,
  Comment,
  Replay,
  Settings,
} from '@mui/icons-material'
import '../kanbanBoard/Boards/NotificationManager/subcomponents/HelpModal.scss'

const normalize = (v) => (v || '').toString().toLowerCase().trim()

const tabs = [
  {
    id: 'overview',
    title: 'Обзор системы',
    sectionIds: ['purpose', 'components', 'navigation', 'statistics', 'architecture'],
  },
  {
    id: 'missed-calls',
    title: 'Пропущенные звонки',
    sectionIds: [
      'missed-calls-purpose',
      'missed-calls-features',
      'missed-calls-actions',
      'missed-calls-filtering',
    ],
  },
  {
    id: 'processed-calls',
    title: 'Обработанные звонки',
    sectionIds: [
      'processed-calls-purpose',
      'processed-calls-features',
      'processed-calls-actions',
      'processed-calls-tracking',
    ],
  },
  {
    id: 'accepted-calls',
    title: 'Принятые звонки',
    sectionIds: [
      'accepted-calls-purpose',
      'accepted-calls-features',
      'accepted-calls-actions',
      'accepted-calls-tracking',
    ],
  },
  {
    id: 'settings',
    title: 'Настройки',
    sectionIds: [
      'settings-purpose',
      'settings-options',
      'settings-telegram',
      'settings-notifications',
    ],
  },
  {
    id: 'crm-notifications',
    title: 'CRM уведомления',
    sectionIds: ['crm-purpose', 'crm-types', 'crm-integration', 'crm-management'],
  },
  {
    id: 'icons',
    title: 'Справочник иконок',
    sectionIds: ['action-icons', 'status-icons', 'control-icons', 'notification-icons'],
  },
  {
    id: 'workflow',
    title: 'Рабочий процесс',
    sectionIds: ['call-lifecycle', 'user-roles', 'best-practices', 'troubleshooting'],
  },
]

const sections = [
  // Обзор системы
  {
    id: 'purpose',
    title: 'Назначение системы телефонии',
    items: [
      {
        id: 'main-purpose',
        title: 'Зачем нужна система телефонии Asterisk',
        purpose:
          'Система телефонии Asterisk предназначена для полного контроля над входящими и исходящими звонками, их обработки, учета и интеграции с CRM системой.',
        steps: [
          'Автоматическое отслеживание всех входящих звонков',
          'Классификация звонков по статусам (пропущенные, обработанные, принятые)',
          'Интеграция с базой данных дилеров для идентификации звонящих',
          'Система уведомлений в реальном времени через WebSocket',
          'Создание напоминаний и задач на основе звонков',
          'Фильтрация и поиск по всем параметрам звонков',
          'Интеграция с Telegram ботом для уведомлений',
        ],
        result: 'Централизованная система управления звонками с полной интеграцией в CRM.',
        tips: [
          'Система работает в реальном времени через WebSocket соединения',
          'Все звонки автоматически записываются в базу данных',
          'Интеграция с системой дилеров позволяет идентифицировать звонящих',
          'Уведомления настраиваются индивидуально для каждого пользователя',
        ],
      },
    ],
  },
  {
    id: 'components',
    title: 'Компоненты системы',
    items: [
      {
        id: 'main-components',
        title: 'Основные компоненты системы телефонии',
        purpose:
          'Модульная структура системы с четким разделением ответственности между компонентами.',
        steps: [
          'MissedCalls - управление пропущенными звонками',
          'ProcessedCalls - управление обработанными звонками',
          'AcceptedCalls - управление принятыми звонками',
          'CallsSettingsUsers - настройки системы уведомлений',
          'NotificationList - универсальный компонент отображения звонков',
          'CallStatusIndicator - индикатор статуса звонков в реальном времени',
          'Asterisk Server - серверная часть для обработки звонков',
        ],
        result: 'Четкое разделение ответственности и переиспользование компонентов.',
        keyIcons: [
          {
            icon: <CallMissed />,
            label: 'Пропущенные звонки',
            meaning: 'Звонки, которые не были приняты получателем',
          },
          {
            icon: <CallReceived />,
            label: 'Обработанные звонки',
            meaning: 'Пропущенные звонки, которые были обработаны сотрудником',
          },
          {
            icon: <Call />,
            label: 'Принятые звонки',
            meaning: 'Звонки, которые были успешно приняты',
          },
          {
            icon: <Settings />,
            label: 'Настройки',
            meaning: 'Конфигурация системы уведомлений и интеграций',
          },
        ],
        tips: [
          'Каждый компонент имеет четко определенную область ответственности',
          'Состояние управляется централизованно через Zustand store',
          'Все API вызовы обрабатываются с уведомлениями об успехе/ошибке',
          'Компоненты переиспользуются для обеспечения консистентности',
        ],
      },
    ],
  },
  // Пропущенные звонки
  {
    id: 'missed-calls-purpose',
    title: 'Назначение пропущенных звонков',
    items: [
      {
        id: 'missed-calls-overview',
        title: 'Что такое пропущенные звонки',
        purpose:
          'Пропущенные звонки - это входящие звонки, которые не были приняты получателем в течение определенного времени.',
        steps: [
          'Звонок поступает на внутренний номер сотрудника',
          'Сотрудник не отвечает в течение установленного времени',
          'Звонок автоматически классифицируется как "пропущенный"',
          'Система определяет звонящего по номеру телефона',
          'Звонок отображается в разделе "Пропущенные звонки"',
          'Сотрудник может обработать звонок или создать напоминание',
        ],
        result: 'Система не теряет ни одного входящего звонка, обеспечивая полный контроль.',
        tips: [
          'Пропущенные звонки имеют приоритет в обработке',
          'Система автоматически определяет звонящего по базе дилеров',
          'Можно настроить фильтрацию внутренних звонков',
          'Каждый пропущенный звонок можно перевести в обработанные',
        ],
      },
    ],
  },
  {
    id: 'missed-calls-features',
    title: 'Функции пропущенных звонков',
    items: [
      {
        id: 'missed-calls-actions',
        title: 'Действия с пропущенными звонками',
        purpose: 'Полный набор действий для обработки пропущенных звонков.',
        steps: [
          'Просмотр детальной информации о звонке',
          'Создание комментария к звонку',
          'Создание напоминания о перезвоне',
          'Создание задачи на основе звонка',
          'Перевод в статус "Обработанный"',
          'Добавление номера телефона в базу дилеров',
          'Массовая обработка всех пропущенных звонков',
        ],
        result: 'Эффективная обработка всех пропущенных звонков без потери информации.',
        keyIcons: [
          {
            icon: <Comment />,
            label: 'Комментарий',
            meaning: 'Создание или редактирование комментария к звонку',
          },
          {
            icon: <ScheduleIcon />,
            label: 'Напоминание',
            meaning: 'Создание напоминания о перезвоне',
          },
          {
            icon: <AssignmentIcon />,
            label: 'Задача',
            meaning: 'Создание задачи на основе звонка',
          },
          {
            icon: <Replay />,
            label: 'Обработать',
            meaning: 'Перевод звонка в статус "Обработанный"',
          },
        ],
        tips: [
          'Комментарии сохраняются и привязываются к звонку',
          'Напоминания интегрируются с системой задач',
          'Задачи создаются в менеджере задач',
          'Массовая обработка доступна только НОК и руководителям отделов',
        ],
      },
    ],
  },
  // Обработанные звонки
  {
    id: 'processed-calls-purpose',
    title: 'Назначение обработанных звонков',
    items: [
      {
        id: 'processed-calls-overview',
        title: 'Что такое обработанные звонки',
        purpose:
          'Обработанные звонки - это пропущенные звонки, которые были проанализированы и обработаны сотрудником.',
        steps: [
          'Пропущенный звонок переводится в статус "Обработанный"',
          'Система фиксирует время и автора обработки',
          'Звонок перемещается в раздел "Обработанные звонки"',
          'Сохраняется вся история обработки звонка',
          'Звонок исключается из активных задач',
        ],
        result: 'Четкий учет обработанных звонков с полной историей действий.',
        tips: [
          'Обработанные звонки не требуют дополнительных действий',
          'Система ведет полную историю обработки',
          'Можно отслеживать эффективность обработки звонков',
          'Обработанные звонки используются для аналитики',
        ],
      },
    ],
  },
  // Принятые звонки
  {
    id: 'accepted-calls-purpose',
    title: 'Назначение принятых звонков',
    items: [
      {
        id: 'accepted-calls-overview',
        title: 'Что такое принятые звонки',
        purpose:
          'Принятые звонки - это входящие звонки, которые были успешно приняты и обработаны сотрудником.',
        steps: [
          'Звонок поступает на внутренний номер',
          'Сотрудник принимает звонок',
          'Система фиксирует время принятия',
          'Звонок классифицируется как "Принятый"',
          'Звонок отображается в разделе "Принятые звонки"',
        ],
        result: 'Полный учет всех успешно принятых звонков для аналитики.',
        tips: [
          'Принятые звонки показывают эффективность работы',
          'Можно создавать напоминания и задачи на основе принятых звонков',
          'Система ведет статистику по принятым звонкам',
          'Принятые звонки используются для оценки качества обслуживания',
        ],
      },
    ],
  },
  // Настройки
  {
    id: 'settings-purpose',
    title: 'Назначение настроек',
    items: [
      {
        id: 'settings-overview',
        title: 'Что можно настроить в системе',
        purpose:
          'Система настроек позволяет индивидуально настроить отображение звонков и уведомления для каждого пользователя.',
        steps: [
          'Настройка отображения внутренних звонков',
          'Настройка уведомлений в Telegram',
          'Настройка напоминаний в чат-боте',
          'Управление правами доступа к звонкам',
          'Настройка фильтрации звонков',
        ],
        result: 'Персонализированная система уведомлений для каждого пользователя.',
        tips: [
          'Настройки сохраняются индивидуально для каждого пользователя',
          'Изменения применяются сразу после сохранения',
          'Настройки синхронизируются с Telegram ботом',
          'Администраторы могут управлять настройками всех пользователей',
        ],
      },
    ],
  },
  // CRM уведомления
  {
    id: 'crm-purpose',
    title: 'Назначение CRM уведомлений',
    items: [
      {
        id: 'crm-overview',
        title: 'Что такое CRM уведомления',
        purpose:
          'CRM уведомления - это система реального времени, которая информирует пользователей о входящих звонках и их статусах.',
        steps: [
          'WebSocket соединение с сервером в реальном времени',
          'Автоматическое определение звонящего по базе дилеров',
          'Отображение уведомлений в браузере',
          'Интеграция с системой задач и напоминаний',
          'Синхронизация с Telegram ботом',
        ],
        result: 'Мгновенные уведомления о всех звонках с полной информацией.',
        tips: [
          'Уведомления работают только при активном соединении',
          'Система автоматически переподключается при потере связи',
          'Уведомления настраиваются индивидуально',
          'Поддерживается несколько типов уведомлений',
        ],
      },
    ],
  },
  {
    id: 'crm-types',
    title: 'Типы CRM уведомлений',
    items: [
      {
        id: 'notification-types',
        title: 'Три типа уведомлений в системе',
        purpose:
          'Система поддерживает три основных типа уведомлений для полного контроля над звонками.',
        steps: [
          'Входящий звонок - уведомление о поступлении нового звонка',
          'Начало разговора - уведомление о том, что звонок принят',
          'Завершение звонка - уведомление о завершении разговора',
        ],
        result: 'Полный цикл уведомлений от поступления до завершения звонка.',
        keyIcons: [
          {
            icon: <Call />,
            label: 'Входящий звонок',
            meaning: 'Уведомление о поступлении нового звонка',
          },
          {
            icon: <CallReceived />,
            label: 'Начало разговора',
            meaning: 'Уведомление о том, что звонок принят',
          },
          {
            icon: <CallEnd />,
            label: 'Завершение звонка',
            meaning: 'Уведомление о завершении разговора',
          },
        ],
        tips: [
          'Каждый тип уведомления имеет свой цвет и иконку',
          'Уведомления отображаются в правом нижнем углу экрана',
          'Можно настроить звуковые уведомления',
          'Уведомления автоматически исчезают через несколько секунд',
        ],
      },
    ],
  },
  // Справочник иконок
  {
    id: 'action-icons',
    title: 'Иконки действий',
    items: [
      {
        id: 'main-action-icons',
        title: 'Основные иконки действий',
        purpose: 'Описание всех иконок действий в системе телефонии.',
        keyIcons: [
          {
            icon: <CallMissed />,
            label: 'Пропущенные звонки',
            meaning: 'Раздел с пропущенными звонками',
          },
          {
            icon: <CallReceived />,
            label: 'Обработанные звонки',
            meaning: 'Раздел с обработанными звонками',
          },
          {
            icon: <Call />,
            label: 'Принятые звонки',
            meaning: 'Раздел с принятыми звонками',
          },
          {
            icon: <Settings />,
            label: 'Настройки',
            meaning: 'Настройки системы уведомлений',
          },
        ],
      },
    ],
  },
  {
    id: 'status-icons',
    title: 'Иконки статусов',
    items: [
      {
        id: 'status-icons-list',
        title: 'Иконки статусов звонков',
        purpose: 'Описание иконок, показывающих статус звонков.',
        keyIcons: [
          {
            icon: <CallMissed />,
            label: 'Пропущенный',
            meaning: 'Звонок не был принят',
          },
          {
            icon: <CallReceived />,
            label: 'Обработанный',
            meaning: 'Звонок был обработан сотрудником',
          },
          {
            icon: <Call />,
            label: 'Принятый',
            meaning: 'Звонок был успешно принят',
          },
          {
            icon: <Phone />,
            label: 'CRM онлайн',
            meaning: 'Система уведомлений активна',
          },
          {
            icon: <PhoneDisabled />,
            label: 'CRM офлайн',
            meaning: 'Нет подключения к системе',
          },
        ],
      },
    ],
  },
  {
    id: 'control-icons',
    title: 'Иконки управления',
    items: [
      {
        id: 'control-icons-list',
        title: 'Иконки управления звонками',
        purpose: 'Описание иконок для управления звонками.',
        keyIcons: [
          {
            icon: <Comment />,
            label: 'Комментарий',
            meaning: 'Создание или редактирование комментария',
          },
          {
            icon: <Edit />,
            label: 'Редактировать комментарий',
            meaning: 'Редактирование существующего комментария',
          },
          {
            icon: <ScheduleIcon />,
            label: 'Напоминание',
            meaning: 'Создание напоминания о перезвоне',
          },
          {
            icon: <AssignmentIcon />,
            label: 'Задача',
            meaning: 'Создание задачи на основе звонка',
          },
          {
            icon: <Replay />,
            label: 'Обработать',
            meaning: 'Перевод звонка в статус "Обработанный"',
          },
          {
            icon: <CallReceived />,
            label: 'Добавить номер',
            meaning: 'Добавление номера телефона в базу дилеров',
          },
        ],
      },
    ],
  },
  // Рабочий процесс
  {
    id: 'call-lifecycle',
    title: 'Жизненный цикл звонка',
    items: [
      {
        id: 'call-stages',
        title: 'Этапы обработки звонка',
        purpose: 'Подробное описание всех этапов обработки звонка в системе.',
        steps: [
          'ЭТАП 1: Поступление звонка - звонок поступает на внутренний номер',
          'ЭТАП 2: Определение звонящего - система ищет номер в базе дилеров',
          'ЭТАП 3: Уведомление - отправка уведомления получателю',
          'ЭТАП 4: Принятие/Пропуск - сотрудник принимает или пропускает звонок',
          'ЭТАП 5: Классификация - звонок получает статус (принятый/пропущенный)',
          'ЭТАП 6: Обработка - если пропущенный, то может быть обработан',
          'ЭТАП 7: Завершение - звонок архивируется с полной историей',
        ],
        result: 'Полный контроль над каждым этапом обработки звонка.',
        tips: [
          'Каждый этап логируется в базе данных',
          'Можно отследить полную историю звонка',
          'Система автоматически определяет звонящего',
          'Уведомления отправляются в реальном времени',
        ],
      },
    ],
  },
  {
    id: 'user-roles',
    title: 'Роли пользователей',
    items: [
      {
        id: 'roles-permissions',
        title: 'Права доступа к звонкам',
        purpose: 'Описание прав доступа для разных ролей пользователей.',
        steps: [
          'Обычный пользователь - видит только свои звонки',
          'Руководитель отдела - видит звонки своего отдела',
          'НОК (Начальник отдела клиентов) - видит все звонки',
          'Администратор - полный доступ ко всем функциям',
        ],
        result: 'Гибкая система прав доступа в зависимости от роли пользователя.',
        tips: [
          'Права определяются автоматически при входе в систему',
          'Фильтрация звонков происходит на уровне API',
          'Руководители могут видеть статистику по отделу',
          'Администраторы имеют доступ ко всем настройкам',
        ],
      },
    ],
  },
]

const HelpModalAsterisk = ({ isOpen, onClose }) => {
  const [selectedTab, setSelectedTab] = useState('overview')
  const [query, setQuery] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [activeAnchor, setActiveAnchor] = useState('')
  const contentRef = useRef(null)

  const baseSections = useMemo(() => {
    const tab = tabs.find((t) => t.id === selectedTab)
    const allowed = tab ? new Set(tab.sectionIds) : new Set()
    return sections.filter((s) => allowed.has(s.id))
  }, [selectedTab])

  const results = useMemo(() => {
    const q = normalize(query)
    if (!q) return baseSections
    return baseSections
      .map((section) => {
        const matchSection = normalize(section.title).includes(q)
        const filteredItems = (section.items || []).filter((item) => {
          const hay = [
            item.title,
            item.purpose,
            ...(item.steps || []),
            ...(item.tips || []),
            ...(item.keyIcons || []).map((i) => `${i.label} ${i.meaning}`),
          ]
            .map(normalize)
            .join(' ')
          return matchSection || hay.includes(q)
        })
        return filteredItems.length > 0 || matchSection
          ? { ...section, items: filteredItems.length ? filteredItems : section.items }
          : null
      })
      .filter(Boolean)
  }, [query, baseSections])

  const handleScroll = useCallback(
    (container) => {
      try {
        const base = container || contentRef.current
        if (!base) return
        const baseRect = base.getBoundingClientRect()
        const anchors = []
        results.forEach((section) => {
          ;(section.items || []).forEach((item) => {
            const id = `${section.id}-${item.id}`
            const el = base.querySelector(`#${id}`)
            if (el) {
              const top = el.getBoundingClientRect().top - baseRect.top
              anchors.push({ id, top: Math.abs(top) })
            }
          })
        })
        anchors.sort((a, b) => a.top - b.top)
        if (anchors.length) setActiveAnchor(anchors[0].id)
      } catch (err) {
        setActiveAnchor('')
      }
    },
    [results]
  )

  useEffect(() => {
    if (contentRef.current) {
      handleScroll(contentRef.current)
    }
  }, [results, handleScroll])

  if (!isOpen) return null

  return (
    <div className="modal-overlay-creat-group">
      <div className="modal-content-creat-group" style={{ maxWidth: '980px' }}>
        <AiFillCloseCircle className="modal-overlay-close-creat-group" onClick={onClose} />

        <strong className="title-creat-group">Справка: Система телефонии Asterisk</strong>
        <p style={{ opacity: 0.8, marginBottom: 8 }}>
          Подробные инструкции по управлению звонками, уведомлениями и интеграции с CRM системой.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '6px 0 8px 0' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: selectedTab === tab.id ? '1px solid #0b63c5' : '1px solid rgba(0,0,0,0.1)',
                background: selectedTab === tab.id ? '#eef6ff' : '#fff',
                color: selectedTab === tab.id ? '#0b63c5' : 'inherit',
                cursor: 'pointer',
              }}
            >
              {tab.title}
            </button>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginBottom: 8,
            flexWrap: 'wrap',
          }}
        >
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(e) => setShowDetails(e.target.checked)}
            />
            Подробный режим
          </label>
          <button
            onClick={() => setQuery('')}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.1)',
              cursor: 'pointer',
            }}
          >
            Сбросить поиск
          </button>
        </div>
        <input
          placeholder="Поиск по разделам, шагам и иконкам..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 8,
            margin: '6px 0 12px 0',
          }}
        />

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <aside
            style={{
              width: 240,
              maxHeight: '66vh',
              overflow: 'auto',
              borderRight: '1px solid rgba(0,0,0,0.06)',
              paddingRight: 8,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Оглавление</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {results.map((section) => (
                <li key={`toc-${section.id}`} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{section.title}</div>
                  <ul style={{ margin: 0, paddingLeft: 14 }}>
                    {(section.items || []).map((item) => {
                      const id = `${section.id}-${item.id}`
                      const isActive = activeAnchor === id
                      return (
                        <li key={`toc-${section.id}-${item.id}`} style={{ marginBottom: 4 }}>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              const base = contentRef.current
                              const el = base ? base.querySelector(`#${id}`) : null
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              textDecoration: 'none',
                              color: isActive ? '#0b63c5' : 'inherit',
                              fontWeight: isActive ? 600 : 400,
                              fontSize: 13,
                            }}
                          >
                            <span>{item.title}</span>
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </aside>

          <div
            ref={contentRef}
            style={{
              flex: 1,
              maxHeight: '66vh',
              overflow: 'auto',
              paddingLeft: 12,
            }}
            onScroll={() => handleScroll()}
          >
            {results.map((section) => (
              <div key={section.id} style={{ marginBottom: 24 }}>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    margin: '0 0 12px 0',
                    color: '#333',
                    borderBottom: '2px solid #0b63c5',
                    paddingBottom: 4,
                  }}
                >
                  {section.title}
                </h2>
                {(section.items || []).map((item) => {
                  const id = `${section.id}-${item.id}`
                  return (
                    <div
                      key={id}
                      id={id}
                      style={{
                        marginBottom: 20,
                        padding: 16,
                        background: '#f8f9fa',
                        borderRadius: 8,
                        border: '1px solid rgba(0,0,0,0.06)',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          margin: '0 0 8px 0',
                          color: '#333',
                        }}
                      >
                        {item.title}
                      </h3>
                      {item.purpose && (
                        <p
                          style={{
                            margin: '0 0 12px 0',
                            fontSize: 14,
                            lineHeight: 1.5,
                            color: '#555',
                            fontStyle: 'italic',
                          }}
                        >
                          {item.purpose}
                        </p>
                      )}
                      {item.steps && item.steps.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
                            Основные шаги:
                          </div>
                          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
                            {item.steps.map((step, idx) => (
                              <li key={idx} style={{ marginBottom: 4 }}>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {item.result && (
                        <div
                          style={{
                            marginBottom: 12,
                            padding: 8,
                            background: '#e8f5e8',
                            borderRadius: 6,
                            borderLeft: '3px solid #4caf50',
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
                            Результат:
                          </div>
                          <div style={{ fontSize: 13, lineHeight: 1.4 }}>{item.result}</div>
                        </div>
                      )}

                      {item.keyIcons && item.keyIcons.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>Иконки и значения</div>
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {item.keyIcons.map((icon, idx) => (
                              <li
                                key={`${icon.label}-${idx}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  marginBottom: 6,
                                }}
                              >
                                <span
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                  {icon.icon}
                                  <span style={{ fontWeight: 600 }}>{icon.label}</span>
                                </span>
                                <span style={{ opacity: 0.9 }}>{icon.meaning}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {showDetails && item.tips && item.tips.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>Советы</div>
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {item.tips.map((t, idx) => (
                              <li key={idx}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HelpModalAsterisk
