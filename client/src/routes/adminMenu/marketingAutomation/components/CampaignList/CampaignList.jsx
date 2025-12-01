import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Toastify from 'toastify-js'
import * as XLSX from 'xlsx'
import { API_BASE_URL } from '../../../../../../config'
import ConfirmationDialog from '../../../../../components/confirmationDialog/ConfirmationDialog'
import CampaignPreview from '../CampaignPreview/CampaignPreview'
import './CampaignList.scss'

const CampaignList = ({ onEdit, canEdit, refreshKey }) => {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [filters, setFilters] = useState({
    category_id: '',
    status: '',
    search: '',
    tag_id: '',
  })
  const [searchInput, setSearchInput] = useState('')
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [campaignToSend, setCampaignToSend] = useState(null)
  const [recipients, setRecipients] = useState([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [previewCampaignId, setPreviewCampaignId] = useState(null)
  const searchTimeoutRef = useRef(null)
  const searchInputRef = useRef(null)
  const shouldRestoreFocus = useRef(false)

  // Загрузка категорий и тегов при монтировании
  useEffect(() => {
    loadCategories()
    loadTags()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Загрузка кампаний при изменении фильтров (кроме поиска) и refreshKey
  useEffect(() => {
    loadCampaigns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, filters.category_id, filters.status, filters.tag_id])

  // Debounce для поиска
  useEffect(() => {
    // Очищаем предыдущий таймер
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Устанавливаем новый таймер
    searchTimeoutRef.current = setTimeout(() => {
      // Проверяем, есть ли фокус на инпуте
      if (searchInputRef.current === document.activeElement) {
        shouldRestoreFocus.current = true
      }
      setFilters((prev) => ({ ...prev, search: searchInput }))
    }, 500) // Задержка 500мс

    // Очистка при размонтировании
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchInput])

  // Загрузка кампаний при изменении поиска
  useEffect(() => {
    loadCampaigns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search])

  // Восстановление фокуса после загрузки данных
  useEffect(() => {
    if (!loading && shouldRestoreFocus.current && searchInputRef.current) {
      searchInputRef.current.focus()
      // Восстанавливаем позицию курсора в конце текста
      const length = searchInputRef.current.value.length
      searchInputRef.current.setSelectionRange(length, length)
      shouldRestoreFocus.current = false
    }
  }, [loading])

  const loadCategories = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/categories`)
      setCategories(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке категорий:', error)
    }
  }

  const loadTags = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/tags`)
      setTags(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке тегов:', error)
    }
  }

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filters.category_id) params.category_id = filters.category_id
      if (filters.status) params.status = filters.status
      if (filters.search) params.search = filters.search
      if (filters.tag_id) params.tag_id = filters.tag_id

      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/campaigns`, { params })
      setCampaigns(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке кампаний:', error)
      Toastify({
        text: 'Ошибка при загрузке кампаний',
        close: true,
        style: {
          background: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        },
      }).showToast()
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const statuses = {
      draft: { text: 'Черновик', class: 'status-draft' },
      active: { text: 'Активна', class: 'status-active' },
      inactive: { text: 'Деактивна', class: 'status-inactive' },
    }
    return statuses[status] || { text: status, class: '' }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getPeriodText = (campaign) => {
    if (campaign.period_type === 'unlimited') return 'Бессрочная'
    if (campaign.period_type === 'date') return formatDate(campaign.send_date)
    if (campaign.period_type === 'period') {
      return `${formatDate(campaign.period_start)} - ${formatDate(campaign.period_end)}`
    }
    return '-'
  }

  const getRecipientsCountText = (count) => {
    if (count === 0) return 'получателям'
    const lastDigit = count % 10
    const lastTwoDigits = count % 100

    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
      return 'получателям'
    }
    if (lastDigit === 1) {
      return 'получателю'
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
      return 'получателям'
    }
    return 'получателям'
  }

  const handleSendClick = async (campaign) => {
    setCampaignToSend(campaign)
    setSendDialogOpen(true)
    setLoadingRecipients(true)

    try {
      const response = await axios.get(
        `${API_BASE_URL}5778/api/marketing/campaigns/${campaign.id}/recipients`
      )
      setRecipients(response.data.companies || [])
    } catch (error) {
      console.error('Ошибка при загрузке получателей:', error)
      Toastify({
        text:
          'Ошибка при загрузке списка получателей: ' +
          (error.response?.data?.error || error.message),
        close: true,
        style: {
          background: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        },
      }).showToast()
      setRecipients([])
    } finally {
      setLoadingRecipients(false)
    }
  }

  const handleSendConfirm = async () => {
    if (!campaignToSend) return

    try {
      setSending(true)
      setSendDialogOpen(false)
      const response = await axios.post(
        `${API_BASE_URL}5778/api/marketing/campaigns/${campaignToSend.id}/send`
      )

      Toastify({
        text: `Отправка завершена. Отправлено: ${response.data.sent}, Ошибок: ${response.data.errors}, Пропущено: ${response.data.skipped}`,
        close: true,
        style: {
          background: 'linear-gradient(to right, #00b09b, #96c93d)',
        },
      }).showToast()

      setCampaignToSend(null)
      setRecipients([])
      loadCampaigns()
    } catch (error) {
      console.error('Ошибка при отправке кампании:', error)
      Toastify({
        text: 'Ошибка при отправке кампании: ' + (error.response?.data?.error || error.message),
        close: true,
        style: {
          background: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        },
      }).showToast()
    } finally {
      setSending(false)
    }
  }

  const getSendDialogMessage = () => {
    if (loadingRecipients) {
      return 'Загрузка списка получателей...'
    }
    if (!campaignToSend) {
      return ''
    }

    let message = `Вы уверены, что хотите отправить кампанию "${campaignToSend.name}"?\n\n`
    message += `Кампания будет отправлена ${recipients.length} ${getRecipientsCountText(
      recipients.length
    )}:\n\n`

    if (recipients.length > 0) {
      const recipientsList = recipients
        .slice(0, 20)
        .map((r) => `• ${r.name || r.company_name}`)
        .join('\n')
      message += recipientsList
      if (recipients.length > 20) {
        message += `\n... и еще ${recipients.length - 20}`
      }
    } else {
      message += 'Нет получателей. Убедитесь, что выбраны компании с подключенным Telegram.'
    }

    return message
  }

  const handleDeleteClick = (campaign) => {
    setCampaignToDelete(campaign)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!campaignToDelete) return

    try {
      setDeleting(true)
      await axios.delete(`${API_BASE_URL}5778/api/marketing/campaigns/${campaignToDelete.id}`)

      Toastify({
        text: `Кампания "${campaignToDelete.name}" успешно удалена`,
        close: true,
        style: {
          background: 'linear-gradient(to right, #00b09b, #96c93d)',
        },
      }).showToast()

      setDeleteDialogOpen(false)
      setCampaignToDelete(null)
      loadCampaigns() // Обновляем список
    } catch (error) {
      console.error('Ошибка при удалении кампании:', error)
      Toastify({
        text: 'Ошибка при удалении кампании: ' + (error.response?.data?.error || error.message),
        close: true,
        style: {
          background: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        },
      }).showToast()
    } finally {
      setDeleting(false)
    }
  }

  const handleExportExcel = async () => {
    try {
      // Загружаем все кампании без фильтров для полного экспорта
      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/campaigns`)
      const allCampaigns = response.data

      // Подготавливаем данные для Excel
      const excelData = allCampaigns.map((campaign) => {
        const statusText =
          campaign.status === 'draft'
            ? 'Черновик'
            : campaign.status === 'active'
            ? 'Активна'
            : campaign.status === 'inactive'
            ? 'Деактивна'
            : campaign.status

        const periodTypeText =
          campaign.period_type === 'unlimited'
            ? 'Бессрочная'
            : campaign.period_type === 'date'
            ? 'По дате'
            : campaign.period_type === 'period'
            ? 'По периоду'
            : campaign.period_type || '-'

        const formatDateForExcel = (dateString) => {
          if (!dateString) return '-'
          return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
        }

        const formatDateTimeForExcel = (dateString) => {
          if (!dateString) return '-'
          return new Date(dateString).toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        }

        const tagsText =
          campaign.tags && campaign.tags.length > 0
            ? campaign.tags.map((tag) => tag.name).join(', ')
            : '-'

        let channelsText = '-'
        if (campaign.delivery_channels) {
          try {
            const deliveryChannels =
              typeof campaign.delivery_channels === 'string'
                ? JSON.parse(campaign.delivery_channels)
                : campaign.delivery_channels
            if (Array.isArray(deliveryChannels) && deliveryChannels.length > 0) {
              channelsText = deliveryChannels.join(', ')
            }
          } catch (e) {
            // Если не удалось распарсить, используем как строку
            channelsText = campaign.delivery_channels
          }
        }

        return {
          ID: campaign.id,
          Название: campaign.name || '-',
          Статус: statusText,
          Категория: campaign.category?.name || '-',
          Теги: tagsText,
          'Тип периода': periodTypeText,
          'Дата отправки': formatDateForExcel(campaign.send_date),
          'Период начала': formatDateForExcel(campaign.period_start),
          'Период окончания': formatDateForExcel(campaign.period_end),
          'Автоматическая отправка': campaign.auto_send ? 'Да' : 'Нет',
          'Время отправки': campaign.send_time || '-',
          'Срок блокировки (дни)': campaign.blocking_period_days || '-',
          'Контактное лицо': campaign.contact_person_name || '-',
          'Показывать контактное лицо': campaign.show_contact_person ? 'Да' : 'Нет',
          Примечания: campaign.notes || '-',
          'Каналы доставки': channelsText,
          'Создано пользователем': campaign.created_by_name || '-',
          'Дата создания': formatDateTimeForExcel(campaign.created_at),
        }
      })

      // Создаем рабочую книгу Excel
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Кампании')

      // Настраиваем ширину колонок
      const columnWidths = [
        { wch: 8 }, // ID
        { wch: 30 }, // Название
        { wch: 12 }, // Статус
        { wch: 20 }, // Категория
        { wch: 25 }, // Теги
        { wch: 15 }, // Тип периода
        { wch: 15 }, // Дата отправки
        { wch: 15 }, // Период начала
        { wch: 15 }, // Период окончания
        { wch: 20 }, // Автоматическая отправка
        { wch: 15 }, // Время отправки
        { wch: 20 }, // Срок блокировки
        { wch: 25 }, // Контактное лицо
        { wch: 25 }, // Показывать контактное лицо
        { wch: 40 }, // Примечания
        { wch: 20 }, // Каналы доставки
        { wch: 25 }, // Создано пользователем
        { wch: 20 }, // Дата создания
      ]
      worksheet['!cols'] = columnWidths

      // Сохраняем файл
      const fileName = `кампании_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(workbook, fileName)

      Toastify({
        text: `Экспорт завершен. Экспортировано кампаний: ${allCampaigns.length}`,
        close: true,
        style: {
          background: 'linear-gradient(to right, #00b09b, #96c93d)',
        },
      }).showToast()
    } catch (error) {
      console.error('Ошибка при экспорте кампаний:', error)
      Toastify({
        text: 'Ошибка при экспорте кампаний: ' + (error.response?.data?.error || error.message),
        close: true,
        style: {
          background: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        },
      }).showToast()
    }
  }

  if (loading) {
    return <div className="campaign-list__loading">Загрузка...</div>
  }

  return (
    <div className="campaign-list">
      <div className="campaign-list__header">
        <h2>Кампании</h2>
        <div className="campaign-list__export-buttons">
          <button className="campaign-list__btn-export" onClick={handleExportExcel}>
            Экспорт Excel
          </button>
        </div>
      </div>

      <div className="campaign-list__filters">
        <div className="campaign-list__filter-group">
          <label>Поиск</label>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Поиск по названию..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="campaign-list__filter-group">
          <label>Категория</label>
          <select
            value={filters.category_id}
            onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
          >
            <option value="">Все категории</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="campaign-list__filter-group">
          <label>Статус</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="active">Активна</option>
            <option value="inactive">Деактивна</option>
          </select>
        </div>
        <div className="campaign-list__filter-group">
          <label>Тег</label>
          <select
            value={filters.tag_id}
            onChange={(e) => setFilters({ ...filters, tag_id: e.target.value })}
          >
            <option value="">Все теги</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="campaign-list__items">
        {campaigns.length === 0 ? (
          <div className="campaign-list__empty">Кампании не найдены</div>
        ) : (
          campaigns.map((campaign) => {
            const statusBadge = getStatusBadge(campaign.status)
            return (
              <div key={campaign.id} className="campaign-list__item">
                <div className="campaign-list__item-header">
                  <div className="campaign-list__item-title-row">
                    <h3 className="campaign-list__item-title">{campaign.name}</h3>
                    <span className={`campaign-list__status ${statusBadge.class}`}>
                      {statusBadge.text}
                    </span>
                  </div>
                  {campaign.category && (
                    <div className="campaign-list__item-category">
                      {campaign.category.icon} {campaign.category.name}
                    </div>
                  )}
                  {campaign.tags && campaign.tags.length > 0 && (
                    <div className="campaign-list__item-tags">
                      {campaign.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="campaign-list__tag"
                          style={{
                            backgroundColor: tag.color || '#667eea',
                            color: '#fff',
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="campaign-list__item-info">
                  <div className="campaign-list__item-field">
                    <span className="campaign-list__item-label">Период действия:</span>
                    <span>{getPeriodText(campaign)}</span>
                  </div>
                  {campaign.auto_send && (
                    <div className="campaign-list__item-field">
                      <span className="campaign-list__item-label">Автоотправка:</span>
                      <span>Включена ({campaign.send_time})</span>
                    </div>
                  )}
                  <div className="campaign-list__item-field">
                    <span className="campaign-list__item-label">Создано:</span>
                    <span>{formatDate(campaign.created_at)}</span>
                  </div>
                </div>

                <div className="campaign-list__item-actions">
                  <button
                    className="campaign-list__btn-preview"
                    onClick={() => setPreviewCampaignId(campaign.id)}
                  >
                    Просмотр
                  </button>
                  {canEdit && (
                    <>
                      <button className="campaign-list__btn-edit" onClick={() => onEdit(campaign)}>
                        Редактировать
                      </button>
                      <button
                        className="campaign-list__btn-delete"
                        onClick={() => handleDeleteClick(campaign)}
                        disabled={deleting}
                      >
                        Удалить
                      </button>
                    </>
                  )}
                  {campaign.status === 'active' && (
                    <button
                      className="campaign-list__btn-send"
                      onClick={() => handleSendClick(campaign)}
                      disabled={sending || loadingRecipients}
                    >
                      {sending ? 'Отправка...' : 'Отправить'}
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false)
          setCampaignToDelete(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Подтверждение удаления"
        message={
          campaignToDelete
            ? `Вы уверены, что хотите удалить кампанию "${campaignToDelete.name}"? Это действие нельзя отменить.`
            : ''
        }
        btn1="Отмена"
        btn2="Удалить"
      />

      <ConfirmationDialog
        open={sendDialogOpen}
        onClose={() => {
          setSendDialogOpen(false)
          setCampaignToSend(null)
          setRecipients([])
        }}
        onConfirm={handleSendConfirm}
        title="Подтверждение отправки кампании"
        message={getSendDialogMessage()}
        btn1="Отмена"
        btn2="Отправить"
      />

      {previewCampaignId && (
        <CampaignPreview
          campaignId={previewCampaignId}
          onClose={() => setPreviewCampaignId(null)}
        />
      )}
    </div>
  )
}

export default CampaignList
