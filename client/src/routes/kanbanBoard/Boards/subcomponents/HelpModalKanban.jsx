import { useMemo, useState, useEffect, useRef } from 'react'
import { AiFillCloseCircle } from 'react-icons/ai'
import {
  FcParallelTasks,
  FcTreeStructure,
  FcHighPriority,
  FcMediumPriority,
  FcLowPriority,
  FcAbout,
  FcMindMap,
} from 'react-icons/fc'
import {
  MdOutlineEditNotifications,
  MdHistoryEdu,
  MdAutorenew,
  MdEdit,
  MdDelete,
  MdSave,
  MdAdd,
} from 'react-icons/md'
import { FaTasks, FaFile, FaFileAlt, FaEye, FaDownload } from 'react-icons/fa'
import { AiOutlineFundProjectionScreen } from 'react-icons/ai'
import { IoMdNotificationsOff, IoIosSearch } from 'react-icons/io'
import { FiFilter } from 'react-icons/fi'
import { RxWidth } from 'react-icons/rx'
import { CiTimer } from 'react-icons/ci'
import { TbSubtask } from 'react-icons/tb'
import { IoIosChatboxes } from 'react-icons/io'
import { FaFileMedical } from 'react-icons/fa6'
import { PiNotebookFill } from 'react-icons/pi'
import '../NotificationManager/subcomponents/HelpModal.scss'
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'

const normalize = (v) => (v || '').toString().toLowerCase().trim()

const tabs = [
  {
    id: 'board',
    title: 'Канбан доска',
    sectionIds: [
      'overview',
      'visibility',
      'toolbar',
      'sidebar',
      'context-menu',
      'task-list',
      'projects',
      'notifications-history',
      'columns',
      'dnd',
      'notification-manager',
    ],
  },
  { id: 'task', title: 'Карточка задачи', sectionIds: ['task-card'] },
  { id: 'notification', title: 'Уведомление', sectionIds: ['notifications'] },
  { id: 'create', title: 'Создать задачу', sectionIds: ['create'] },
  { id: 'faq', title: 'FAQ', sectionIds: ['faq'] },
]

