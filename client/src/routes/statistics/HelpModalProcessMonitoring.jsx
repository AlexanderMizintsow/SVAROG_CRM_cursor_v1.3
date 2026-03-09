import { useMemo, useState, useRef, useEffect } from 'react'
import { AiFillCloseCircle } from 'react-icons/ai'
import { MdFilterList, MdDateRange } from 'react-icons/md'
import { FaChartPie, FaTable, FaUsers, FaBriefcase, FaTasks, FaExclamationTriangle } from 'react-icons/fa'
import { FcFlowChart, FcDepartment } from 'react-icons/fc'
import '../workGroup/HelpModal.scss'
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'

const normalize = (v) => (v || '').toString().toLowerCase().trim()

const tabs = [
  {
    id: 'main',
    title: 'Мониторинг процессов',
    sectionIds: [
      'overview',
      'filters',
      'charts-intro',
      'chart-category',
      'chart-projects',
      'chart-tasks',
      'chart-bp',
      'chart-departments',
      'chart-load-by-author',
      'tables',
      'bp-detail',
    ],
  },
]

const sections = [
  {
    id: 'overview',
    title: 'Назначение компонента',
    items: [
      {
        id: 'purpose',
        title: 'Для чего нужен мониторинг процессов',
        purpose:
          'Раздел «Мониторинг процессов» даёт сводную картину по проектам, задачам и экземплярам бизнес-процессов: сколько их в работе или завершено, как нагрузка распределена по отделам и сотрудникам, где возникают просрочки и узкие места. Данные можно фильтровать по периоду, отделу и исполнителю, смотреть в виде круговых диаграмм или таблиц, а по клику на карточку — открывать детальный список.',
        steps: [
          'Вверху страницы — карточки-сводки (Проекты, Бизнес-процессы, Задачи, Просрочки). Нажатие на карточку открывает модальное окно со списком записей по выбранным фильтрам.',
          'Ниже — переключатель «Графики» / «Таблицы»: круговые диаграммы или таблицы по отделам и сотрудникам.',
          'Внизу — блок «Детали по бизнес-процессам»: выбор конкретного БП и просмотр времени по этапам, узких мест и нагрузки по участникам/отделам.',
        ],
        tips: [
          'Кнопка «Обновить» перезагружает все данные с учётом текущих фильтров. Используйте её после смены периода или отдела.',
        ],
      },
    ],
  },
  {
    id: 'filters',
    title: 'Фильтры и их значение',
    items: [
      {
        id: 'filters-overview',
        title: 'Период и фильтры',
        purpose: 'Все сводки и диаграммы считаются в рамках выбранного периода и, при необходимости, отдела или сотрудника.',
        steps: [
          'С / По — даты периода. Если не заданы, учитываются все данные без ограничения по дате.',
          'Отдел — только проекты и задачи, связанные с выбранным отделом (автор или ответственный по проекту, исполнитель по задаче). «Все» — без фильтра по отделу.',
          'Сотрудник — сужение до конкретного пользователя (автор/ответственный/исполнитель). Список сотрудников зависит от выбранного отдела; при «Все» отделы — все сотрудники.',
          'Общая статистика — галочка «Включает все статусы». При включении диаграммы и карточки показывают сводку по всем записям (и в работе, и завершённые). При выключении действует фильтр «Статус».',
          'Статус — выпадающий список «В работе» или «Завершено». «В работе» — только не завершённые проекты, экземпляры БП и задачи; «Завершено» — только завершённые, проваленные или удалённые.',
        ],
        keyIcons: [
          { icon: <MdDateRange />, label: 'С / По', meaning: 'Период дат для расчёта аналитики.' },
          { icon: <FcDepartment />, label: 'Отдел', meaning: 'Фильтр по отделу (автор/ответственный/исполнитель).' },
          { icon: <FaUsers />, label: 'Сотрудник', meaning: 'Фильтр по конкретному сотруднику.' },
          { icon: <MdFilterList />, label: 'Общая статистика', meaning: 'Показывать все статусы; иначе — только «В работе» или «Завершено».' },
        ],
        tips: [
          'При смене отдела список «Сотрудник» обновляется. Сброс отдела очищает и выбор сотрудника.',
        ],
      },
    ],
  },
  {
    id: 'charts-intro',
    title: 'Круговые диаграммы — общее',
    items: [
      {
        id: 'charts-how',
        title: 'Как работают диаграммы',
        purpose:
          'На вкладке «Графики» отображаются круговые диаграммы. Содержание каждой зависит от выбранного фильтра статуса: «В работе», «Завершено» или «Общая статистика». Ниже по каждой диаграмме описано, что она показывает при каждом из этих трёх вариантов.',
        steps: [
          'В работе — в диаграммах учитываются только не завершённые проекты, запущенные экземпляры БП и задачи в работе (включая просроченные).',
          'Завершено — только завершённые, проваленные или удалённые проекты/БП и выполненные задачи.',
          'Общая статистика — все записи вместе: и в работе, и завершённые.',
        ],
      },
    ],
  },
  {
    id: 'chart-category',
    title: 'Диаграмма «По категориям»',
    items: [
      {
        id: 'category-in-progress',
        title: 'По категориям — при фильтре «В работе»',
        purpose: 'Показывает соотношение трёх категорий: только те, что в работе.',
        steps: [
          'Проекты — количество проектов, которые ещё не завершены (не в статусах Завершено, Провал, Удален).',
          'Бизнес-процессы — количество экземпляров БП в статусе «в работе» (запущены и не завершены).',
          'Задачи — количество задач в работе (отдельные задачи и подзадачи проектов), включая просроченные.',
        ],
      },
      {
        id: 'category-completed',
        title: 'По категориям — при фильтре «Завершено»',
        purpose: 'Показывает соотношение только завершённых по категориям.',
        steps: [
          'Проекты — завершённые, проваленные и удалённые проекты.',
          'Бизнес-процессы — завершённые и проваленные экземпляры БП.',
          'Задачи — выполненные задачи.',
        ],
      },
      {
        id: 'category-general',
        title: 'По категориям — при «Общая статистика»',
        purpose: 'Сводка по всем записям без разбиения по статусу.',
        steps: [
          'Проекты — общее количество проектов (все статусы).',
          'Бизнес-процессы — общее количество экземпляров БП.',
          'Задачи — общее количество задач (отдельные и подзадачи).',
        ],
      },
    ],
  },
  {
    id: 'chart-projects',
    title: 'Диаграмма «Проекты»',
    items: [
      {
        id: 'projects-in-progress',
        title: 'Проекты — при фильтре «В работе»',
        purpose: 'Детализация только не завершённых проектов.',
        steps: [
          'На паузе — проекты в статусе паузы.',
          'В работе — остальные проекты, которые ещё не завершены (активные).',
        ],
      },
      {
        id: 'projects-completed',
        title: 'Проекты — при фильтре «Завершено»',
        purpose: 'Доли по итоговым статусам проектов.',
        steps: [
          'Завершено — успешно завершённые проекты.',
          'Провал — проекты, завершённые с провалом.',
          'Удалено — удалённые проекты.',
        ],
      },
      {
        id: 'projects-general',
        title: 'Проекты — при «Общая статистика»',
        purpose: 'Все проекты с разбивкой по статусам.',
        steps: [
          'Завершено, В работе, На паузе, Провал, Удалено — полная разбивка по всем статусам проектов.',
        ],
      },
    ],
  },
  {
    id: 'chart-tasks',
    title: 'Диаграмма «Задачи»',
    items: [
      {
        id: 'tasks-in-progress',
        title: 'Задачи — при фильтре «В работе»',
        purpose: 'Задачи в работе с разбивкой по статусам канбана и просрочке.',
        steps: [
          'Просрочка — задачи с просроченным дедлайном (дедлайн прошёл, задача не выполнена).',
          'Список задач, К выполнению, В ожидании, В процессе, Выполнено (ожидает одобрения), Приостановлено — остальные задачи по статусам колонок канбана.',
        ],
      },
      {
        id: 'tasks-completed',
        title: 'Задачи — при фильтре «Завершено»',
        purpose: 'Только выполненные задачи и просроченные на момент завершения.',
        steps: [
          'Выполнено — задачи в статусе «выполнено».',
          'Просрочено — задачи, которые были завершены с просроченным дедлайном.',
        ],
      },
      {
        id: 'tasks-general',
        title: 'Задачи — при «Общая статистика»',
        purpose: 'Все задачи: выполненные, в работе и просроченные.',
        steps: [
          'Выполнено — завершённые задачи.',
          'Просрочено — задачи с просроченным дедлайном.',
          'В работе — задачи, которые ещё не выполнены и не в просрочке.',
        ],
      },
    ],
  },
  {
    id: 'chart-bp',
    title: 'Диаграмма «Бизнес-процессы»',
    items: [
      {
        id: 'bp-in-progress',
        title: 'Бизнес-процессы — при фильтре «В работе»',
        purpose: 'Только запущенные и не завершённые экземпляры БП.',
        steps: ['В работе — количество экземпляров бизнес-процессов, которые сейчас выполняются.'],
      },
      {
        id: 'bp-completed',
        title: 'Бизнес-процессы — при фильтре «Завершено»',
        purpose: 'Только завершённые и проваленные экземпляры.',
        steps: [
          'Завершено — успешно завершённые экземпляры БП.',
          'Провал — экземпляры, завершённые с ошибкой/провалом.',
        ],
      },
      {
        id: 'bp-general',
        title: 'Бизнес-процессы — при «Общая статистика»',
        purpose: 'Все экземпляры БП по статусам.',
        steps: [
          'Завершено, В работе, Провал — полная разбивка по статусам экземпляров бизнес-процессов.',
        ],
      },
    ],
  },
  {
    id: 'chart-departments',
    title: 'Диаграмма «Загрузка по отделам»',
    items: [
      {
        id: 'dept-desc',
        title: 'Что показывает диаграмма',
        purpose:
          'Распределение нагрузки по отделам. Учитываются проекты (отдел автора или ответственного) и задачи (отдел исполнителя). Логика одинакова при любом фильтре статуса: «В работе», «Завершено» или «Общая статистика» — в диаграмму попадают те же наборы проектов и задач, что и в остальные блоки при выбранном фильтре, но сгруппированные по отделам.',
        steps: [
          'По каждому отделу суммируются: число проектов (где сотрудник отдела — автор или ответственный) и число задач (где сотрудник отдела — исполнитель).',
          'Отображаются только отделы, у которых суммарное количество проектов и задач больше нуля.',
        ],
        tips: [
          'Фильтр «Отдел» или «Сотрудник» сужает данные: в диаграмме будут только выбранный отдел/сотрудник и их нагрузка.',
        ],
      },
    ],
  },
  {
    id: 'chart-load-by-author',
    title: 'Диаграмма «Кто создаёт нагрузку»',
    items: [
      {
        id: 'load-author-desc',
        title: 'Когда появляется и что показывает',
        purpose:
          'Эта диаграмма видна только при выбранном фильтре «Отдел» или «Сотрудник». Она показывает, какие отделы создают нагрузку на выбранного исполнителя: доли проектов и задач по отделам-авторам.',
        steps: [
          'По оси отображаются отделы (авторы задач и проектов). Значение — сколько задач/проектов создано сотрудниками этого отдела и пришло в работу выбранному отделу или сотруднику.',
          'Поле «Кто создаёт нагрузку» помогает понять направление нагрузки: кто чаще всего ставит задачи выбранному исполнителю или отделу.',
        ],
        tips: [
          'Без выбранного отдела или сотрудника диаграмма не отображается.',
        ],
      },
    ],
  },
  {
    id: 'tables',
    title: 'Вкладка «Таблицы»',
    items: [
      {
        id: 'table-overview',
        title: 'Что показывают таблицы',
        purpose:
          'На вкладке «Таблицы» выводятся две таблицы: по отделам и по сотрудникам. Данные в них зависят от тех же фильтров (период, отдел, сотрудник, статус или общая статистика), что и диаграммы.',
        steps: [
          'Переключите вид с «Графики» на «Таблицы» кнопкой над блоком диаграмм.',
        ],
      },
      {
        id: 'table-departments',
        title: 'Таблица «Проекты и задачи» по отделам',
        purpose: 'По каждому отделу: количество проектов, задач и просрочек.',
        steps: [
          'Колонки: Отдел, Проекты, Задачи, Просрочки. Проекты и задачи считаются так же, как в диаграмме «Загрузка по отделам» (проекты — автор/ответственный из отдела, задачи — исполнитель из отдела). Просрочки — задачи с просроченным дедлайном по исполнителю отдела.',
          'При фильтре «В работе» — только не завершённые проекты и задачи в работе; при «Завершено» — только завершённые; при «Общая статистика» — все.',
        ],
      },
      {
        id: 'table-employees',
        title: 'Таблица «По сотрудникам»',
        purpose: 'По каждому сотруднику: проекты, задачи (или выполнено), просрочки.',
        steps: [
          'Колонки: Сотрудник, Отдел, Проекты, Задачи (или «Выполнено задач» при фильтре «Завершено»), Просрочки.',
          'Проекты — где сотрудник автор или ответственный; задачи — где исполнитель. При «В работе» показываются задачи в работе, при «Завершено» — количество выполненных задач.',
        ],
      },
    ],
  },
  {
    id: 'bp-detail',
    title: 'Детали по бизнес-процессам',
    items: [
      {
        id: 'bp-detail-purpose',
        title: 'Назначение блока',
        purpose:
          'Блок «Детали по бизнес-процессам» позволяет выбрать конкретный бизнес-процесс и посмотреть, на каких этапах уходит время, какой этап является узким местом, и кто из участников или отделов дольше всего выполняет задачи этого процесса.',
        steps: [
          'В выпадающем списке «Бизнес-процесс» выберите процесс. В списке отображаются название, общее число экземпляров и число завершённых за выбранный период.',
          'После выбора подгружаются таблица этапов и, при наличии данных, блок «Кто тормозит выполнение».',
        ],
      },
      {
        id: 'bp-nodes-table',
        title: 'Таблица этапов процесса',
        purpose:
          'Для каждого узла (этапа) показываются ср. и макс. время (без суммирования по экземплярам). По этим данным определяется «узкое место» — этап с наибольшим макс. временем за один проход.',
        steps: [
          'Ср. время процесса — от старта до завершения каждого экземпляра (не сумма по этапам).',
          'Всего (ср.) — среднее время этапа целиком (этап + задачи + проекты + почта).',
          'Этап, Задачи БП, Проекты, В проектах — детализация по составляющим.',
          'Почта (раундов) — количество раундов переписки. Почта (ожидание ответа) — сумма времени ожидания между раундами.',
          'Задач, Просрочено — количество задач и просроченных.',
          'Узкое место — этап с наибольшим средним временем.',
        ],
        tips: [
          'Среднее время отражает типичную ситуацию и реагирует на улучшения. Макс. показывает худший случай за период.',
        ],
      },
      {
        id: 'bp-bottlenecks',
        title: 'Кто тормозит выполнение',
        purpose:
          'После таблицы этапов, при наличии данных, выводятся таблицы «По участникам» и «По отделам»: кто из исполнителей и какой отдел дольше всего выполняют задачи выбранного процесса (среднее и суммарное время, просрочки).',
        steps: [
          'По участникам: Участник, Отдел, Задач, Выполнено, Ср. время, Всего время, Просрочено, Детализация (на что ушло время: задачи, подзадачи, проекты, почта).',
          'По отделам: те же метрики, но сгруппированные по отделам. Детализация показывает вклад задач, подзадач, проектов и переписки по почте.',
        ],
      },
    ],
  },
]

