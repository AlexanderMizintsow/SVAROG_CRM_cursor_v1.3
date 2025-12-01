import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Toastify from 'toastify-js'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { API_BASE_URL } from '../../../../../../config'
import EditorToolbarSimple from '../../../../../components/EditorToolbarSimple/EditorToolbarSimple'
import '../../../../../components/EditorToolbarSimple/EditorToolbarSimple.scss'
import './CampaignForm.scss'

const CampaignForm = ({ campaign, onClose, onSave }) => {
  const isEditMode = !!campaign

  // Основные данные формы
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    status: 'draft',
    period_type: 'unlimited',
    send_date: '',
    period_start: '',
    period_end: '',
    auto_send: false,
    blocking_period_days: 30,
    contact_person_id: '',
    show_contact_person: false,
    notes: '',
    delivery_channels: ['telegram'],
  })

  // Состояния для справочников
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [tags, setTags] = useState([])
  const [users, setUsers] = useState([])
  const [dealers, setDealers] = useState([])

  // Выбранные значения
  const [selectedLocations, setSelectedLocations] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [selectedDealers, setSelectedDealers] = useState([])
  const [allDealersSelected, setAllDealersSelected] = useState(true)
  const [allLocationsSelected, setAllLocationsSelected] = useState(true)

  // Ref для отслеживания предыдущего списка дилеров (чтобы избежать бесконечного цикла)
  const prevDealersRef = useRef([])

  // Файлы
  const [images, setImages] = useState([])
  const [attachments, setAttachments] = useState([])

  // Загрузка и валидация
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  // TipTap редактор - упрощенный для Telegram
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Оставляем только необходимые возможности для Telegram
        heading: false, // Убираем заголовки
        bold: true,
        italic: true,
        // Убираем лишние возможности
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        hardBreak: true, // Важно для переносов строк
        history: true,
        paragraph: {
          HTMLAttributes: {
            class: null,
          },
        },
      }),
    ],
    content: campaign?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      // Контент будет сохранен при отправке формы
    },
  })

  // Загрузка данных при монтировании
  useEffect(() => {
    loadInitialData()
    if (campaign) {
      loadCampaignData()
    }
  }, [campaign])

  const loadInitialData = async () => {
    try {
      const [categoriesRes, locationsRes, tagsRes, usersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}5778/api/marketing/categories`),
        axios.get(`${API_BASE_URL}5778/api/marketing/locations`),
        axios.get(`${API_BASE_URL}5778/api/marketing/tags`),
        axios.get(`${API_BASE_URL}5000/api/users`),
      ])

      setCategories(categoriesRes.data)
      setLocations(locationsRes.data || [])
      setTags(tagsRes.data)
      setUsers(usersRes.data)

      // Автоматически обновляем локации из адресов компаний (тихо, без уведомлений)
      try {
        await axios.post(`${API_BASE_URL}5778/api/marketing/locations/create-from-companies`)
        // Перезагружаем локации после создания
        const updatedLocationsRes = await axios.get(`${API_BASE_URL}5778/api/marketing/locations`)
        setLocations(updatedLocationsRes.data || [])
      } catch (updateError) {
        // Игнорируем ошибки при автоматическом обновлении
        console.log('Автоматическое обновление локаций:', updateError.message)
      }

      // Отладочная информация
      console.log('Загружено локаций:', locationsRes.data?.length || 0)
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error)
      // Устанавливаем пустой массив при ошибке
      setLocations([])
    }
  }

  const handleCreateLocationsFromCompanies = async () => {
    try {
      setLoading(true)
      const response = await axios.post(
        `${API_BASE_URL}5778/api/marketing/locations/create-from-companies`
      )

      Toastify({
        text: response.data.message || 'Локации успешно созданы',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()

      // Перезагружаем локации
      const locationsRes = await axios.get(`${API_BASE_URL}5778/api/marketing/locations`)
      setLocations(locationsRes.data || [])
    } catch (error) {
      console.error('Ошибка при создании локаций:', error)
      Toastify({
        text: error.response?.data?.error || 'Ошибка при создании локаций',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    } finally {
      setLoading(false)
    }
  }

  const loadCampaignData = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/campaigns/${campaign.id}`)
      const data = response.data

      setFormData({
        name: data.name || '',
        category_id: data.category_id || '',
        status: data.status || 'draft',
        period_type: data.period_type || 'unlimited',
        send_date: data.send_date ? data.send_date.split('T')[0] : '',
        period_start: data.period_start ? data.period_start.split('T')[0] : '',
        period_end: data.period_end ? data.period_end.split('T')[0] : '',
        auto_send: data.auto_send || false,
        blocking_period_days: data.blocking_period_days || 30,
        contact_person_id: data.contact_person_id || '',
        show_contact_person: data.show_contact_person || false,
        notes: data.notes || '',
        delivery_channels: data.delivery_channels || ['telegram'],
      })

      setSelectedLocations(data.locations || [])
      setSelectedTags(data.tags || [])
      setSelectedDealers(data.companies || [])
      setAllDealersSelected(data.companies?.length === 0)
      setAllLocationsSelected(data.locations?.length === 0)
      setImages(data.images || [])
      setAttachments(data.attachments || [])

      if (editor && data.content) {
        editor.commands.setContent(data.content)
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных кампании:', error)
      Toastify({
        text: 'Ошибка при загрузке данных кампании',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    } finally {
      setLoading(false)
    }
  }

  const loadCompanies = async (locationIds = []) => {
    try {
      const params = {}
      if (locationIds.length > 0) {
        params.location_ids = locationIds.join(',')
      }
      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/companies`, { params })
      setDealers(response.data) // Оставляем старое название переменной для совместимости
    } catch (error) {
      console.error('Ошибка при загрузке компаний:', error)
    }
  }

  useEffect(() => {
    if (!allLocationsSelected && selectedLocations.length > 0) {
      loadCompanies(selectedLocations.map((l) => l.id))
    } else {
      loadCompanies()
    }
  }, [selectedLocations, allLocationsSelected])

  // Фильтруем выбранных дилеров при изменении списка доступных дилеров
  useEffect(() => {
    // Проверяем, изменился ли список доступных дилеров
    const currentDealerIds = dealers
      .map((d) => d.id)
      .sort()
      .join(',')
    const prevDealerIds = prevDealersRef.current
      .map((d) => d.id)
      .sort()
      .join(',')

    // Если список дилеров изменился и есть выбранные дилеры
    if (currentDealerIds !== prevDealerIds && !allDealersSelected && selectedDealers.length > 0) {
      // Оставляем только тех дилеров, которые есть в текущем списке доступных
      const availableDealerIds = new Set(dealers.map((d) => d.id))
      const filteredDealers = selectedDealers.filter((d) => availableDealerIds.has(d.id))

      // Проверяем, изменился ли список выбранных (сравниваем по ID)
      const currentSelectedIds = new Set(selectedDealers.map((d) => d.id))
      const filteredIds = new Set(filteredDealers.map((d) => d.id))
      const idsChanged =
        currentSelectedIds.size !== filteredIds.size ||
        [...currentSelectedIds].some((id) => !filteredIds.has(id))

      // Если список изменился, обновляем выбранных дилеров
      if (idsChanged) {
        setSelectedDealers(filteredDealers)
      }
    }

    // Обновляем ref с текущим списком дилеров
    prevDealersRef.current = dealers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealers, allDealersSelected])

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleDeliveryChannelChange = (channel) => {
    setFormData((prev) => {
      const channels = prev.delivery_channels || []
      if (channels.includes(channel)) {
        return {
          ...prev,
          delivery_channels: channels.filter((c) => c !== channel),
        }
      } else {
        return {
          ...prev,
          delivery_channels: [...channels, channel],
        }
      }
    })
  }

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    if (files.length + images.length > 10) {
      Toastify({
        text: 'Максимум 10 изображений',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
      return
    }

    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        Toastify({
          text: `Файл ${file.name} превышает 5 МБ`,
          close: true,
          backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        }).showToast()
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        setImages((prev) => [
          ...prev,
          {
            file,
            preview: e.target.result,
            file_name: file.name,
            file_size: file.size,
          },
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleAttachmentUpload = (e) => {
    const files = Array.from(e.target.files)
    if (files.length + attachments.length > 5) {
      Toastify({
        text: 'Максимум 5 вложений',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
      return
    }

    files.forEach((file) => {
      if (file.size > 20 * 1024 * 1024) {
        Toastify({
          text: `Файл ${file.name} превышает 20 МБ`,
          close: true,
          backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        }).showToast()
        return
      }

      setAttachments((prev) => [
        ...prev,
        {
          file,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
        },
      ])
    })
  }

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Название обязательно'
    }

    if (!formData.category_id) {
      newErrors.category_id = 'Категория обязательна'
    }

    if (!editor || !editor.getHTML().trim() || editor.getText().trim().length === 0) {
      newErrors.content = 'Содержание обязательно'
    }

    if (formData.period_type === 'date' && !formData.send_date) {
      newErrors.send_date = 'Дата отправки обязательна'
    }

    if (formData.period_type === 'period') {
      if (!formData.period_start) {
        newErrors.period_start = 'Дата начала обязательна'
      }
      if (!formData.period_end) {
        newErrors.period_end = 'Дата окончания обязательна'
      }
      if (
        formData.period_start &&
        formData.period_end &&
        new Date(formData.period_start) > new Date(formData.period_end)
      ) {
        newErrors.period_end = 'Дата окончания должна быть позже даты начала'
      }
    }

    if (formData.delivery_channels.length === 0) {
      newErrors.delivery_channels = 'Выберите хотя бы один канал доставки'
    }

    // Валидация: если выбраны конкретные локации, нужно выбрать хотя бы одну компанию
    if (!allLocationsSelected && selectedLocations.length > 0) {
      if (allDealersSelected || selectedDealers.length === 0) {
        newErrors.companies =
          'При выборе конкретных локаций необходимо выбрать хотя бы одну компанию'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      Toastify({
        text: 'Пожалуйста, исправьте ошибки в форме',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
      return
    }

    try {
      setLoading(true)

      const content = editor.getHTML()

      // Подготовка данных
      const campaignData = {
        ...formData,
        content,
        locations: allLocationsSelected ? [] : selectedLocations.map((l) => l.id),
        tags: selectedTags.map((t) => t.id),
        companies: allDealersSelected ? [] : selectedDealers.map((d) => d.id),
      }

      // Загрузка файлов
      const formDataToSend = new FormData()
      Object.keys(campaignData).forEach((key) => {
        if (
          key === 'delivery_channels' ||
          key === 'locations' ||
          key === 'tags' ||
          key === 'companies'
        ) {
          formDataToSend.append(key, JSON.stringify(campaignData[key]))
        } else {
          formDataToSend.append(key, campaignData[key] || '')
        }
      })

      // Добавление изображений
      images.forEach((img, index) => {
        if (img.file) {
          formDataToSend.append(`images`, img.file)
        } else if (img.id) {
          formDataToSend.append(`existing_images[${index}]`, img.id)
        }
      })

      // Добавление вложений
      attachments.forEach((att, index) => {
        if (att.file) {
          formDataToSend.append(`attachments`, att.file)
        } else if (att.id) {
          formDataToSend.append(`existing_attachments[${index}]`, att.id)
        }
      })

      if (isEditMode) {
        await axios.put(
          `${API_BASE_URL}5778/api/marketing/campaigns/${campaign.id}`,
          formDataToSend,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        )
        Toastify({
          text: 'Кампания обновлена',
          close: true,
          backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
        }).showToast()
      } else {
        await axios.post(`${API_BASE_URL}5778/api/marketing/campaigns`, formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        Toastify({
          text: 'Кампания создана',
          close: true,
          backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
        }).showToast()
      }

      onSave()
    } catch (error) {
      console.error('Ошибка при сохранении кампании:', error)
      Toastify({
        text: error.response?.data?.error || 'Ошибка при сохранении кампании',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    } finally {
      setLoading(false)
    }
  }

  if (loading && isEditMode) {
    return (
      <div className="campaign-form__overlay">
        <div className="campaign-form__loading">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="campaign-form__overlay" onClick={onClose}>
      <div className="campaign-form" onClick={(e) => e.stopPropagation()}>
        <div className="campaign-form__header">
          <h2>{isEditMode ? 'Редактировать кампанию' : 'Создать кампанию'}</h2>
          <button className="campaign-form__close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="campaign-form__body" onSubmit={handleSubmit}>
          {/* Наименование */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">
              Наименование <span className="required">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`campaign-form__input ${errors.name ? 'error' : ''}`}
              placeholder="Введите название кампании"
              maxLength={255}
            />
            {errors.name && <span className="campaign-form__error">{errors.name}</span>}
          </div>

          {/* Категория */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">
              Категория <span className="required">*</span>
            </label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleInputChange}
              className={`campaign-form__select ${errors.category_id ? 'error' : ''}`}
            >
              <option value="">Выберите категорию</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
            {errors.category_id && (
              <span className="campaign-form__error">{errors.category_id}</span>
            )}
          </div>

          {/* Содержание */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">
              Содержание <span className="required">*</span>
            </label>
            <div className="campaign-form__editor-help">
              <details className="campaign-form__help-details">
                <summary className="campaign-form__help-summary">
                  📝 Инструкция по форматированию для Telegram
                </summary>
                <div className="campaign-form__help-content">
                  <p>
                    <strong>Как правильно оформить текст:</strong>
                  </p>
                  <ul>
                    <li>
                      <strong>Перенос строки:</strong> Нажмите Enter для создания новой строки.
                      Каждый перенос будет отображаться в Telegram
                    </li>
                    <li>
                      <strong>Жирный текст:</strong> Выделите текст и нажмите <strong>B</strong>
                    </li>
                    <li>
                      <strong>Курсив:</strong> Выделите текст и нажмите <em>I</em>
                    </li>
                    <li>
                      <strong>Эмодзи:</strong> Можно использовать любые эмодзи, например: 📢 🎉 💰
                      ⚡ 🔥 📍 📞 ✨
                    </li>
                  </ul>
                  <p>
                    <strong>Популярные эмодзи для маркетинга (кликните, чтобы скопировать):</strong>
                  </p>
                  <div className="campaign-form__emoji-list">
                    {[
                      '📢',
                      '🎉',
                      '💰',
                      '⚡',
                      '🔥',
                      '📍',
                      '📞',
                      '✨',
                      '🎁',
                      '🏆',
                      '⭐',
                      '💎',
                      '🚀',
                      '💯',
                      '🎯',
                      '📈',
                      '💼',
                      '🛍️',
                      '🎊',
                      '🏅',
                    ].map((emoji, index) => (
                      <span
                        key={index}
                        onClick={() => {
                          navigator.clipboard.writeText(emoji)
                          Toastify({
                            text: `Эмодзи ${emoji} скопирован`,
                            close: true,
                            backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
                            duration: 2000,
                          }).showToast()
                        }}
                        title="Кликните, чтобы скопировать"
                      >
                        {emoji}
                      </span>
                    ))}
                  </div>
                  <p>
                    <strong>Пример правильного оформления:</strong>
                  </p>
                  <pre className="campaign-form__example">
                    {`🎉 *Черная пятница!*
💰 *30% скидка*
⚡ *СЕГОДНЯ!*
✨ Не упустите возможность!`}
                  </pre>
                  <p className="campaign-form__help-note">
                    💡 <strong>Совет:</strong> Используйте переносы строк (Enter) для разделения
                    блоков текста. Это сделает сообщение более читаемым в Telegram.
                  </p>
                </div>
              </details>
            </div>
            {editor && <EditorToolbarSimple editor={editor} isTelegramMode={true} />}
            <div className={`campaign-form__editor ${errors.content ? 'error' : ''}`}>
              {editor && <EditorContent editor={editor} />}
            </div>
            {errors.content && <span className="campaign-form__error">{errors.content}</span>}
          </div>

          {/* Изображения */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">Изображения (до 10, макс. 5 МБ каждое)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageUpload}
              className="campaign-form__file-input"
            />
            {images.length > 0 && (
              <div className="campaign-form__images">
                {images.map((img, index) => (
                  <div key={index} className="campaign-form__image-item">
                    <img src={img.preview || img.file_path} alt={img.file_name} />
                    <button type="button" onClick={() => removeImage(index)}>
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Вложения */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">
              Вложения (до 5, макс. 20 МБ каждое): PDF, DOC, DOCX, XLS, XLSX
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              multiple
              onChange={handleAttachmentUpload}
              className="campaign-form__file-input"
            />
            {attachments.length > 0 && (
              <div className="campaign-form__attachments">
                {attachments.map((att, index) => (
                  <div key={index} className="campaign-form__attachment-item">
                    <span>{att.file_name}</span>
                    <span>{(att.file_size / 1024 / 1024).toFixed(2)} МБ</span>
                    <button type="button" onClick={() => removeAttachment(index)}>
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Период действия */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">
              Период действия <span className="required">*</span>
            </label>
            <div className="campaign-form__radio-group">
              <label>
                <input
                  type="radio"
                  name="period_type"
                  value="unlimited"
                  checked={formData.period_type === 'unlimited'}
                  onChange={handleInputChange}
                />
                Бессрочная
              </label>
              <label>
                <input
                  type="radio"
                  name="period_type"
                  value="date"
                  checked={formData.period_type === 'date'}
                  onChange={handleInputChange}
                />
                Конкретная дата
              </label>
              <label>
                <input
                  type="radio"
                  name="period_type"
                  value="period"
                  checked={formData.period_type === 'period'}
                  onChange={handleInputChange}
                />
                Период дат
              </label>
            </div>

            {formData.period_type === 'date' && (
              <div className="campaign-form__date-input">
                <input
                  type="date"
                  name="send_date"
                  value={formData.send_date}
                  onChange={handleInputChange}
                  className={errors.send_date ? 'error' : ''}
                />
                {errors.send_date && (
                  <span className="campaign-form__error">{errors.send_date}</span>
                )}
              </div>
            )}

            {formData.period_type === 'period' && (
              <div className="campaign-form__date-range">
                <div>
                  <label>Дата начала:</label>
                  <input
                    type="date"
                    name="period_start"
                    value={formData.period_start}
                    onChange={handleInputChange}
                    className={errors.period_start ? 'error' : ''}
                  />
                  {errors.period_start && (
                    <span className="campaign-form__error">{errors.period_start}</span>
                  )}
                </div>
                <div>
                  <label>Дата окончания:</label>
                  <input
                    type="date"
                    name="period_end"
                    value={formData.period_end}
                    onChange={handleInputChange}
                    className={errors.period_end ? 'error' : ''}
                  />
                  {errors.period_end && (
                    <span className="campaign-form__error">{errors.period_end}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Локация */}
          <div className="campaign-form__section">
            <div className="campaign-form__label-row">
              <label className="campaign-form__label">
                Локация
                {!allLocationsSelected && selectedLocations.length > 0 && (
                  <span className="campaign-form__count"> ({selectedLocations.length})</span>
                )}
              </label>
              <button
                type="button"
                onClick={handleCreateLocationsFromCompanies}
                disabled={loading}
                className="campaign-form__btn-update-locations"
                title="Обновить список локаций из адресов компаний"
              >
                {loading ? 'Обновление...' : '🔄 Обновить локации'}
              </button>
            </div>
            <div className="campaign-form__checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={allLocationsSelected}
                  onChange={(e) => {
                    const isChecked = e.target.checked
                    setAllLocationsSelected(isChecked)
                    if (isChecked) {
                      setSelectedLocations([])
                    } else {
                      // Если снимаем галочку "Все локации", снимаем и "Все компании"
                      if (allDealersSelected) {
                        setAllDealersSelected(false)
                      }
                    }
                  }}
                />
                Все локации
              </label>
            </div>
            {!allLocationsSelected && (
              <div className="campaign-form__multi-select">
                {locations.length > 0 ? (
                  locations.map((location) => (
                    <label key={location.id} className="campaign-form__checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedLocations.some((l) => l.id === location.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newSelectedLocations = [...selectedLocations, location]
                            setSelectedLocations(newSelectedLocations)
                            // Если выбираем конкретную локацию, снимаем галочку "Все компании"
                            if (allDealersSelected) {
                              setAllDealersSelected(false)
                            }
                          } else {
                            setSelectedLocations(
                              selectedLocations.filter((l) => l.id !== location.id)
                            )
                          }
                        }}
                      />
                      {location.city} {location.region && `(${location.region})`}
                    </label>
                  ))
                ) : (
                  <div className="campaign-form__empty-message">
                    <p>Нет доступных локаций. Нажмите &quot;Обновить локации&quot; для создания.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Доступность дилерам */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">
              Доступность дилерам
              {!allDealersSelected && selectedDealers.length > 0 && (
                <span className="campaign-form__count"> ({selectedDealers.length})</span>
              )}
              {!allLocationsSelected && selectedLocations.length > 0 && (
                <span className="required"> *</span>
              )}
            </label>
            {errors.companies && <span className="campaign-form__error">{errors.companies}</span>}
            <div className="campaign-form__checkbox-group">
              <label
                className={!allLocationsSelected ? 'campaign-form__label-disabled' : ''}
                title={
                  !allLocationsSelected
                    ? 'При выборе конкретных локаций необходимо выбрать конкретные компании'
                    : ''
                }
              >
                <input
                  type="checkbox"
                  checked={allDealersSelected}
                  disabled={!allLocationsSelected}
                  onChange={(e) => {
                    setAllDealersSelected(e.target.checked)
                    if (e.target.checked) {
                      setSelectedDealers([])
                    }
                  }}
                />
                Все компании
              </label>
            </div>
            {!allDealersSelected && dealers.length > 0 && (
              <div className="campaign-form__dealers-list">
                {dealers.map((company) => (
                  <label
                    key={company.id}
                    className={`campaign-form__checkbox-item ${
                      !company.has_telegram ? 'disabled' : ''
                    }`}
                    title={
                      !company.has_telegram ? 'Компания не зарегистрирована в Telegram боте' : ''
                    }
                  >
                    <input
                      type="checkbox"
                      checked={selectedDealers.some((d) => d.id === company.id)}
                      disabled={!company.has_telegram}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDealers([...selectedDealers, company])
                        } else {
                          setSelectedDealers(selectedDealers.filter((d) => d.id !== company.id))
                        }
                      }}
                    />
                    {company.name || company.company_name}
                    {company.has_telegram ? ' ✓' : ' (нет ТГ)'}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Статус */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">
              Статус <span className="required">*</span>
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="campaign-form__select"
            >
              <option value="draft">Черновик</option>
              <option value="active">Активна</option>
              <option value="inactive">Деактивна</option>
            </select>
          </div>

          {/* Тэги */}
          <div className="campaign-form__section">
            <div className="campaign-form__label-row">
              <label className="campaign-form__label">Тэги</label>
              <span
                className="campaign-form__help-text"
                title="Тэги используются для организации и категоризации кампаний. Они не влияют на выбор получателей рассылки."
              >
                ℹ️
              </span>
            </div>
            <p className="campaign-form__field-description">
              Тэги помогают организовать и категоризировать кампании для удобного поиска и
              фильтрации. Они не влияют на выбор получателей рассылки.
            </p>
            {tags.length > 0 ? (
              <div className="campaign-form__multi-select">
                {tags.map((tag) => (
                  <label key={tag.id} className="campaign-form__checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedTags.some((t) => t.id === tag.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTags([...selectedTags, tag])
                        } else {
                          setSelectedTags(selectedTags.filter((t) => t.id !== tag.id))
                        }
                      }}
                    />
                    <span
                      style={{
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        backgroundColor: tag.color || '#667eea',
                        borderRadius: '2px',
                        marginRight: '5px',
                      }}
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="campaign-form__empty-state">
                Нет доступных тегов. Создайте теги в разделе управления справочниками.
              </p>
            )}
          </div>

          {/* Контактное лицо */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">Контактное лицо</label>
            <select
              name="contact_person_id"
              value={formData.contact_person_id}
              onChange={handleInputChange}
              className="campaign-form__select"
            >
              <option value="">Не выбрано</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.last_name} {user.first_name} {user.middle_name}
                </option>
              ))}
            </select>
            {formData.contact_person_id && (
              <label className="campaign-form__checkbox-item">
                <input
                  type="checkbox"
                  name="show_contact_person"
                  checked={formData.show_contact_person}
                  onChange={handleInputChange}
                />
                Отображать для дилеров
              </label>
            )}
          </div>

          {/* Заметки */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">Заметки (служебные)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              className="campaign-form__textarea"
              rows="3"
              placeholder="Служебные заметки, не отображаются дилерам"
            />
          </div>

          {/* Каналы доставки */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">
              Каналы доставки <span className="required">*</span>
            </label>
            <div className="campaign-form__checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.delivery_channels.includes('telegram')}
                  onChange={() => handleDeliveryChannelChange('telegram')}
                />
                Telegram
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={formData.delivery_channels.includes('email')}
                  onChange={() => handleDeliveryChannelChange('email')}
                  disabled
                />
                Email (в разработке)
              </label>
            </div>
            {errors.delivery_channels && (
              <span className="campaign-form__error">{errors.delivery_channels}</span>
            )}
          </div>

          {/* Период блокировки дублирования */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">Контроль дублирования</label>
            <div className="campaign-form__form-group">
              <label>
                Период блокировки дублирования (дни):
                <input
                  type="number"
                  name="blocking_period_days"
                  value={formData.blocking_period_days}
                  onChange={handleInputChange}
                  min="1"
                  max="365"
                  placeholder="30"
                />
              </label>
              <p className="campaign-form__help-text">
                В течение этого периода нельзя будет повторно отправить эту кампанию той же компании
              </p>
            </div>
          </div>

          {/* Автоматическая отправка */}
          <div className="campaign-form__section">
            <label className="campaign-form__label">Автоматическая отправка</label>
            <label className="campaign-form__checkbox-item">
              <input
                type="checkbox"
                name="auto_send"
                checked={formData.auto_send}
                onChange={handleInputChange}
              />
              Включить автоматическую отправку
            </label>
            {formData.auto_send && (
              <div className="campaign-form__auto-send-info">
                <p>Время отправки: 08:00 (фиксированное)</p>
              </div>
            )}
          </div>

          {/* Кнопки */}
          <div className="campaign-form__actions">
            <button type="button" className="campaign-form__btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="campaign-form__btn-save" disabled={loading}>
              {loading ? 'Сохранение...' : isEditMode ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CampaignForm