const sections = [
  {
    id: 'overview',
    title: 'Обзор канбан-доски',
    items: [
      {
        id: 'purpose',
        title: 'Зачем нужна доска',
        purpose:
          'Канбан помогает видеть, где сейчас каждая задача: от идеи до результата. Вы перетаскиваете карточки по этапам и сразу понимаете, что горит, кто отвечает и что мешает завершить.',
        steps: [
          'Сверху есть поиск — набирайте ключевые слова из названия, описания, тегов или приоритета.',
          'Карточки можно перетаскивать между колонками, чтобы сменить статус.',
          'Двойной щелчок мыши по карточке задачи, чтобы открыть основное описание.',
        ],
        result: 'Прозрачная картина работ по людям, срокам и статусам без лишних переключений.',
        tips: [
          <>
            Если задача подсвечена как проектная <FcMindMap /> — это часть большого проекта.
          </>,
        ],
      },
      {
        id: 'types',
        title: 'Два типа карточек: уведомления и задачи',
        purpose:
          'В колонке «Уведомления» — напоминания (например, о звонках, которые возможно создать пользователем, либо запросы от дилеров, подключенные к ТГ боту). В остальных колонках — именно задачи с исполнителями и сроками.',
        steps: [
          'Уведомления формируются из напоминаний в системе и группируются по дилеру.',
          'Задачи создаются вручную или из форм других разделов и имеют роли: исполнитель, утверждающий, наблюдатель.',
        ],
        tips: [
          'Уведомления нельзя перетаскивать в другие колонки. После выполнения их необходимо удалить нажатием на иконку корзины, после чего уведомления хранятся в отдельном компоненте "История завершенных еведомлений".',
        ],
      },
    ],
  },
  {
    id: 'visibility',
    title: 'Кто и что видит',
    items: [
      {
        id: 'roles-visibility',
        title: 'Роли и видимость',
        steps: [
          'Исполнитель (assigned_user_ids): видит задачу, может перемещать её между статусами и работать с вложениями/чатом.',
          'Утверждающий (approver_user_ids): видит задачу, подтверждает результат. Если не все утвердили — у иконки апрува нет зелёной подсветки.',
          'Наблюдатель (visibility_user_ids): видит задачу, но не меняет статусы.',
        ],
        tips: [
          'Перетаскивание разрешено только исполнителю. Для остальных иконка «ручки» перетаскивания заблокирована.',
          'Видимость чужой канбан-доски следует иерархии: руководитель видит только доски своих прямых и нижестоящих подчинённых; сотрудник видит только свои задачи и уведомления.',
        ],
      },
      {
        id: 'notifications-visibility',
        title: 'Кому видны уведомления',
        steps: [
          'Уведомления привязаны к пользователю/группе: их видит назначенный сотрудник и ответственные лица.',
          'В истории завершённых уведомлений фиксируется факт закрытия и время — это доступно для контроля руководителем.',
        ],
      },
    ],
  },
  {
    id: 'toolbar',
    title: 'Панель инструментов доски',
    items: [
      {
        id: 'toolbar-icons',
        title: 'Иконки панели',
        keyIcons: [
          {
            icon: <FcTreeStructure />,
            label: 'Открыть боковую панель',
            meaning: 'Показать боковую панель с выбором сотрудника и вспомогательными панелями.',
          },
          {
            icon: <FcParallelTasks />,
            label: 'Закрыть боковую панель',
            meaning: 'Скрыть боковую панель.',
          },
          {
            icon: <MdOutlineEditNotifications />,
            label: 'Менеджер уведомлений',
            meaning: 'Создание/редактирование напоминаний, перенос их в работу.',
          },
          {
            icon: <FaTasks />,
            label: 'Лист задач',
            meaning: 'Плоский список задач для массовых операций.',
          },
          {
            icon: <AiOutlineFundProjectionScreen />,
            label: 'Проекты',
            meaning: 'Переход к списку проектов и их задач.',
          },
          {
            icon: <IoMdNotificationsOff />,
            label: 'История уведомлений',
            meaning: 'Архив завершённых уведомлений.',
          },
        ],
        tips: ['Над панелью — строка поиска. Фильтрация не сбрасывает DnD и не влияет на статусы.'],
      },
    ],
  },
  {
    id: 'sidebar',
    title: 'Боковая панель (Sidebar)',
    items: [
      {
        id: 'sidebar-overview',
        title: 'Что внутри боковой панели',
        purpose:
          'Быстрый доступ к выбору сотрудника, дополнительным фильтрам/плиткам и вспомогательным панелям, влияющим на отображение доски. Иерархия доступа: руководитель видит только своих подчинённых (прямых и нижестоящих), сотрудник — только себя.',
        steps: [
          'Откройте панель (иконка «дерево»).',
          'Выберите сотрудника — доска загрузит его задачи и уведомления (с учётом ваших прав).',
          'Используйте вложенные панели (если доступны) для дополнительной фильтрации и аналитики.',
        ],
        keyIcons: [
          {
            icon: <FcTreeStructure />,
            label: 'Открыть панель',
            meaning: 'Показать боковую панель для выбора сотрудника и фильтров.',
          },
          {
            icon: <FcParallelTasks />,
            label: 'Закрыть панель',
            meaning: 'Свернуть боковую панель для экономии места.',
          },
        ],
        tips: [
          'Закройте панель (иконка «параллельные задачи»), чтобы освободить место на экране.',
          'Видимость досок подчинённых ограничена вашей ролью и иерархией.',
        ],
      },
    ],
  },
  {
    id: 'context-menu',
    title: 'Контекстное меню карточки',
    items: [
      {
        id: 'context-actions',
        title: 'Доступные действия (для руководителей)',
        purpose:
          'Вызов контекстного меню позволяет быстро переназначить уведомление, добавить служебный тег (аудит) и выполнить дополнительные операции. Сервер обновляет напоминание и добавляет тег с фамилиями «от кого/кому».',
        steps: [
          'Откройте меню (иконка на карточке/кнопка действий).',
          'Найдите сотрудника через поиск и выберите — создастся системный тег о передаче.',
          'Подтвердите действие — напоминание сохранится на сервере и будет отображаться у выбранного сотрудника.',
        ],
        keyIcons: [
          { icon: <MdEdit />, label: 'Переназначить', meaning: 'Выбор нового ответственного.' },
          {
            icon: <FaFileAlt />,
            label: 'Тег аудита',
            meaning: 'Автоматический служебный тег о передаче «от кого/кому».',
          },
          { icon: <MdSave />, label: 'Сохранить', meaning: 'Подтвердить изменения уведомления.' },
        ],
        tips: ['Состав меню может меняться в зависимости от статуса и ваших ролей.'],
      },
    ],
  },
  {
    id: 'task-list',
    title: 'Лист задач',
    items: [
      {
        id: 'task-list-overview',
        title: 'Плоский список для массовых операций',
        purpose:
          'Удобен для быстрого просмотра/фильтрации большого числа задач без визуальных колонок.',
        steps: [
          'Откройте лист задач (иконка «лист»).',
          'Используйте поиск (иконка поиска) и фильтры (иконка фильтра) по тегам, приоритетам, срокам, ролям.',
          'Выполняйте массовые действия: изменить приоритет, назначить исполнителя, применить теги (если доступны полномочия).',
        ],
        keyIcons: [
          { icon: <IoIosSearch />, label: 'Поиск', meaning: 'Быстрый текстовый поиск по полям.' },
          {
            icon: <FiFilter />,
            label: 'Фильтр',
            meaning: 'Открывает панель фильтрации по параметрам.',
          },
          {
            icon: <MdEdit />,
            label: 'Изменить',
            meaning: 'Массовое редактирование выбранных задач.',
          },
          { icon: <MdDelete />, label: 'Удалить', meaning: 'Удаление (если разрешено ролью).' },
          {
            icon: <MdSave />,
            label: 'Сохранить',
            meaning: 'Применить изменения к выбранным задачам.',
          },
        ],
        tips: [
          'Используйте лист, когда нужно быстро найти и обработать несколько задач подряд.',
          'Часть действий может быть недоступна без роли администратора/руководителя.',
        ],
      },
    ],
  },
  {
    id: 'projects',
    title: 'Проекты',
    items: [
      {
        id: 'projects-overview',
        title: 'Задачи в контексте проектов',
        purpose:
          'Связь задач с проектами позволяет управлять прогрессом на уровне инициатив/эпиков.',
        steps: [
          'Перейдите в раздел проектов (иконка «экран проекта»).',
          'Откройте проект, отслеживайте статусы подзадач, документы, историю.',
          'Возвращайтесь на доску для оперативной работы по задачам проекта.',
        ],
        keyIcons: [
          {
            icon: <AiOutlineFundProjectionScreen />,
            label: 'Проект',
            meaning: 'Переход в карточку проекта и его структуру.',
          },
          { icon: <MdHistoryEdu />, label: 'История', meaning: 'История изменений и описаний.' },
          { icon: <FaFileAlt />, label: 'Документы', meaning: 'Файлы и вложения проекта.' },
        ],
      },
    ],
  },
  {
    id: 'notifications-history',
    title: 'История уведомлений',
    items: [
      {
        id: 'notifications-history-overview',
        title: 'Архив завершённых уведомлений',
        purpose: 'Журнал всех закрытых уведомлений для контроля своевременности реакции и аудита.',
        steps: [
          'Откройте историю уведомлений (иконка «звонок с перечёркиванием»).',
          'Просмотрите дату/время закрытия и содержание уведомления.',
          'Используйте как источник правды по обработке уведомлений.',
        ],
      },
    ],
  },
  {
    id: 'notification-manager',
    title: 'Менеджер уведомлений',
    items: [
      {
        id: 'nm-overview',
        title: 'Создание и редактирование напоминаний',
        purpose:
          'Единое место для планирования напоминаний (звонки, задачи внимания), которые затем попадают в колонку «Уведомления».',
        steps: [
          'Создайте напоминание: укажите заголовок, комментарий, дату/время отображения.',
          'Редактируйте или переносите напоминание в работу при необходимости.',
        ],
        keyIcons: [
          { icon: <MdAdd />, label: 'Добавить', meaning: 'Создать новое напоминание.' },
          {
            icon: <MdEdit />,
            label: 'Редактировать',
            meaning: 'Изменить дату/время и комментарий.',
          },
          { icon: <MdSave />, label: 'Сохранить', meaning: 'Подтвердить изменения.' },
          {
            icon: <MdDelete />,
            label: 'Удалить',
            meaning: 'Удалить напоминание (при необходимости).',
          },
          { icon: <FaFileAlt />, label: 'Детали', meaning: 'Просмотр полного текста/описания.' },
        ],
        tips: [
          'Следите за корректностью даты/времени — от этого зависит своевременное появление карточки на доске.',
          'Названия делайте говорящими: это ускоряет обработку в колонке «Уведомления».',
        ],
      },
    ],
  },
  {
    id: 'columns',
    title: 'Колонки и статусы',
    items: [
      {
        id: 'columns-list',
        title: 'Список колонок',
        steps: [
          'Уведомления — входящие напоминания, сгруппированы по дилерам (имя дилера берётся из заголовка между *звёздочками*).',
          'Список задач — точка входа. Здесь кнопка «Создать задачу».',
          'К выполнению — задача принята в работу исполнителем.',
          'В ожидании — ждём внешних условий/согласований.',
          'В процессе — активная работа.',
          'Выполнено — работа завершена, ожидается подтверждение автора/апруверов.',
          'Приостановлено — временная пауза. Перемещение сюда и отсюда ограничено.',
        ],
        tips: [
          'В «Выполнено» можно перенести только после автоматической проверки: все подзадачи должны быть закрыты.',
          'В «Уведомления» перенос задач не допускается.',
        ],
      },
    ],
  },
  {
    id: 'dnd',
    title: 'Перетаскивание и правила',
    items: [
      {
        id: 'drag-rules',
        title: 'Кто может перетаскивать и когда',
        steps: [
          'Только исполнитель задачи может менять её колонку.',
          'Перенос в «Выполнено» открывает диалог подтверждения и запускает проверку подзадач. После проверки автором, задача может быть одобрена на завершение, либо возвращена на доработку с комментарием. Такие задачи обозначаются отдельным тэгом и иконкой комментария от автора.',
          'Колонка «Приостановлено» закрыта для DnD — защита от случайных перемещений. Предназначена для автоматического переноса задач в случае приостановки общего проекта.',
        ],
      },
    ],
  },
  {
    id: 'task-card',
    title: 'Карточка задачи: из чего состоит',
    items: [
      {
        id: 'task-main',
        title: 'Содержимое карточки',
        steps: [
          'Заголовок: номер задачи и иконка «Развернуть» для быстрого входа в модальное окно.',
          'Теги: цветные метки контекста. Если меток нет — видно «БЕЗ ТЭГА».',
          'Описание: поддержка форматированного текста и изображений, ссылки на файлы.',
          'Участники: Автор, Мониторы (наблюдатели), Апруверы (подсветка зелёным — утверждено).',
          'Приоритет: высокая/средняя/низкая важность с подсказкой.',
          <>
            История описания: <MdHistoryEdu /> показывает все правки текста описания с датами.
          </>,
          <>
            Проект: <FcMindMap /> и статус проекта (если задача связана с проектом).
          </>,
          <>
            Срок: дата, таймер <CiTimer /> оставшегося времени и индикатор срочности (пульсация при
            критичном сроке).
          </>,
        ],
      },
      {
        id: 'task-icons',
        title: 'Иконки в карточке',
        keyIcons: [
          {
            icon: <RxWidth />,
            label: 'Развернуть',
            meaning: 'Открыть подробности (модальное окно).',
          },
          {
            icon: <FcHighPriority />,
            label: 'Высокий приоритет',
            meaning: 'Красная метка приоритета.',
          },
          {
            icon: <FcMediumPriority />,
            label: 'Средний приоритет',
            meaning: 'Жёлтая метка приоритета.',
          },
          {
            icon: <FcLowPriority />,
            label: 'Низкий приоритет',
            meaning: 'Зелёная метка приоритета.',
          },
          {
            icon: <FcAbout />,
            label: 'Комментарии к доработке',
            meaning: 'Показывает список комментариев.',
          },
          {
            icon: <TbSubtask />,
            label: 'Подзадачи',
            meaning: 'Открывает иерархию; зелёная подсветка — все выполнены.',
          },
          { icon: <FcMindMap />, label: 'Проект', meaning: 'Задача привязана к проекту.' },
          {
            icon: <MdHistoryEdu />,
            label: 'Описания',
            meaning:
              'Изменения описания с датами. Служит для отображения автором необходимых изменений в задачах, которые были возвращены на доработку.',
          },
          { icon: <CiTimer />, label: 'Таймер', meaning: 'Оставшееся время до дедлайна.' },
          {
            icon: <MdAutorenew />,
            label: 'Запрос продления',
            meaning: 'Открывает запрос продления срока.',
          },
          { icon: <FaFile />, label: 'Файл', meaning: 'Ссылка на вложение (не изображение).' },
        ],
        preview: 'icons',
      },
      {
        id: 'speed-dial',
        title: 'Действия (кнопка с плавающим меню)',
        keyIcons: [
          {
            icon: <IoIosChatboxes />,
            label: 'Чат',
            meaning: 'Переписка по задаче. Иконка подсвечивается, если есть непрочитанные.',
          },
          {
            icon: <FaFileMedical />,
            label: 'Добавить файл',
            meaning: 'Загрузка нескольких файлов, при желании — с комментариями к каждому.',
          },
          {
            icon: <PiNotebookFill />,
            label: 'Заметки',
            meaning:
              'Работа с комментариями к задаче. Заметка отображается только для её создателя.',
          },
          {
            icon: <TbSubtask />,
            label: 'Создать подзадачу',
            meaning: 'Быстрое создание подзадачи, связанной с текущей.',
          },
        ],
        tips: ['Опасные форматы (exe, bat, sh, js и т.д.) блокируются системой для безопасности.'],
      },
      {
        id: 'deadline-demo',
        title: 'Демо: срок и продление',
        purpose:
          'Посмотрите, как выглядит блок срока и кнопка запроса продления (демонстрация без отправки).',
        steps: [
          'Нажмите на иконку обновления в демо-блоке ниже — откроется демонстрационное окно запроса продления.',
          'Это окно в справке не отправляет запрос, а только показывает, как он выглядит в интерфейсе.',
        ],
        preview: 'deadline',
        tips: ['Пульсирующая рамка означает высокий приоритет/критический срок.'],
      },
    ],
  },
  {
    id: 'create',
    title: 'Создание и оформление задачи',
    items: [
      {
        id: 'create-form',
        title: 'Форма создания',
        steps: [
          'Заполните: Название, Описание (редактор с форматированием), Срок, Приоритет.',
          'Назначьте роли: Исполнители (можно несколько) — на каждого создаётся своя карточка; Утверждающие; Наблюдатели.',
          'Добавьте теги — для контекстной фильтрации и быстрой ориентации.',
          'Прикрепите файлы — изображения получат превью, прочие будут ссылкой с иконкой файла.',
        ],
        tips: ['После сохранения всем участникам уходят уведомления (сокет).'],
      },
      {
        id: 'extend-deadline',
        title: 'Продление срока',
        steps: [
          'Нажмите иконку «Запрос продления».',
          'Укажите причину и, при необходимости, предложите новую дату.',
          'Автор/руководитель получит уведомление и сможет согласовать перенос.',
        ],
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Уведомления: откуда берутся и как с ними работать',
    items: [
      {
        id: 'source',
        title: 'Источник уведомлений',
        purpose:
          'Уведомления — это запланированные напоминания (например, перезвонить клиенту). Они подхватываются доской автоматически и попадают в колонку «Уведомления».',
        steps: [
          'Менеджер уведомлений: создайте/отредактируйте напоминание, назначьте время и комментарий.',
          'Доска Канбан: напоминание преобразуется в карточку уведомления и группируется по дилеру.',
        ],
        tips: [
          'Отправка текста дилеру из уведомления — односторонняя: дилер не отвечает в это же уведомление.',
          'После обработки удаляйте уведомление (иконка корзины) — оно попадёт в «Историю завершённых уведомлений».',
          'Если уведомление требует дальнейшей работы, преобразуйте его в задачу и назначьте роли.',
        ],
      },
      {
        id: 'history',
        title: 'История завершённых уведомлений',
        steps: [
          'Откройте архив, чтобы посмотреть, что и когда было закрыто.',
          'Фильтруйте по дилеру, ищите по описанию, сортируйте по дате/приоритету.',
          'В деталях уведомления доступны сообщения и прикреплённые файлы с проверкой доступности.',
        ],
        keyIcons: [
          { icon: <FaEye />, label: 'Просмотр файла', meaning: 'Открывает файл в новой вкладке.' },
          { icon: <FaDownload />, label: 'Скачать файл', meaning: 'Скачивает файл на устройство.' },
        ],
      },
    ],
  },
  {
    id: 'faq',
    title: 'FAQ и нюансы',
    items: [
      {
        id: 'drag-denied',
        title: 'Почему не перетаскивается задача',
        steps: [
          'Вы не исполнитель задачи — назначьте себя или попросите автора.',
          'Задача/колонка под ограничением (например, «Приостановлено»).',
          'Вы пытаетесь перетащить в «Уведомления» — это запрещено.',
        ],
      },
      {
        id: 'done-denied',
        title: 'Почему нельзя завершить',
        steps: [
          'Есть незавершённые подзадачи — закройте их. Затем подтвердите перенос в «Выполнено».',
        ],
      },
      {
        id: 'who-sees',
        title: 'Кому видна карточка',
        steps: [
          'Автор, назначенные исполнители, утверждающие и наблюдатели.',
          'Руководители видят архив уведомлений и сводные панели.',
        ],
      },
    ],
  },
]

const HelpModalKanban = ({ open, onClose }) => {
  const [query, setQuery] = useState('')
  const [selectedTab, setSelectedTab] = useState('board')
  const [showDetails, setShowDetails] = useState(true)
  const contentRef = useRef(null)
  const [activeAnchor, setActiveAnchor] = useState('')
  const [deadlineDemoOpen, setDeadlineDemoOpen] = useState(false)

  const exportHelpToWord = async () => {
    try {
      const docChildren = []

      docChildren.push(
        new Paragraph({
          text: 'Справка: Канбан-доска',
          heading: HeadingLevel.TITLE,
        })
      )
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Экспортировано из встроенной справки (все вкладки).',
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
                  children: [new TextRun({ text: `Зачем: ${stripJsx(item.purpose)}` })],
                })
              )
            }

            if (item.steps && item.steps.length) {
              docChildren.push(
                new Paragraph({
                  text: 'Как выполнить',
                  heading: HeadingLevel.HEADING_4,
                })
              )
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
              docChildren.push(
                new Paragraph({
                  text: 'Иконки и значения',
                  heading: HeadingLevel.HEADING_4,
                })
              )
              item.keyIcons.forEach((ki) => {
                const line = `${stripJsx(ki.label)} — ${stripJsx(ki.meaning)}`
                docChildren.push(
                  new Paragraph({
                    children: [new TextRun({ text: line })],
                    bullet: { level: 0 },
                  })
                )
              })
            }

            if (item.tips && item.tips.length) {
              docChildren.push(new Paragraph({ text: 'Советы', heading: HeadingLevel.HEADING_4 }))
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
      a.download = 'Справка_Канбан.docx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export to Word failed', error)
    }
  }

  const stripJsx = (value) => {
    try {
      if (value == null) return ''
      if (typeof value === 'string') return value
      if (Array.isArray(value)) return value.map(stripJsx).join(' ')
      if (typeof value === 'object' && 'props' in value) {
        const children = value.props && value.props.children
        return stripJsx(children)
      }
      return String(value)
    } catch (_) {
      return ''
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
    } catch (err) {
      // Во время вычисления активного якоря произошла ошибка — безопасно игнорируем
      // и сбрасываем подсветку, чтобы избежать «залипания» состояния.
      setActiveAnchor('')
    }
  }

  useEffect(() => {
    if (contentRef.current) {
      handleScroll(contentRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results])

  if (!open) return null

  return (
    <div className="modal-overlay-creat-group">
      <div className="modal-content-creat-group" style={{ maxWidth: '980px' }}>
        <AiFillCloseCircle className="modal-overlay-close-creat-group" onClick={onClose} />

        <strong className="title-creat-group">Справка: Канбан-доска</strong>
        <p style={{ opacity: 0.8, marginBottom: 8 }}>
          Подробные инструкции по статусам, иконкам, действиям и созданию задач. Воспользуйтесь
          поиском ниже.
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
            title="Скачать все вкладки справки в Word"
          >
            Скачать все вкладки в Word
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
          {/* селект быстрого перехода удалён: используйте оглавление слева */}
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
                      {item.result && (
                        <span
                          style={{
                            background: '#eef6ff',
                            color: '#0b63c5',
                            border: '1px solid #cfe8ff',
                            fontSize: 12,
                            padding: '3px 8px',
                            borderRadius: 999,
                          }}
                        >
                          Результат: {item.result}
                        </span>
                      )}
                    </div>

                    {showDetails && item.purpose && (
                      <p style={{ margin: '6px 0' }}>Зачем: {item.purpose}</p>
                    )}

                    {item.steps && item.steps.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Как выполнить</div>
                        <ol style={{ margin: 0, paddingLeft: 18 }}>
                          {item.steps.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {item.preview === 'deadline' && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          border: '1px dashed rgba(0,0,0,0.15)',
                          borderRadius: 8,
                        }}
                      >
                        <div className="task-footer">
                          <div className="task-deadline">
                            <span className="task-deadline-renew-wrapper pulse-effect">
                              <MdAutorenew
                                title="Запросить продление срока исполнения задачи"
                                className={`task-deadline-renew-icon ${
                                  deadlineDemoOpen ? 'spin-on-click' : ''
                                }`}
                                onClick={() => setDeadlineDemoOpen(true)}
                              />
                            </span>
                            <CiTimer className="task-icon" />
                            <span className="task-deadline-text">Срок истек</span>
                          </div>
                          <div className="priority-indicator high-priority"></div>
                        </div>
                        {deadlineDemoOpen && (
                          <div
                            style={{
                              marginTop: 10,
                              background: '#fff',
                              border: '1px solid rgba(0,0,0,0.1)',
                              borderRadius: 8,
                              padding: 12,
                            }}
                          >
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>
                              Демонстрация запроса продления
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <input
                                disabled
                                placeholder="Комментарий (демо)"
                                style={{
                                  flex: 1,
                                  minWidth: 220,
                                  padding: 8,
                                  border: '1px solid rgba(0,0,0,0.1)',
                                  borderRadius: 6,
                                }}
                              />
                              <input
                                disabled
                                type="datetime-local"
                                style={{
                                  padding: 8,
                                  border: '1px solid rgba(0,0,0,0.1)',
                                  borderRadius: 6,
                                }}
                              />
                              <button
                                disabled
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: '1px solid rgba(0,0,0,0.1)',
                                }}
                              >
                                Отправить (демо)
                              </button>
                              <button
                                onClick={() => setDeadlineDemoOpen(false)}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: '1px solid rgba(0,0,0,0.1)',
                                }}
                              >
                                Закрыть
                              </button>
                            </div>
                            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                              Это демонстрационный блок — реальный запрос не отправляется.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {showDetails && item.keyIcons && item.keyIcons.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Иконки и значения</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {item.keyIcons.map((icon, idx) => (
                            <li
                              key={`${icon.label}-${idx}`}
                              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
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
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HelpModalKanban