const stripJsx = (value) => {
  try {
    if (value == null) return ''
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value.map(stripJsx).join(' ')
    if (typeof value === 'object' && value !== null && 'props' in value) {
      const children = value.props && value.props.children
      return stripJsx(children)
    }
    return String(value)
  } catch (_) {
    return ''
  }
}

const HelpModalProcessMonitoring = ({ open, onClose }) => {
  const [query, setQuery] = useState('')
  const [selectedTab, setSelectedTab] = useState('main')
  const [showDetails, setShowDetails] = useState(true)
  const contentRef = useRef(null)
  const [activeAnchor, setActiveAnchor] = useState('')

  const exportHelpToWord = async () => {
    try {
      const docChildren = []
      docChildren.push(
        new Paragraph({
          text: 'Справка: Мониторинг процессов',
          heading: HeadingLevel.TITLE,
        })
      )
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Экспортировано из встроенной справки.',
              italics: true,
            }),
          ],
        })
      )
      tabs.forEach((tab) => {
        docChildren.push(new Paragraph({ text: tab.title, heading: HeadingLevel.HEADING_1 }))
        const allowedIds = new Set(tab.sectionIds)
        const sectionsToExport = sections.filter((s) => allowedIds.has(s.id))
        sectionsToExport.forEach((section) => {
          docChildren.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2 }))
          ;(section.items || []).forEach((item) => {
            docChildren.push(new Paragraph({ text: item.title, heading: HeadingLevel.HEADING_3 }))
            if (item.purpose) {
              docChildren.push(
                new Paragraph({
                  children: [new TextRun({ text: stripJsx(item.purpose) })],
                })
              )
            }
            if (item.steps && item.steps.length) {
              item.steps.forEach((s) => {
                docChildren.push(
                  new Paragraph({
                    children: [new TextRun({ text: stripJsx(s) })],
                    bullet: { level: 0 },
                  })
                )
              })
            }
            if (item.keyIcons && item.keyIcons.length) {
              item.keyIcons.forEach((ki) => {
                docChildren.push(
                  new Paragraph({
                    children: [new TextRun({ text: `${stripJsx(ki.label)} — ${stripJsx(ki.meaning)}` })],
                    bullet: { level: 0 },
                  })
                )
              })
            }
            if (item.tips && item.tips.length) {
              item.tips.forEach((t) => {
                docChildren.push(
                  new Paragraph({
                    children: [new TextRun({ text: stripJsx(t) })],
                    bullet: { level: 0 },
                  })
                )
              })
            }
          })
        })
      })
      const doc = new Document({
        sections: [{ properties: {}, children: docChildren }],
      })
      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Справка_Мониторинг_процессов.docx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export to Word failed', error)
    }
  }

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

  const handleScroll = (container) => {
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
    } catch (_) {
      setActiveAnchor('')
    }
  }

  useEffect(() => {
    if (contentRef.current) handleScroll(contentRef.current)
  }, [results])

  if (!open) return null

  return (
    <div className="modal-overlay-creat-group">
      <div className="modal-content-creat-group" style={{ maxWidth: '980px' }}>
        <AiFillCloseCircle className="modal-overlay-close-creat-group" onClick={onClose} />

        <strong className="title-creat-group">Справка: Мониторинг процессов</strong>
        <p style={{ opacity: 0.8, marginBottom: 8 }}>
          Назначение раздела, фильтры, круговые диаграммы при разных статусах, таблицы и детали по бизнес-процессам. Воспользуйтесь поиском ниже.
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
            onClick={exportHelpToWord}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.1)',
              cursor: 'pointer',
            }}
            title="Скачать справку в Word"
          >
            Скачать в Word
          </button>
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
          placeholder="Поиск по разделам и шагам..."
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
                      const firstIcon =
                        item.keyIcons && item.keyIcons[0] ? item.keyIcons[0].icon : null
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
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              color: isActive ? '#0b63c5' : 'inherit',
                              fontWeight: isActive ? 600 : 400,
                            }}
                            title={item.title}
                          >
                            {firstIcon}
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
            onScroll={(e) => handleScroll(e.currentTarget)}
            style={{ maxHeight: '66vh', overflow: 'auto', paddingRight: 6, flex: 1 }}
          >
            {results.map((section) => (
              <div key={section.id} style={{ marginBottom: 16 }}>
                <h3 style={{ margin: '6px 0' }}>{section.title}</h3>
                {(section.items || []).map((item) => (
                  <div
                    key={item.id}
                    id={`${section.id}-${item.id}`}
                    style={{ padding: '8px 0', borderTop: '1px dashed rgba(0,0,0,0.1)' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <h4 style={{ margin: 0 }}>{item.title}</h4>
                    </div>

                    {showDetails && item.purpose && (
                      <p style={{ margin: '6px 0' }}>{item.purpose}</p>
                    )}

                    {item.steps && item.steps.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Подробнее</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {item.steps.map((s, idx) => (
                            <li key={idx}>{typeof s === 'string' ? s : stripJsx(s)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {showDetails && item.keyIcons && item.keyIcons.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Элементы интерфейса</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {item.keyIcons.map((icon, idx) => (
                            <li
                              key={`${icon.label}-${idx}`}
                              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
                            <li key={idx}>{typeof t === 'string' ? t : stripJsx(t)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HelpModalProcessMonitoring
