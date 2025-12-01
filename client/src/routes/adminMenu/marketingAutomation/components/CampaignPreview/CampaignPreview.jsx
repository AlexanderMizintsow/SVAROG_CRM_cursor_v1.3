import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../../config'
import './CampaignPreview.scss'

const CampaignPreview = ({ campaignId, onClose }) => {
  const [campaign, setCampaign] = useState(null)
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingRecipients, setLoadingRecipients] = useState(false)

  useEffect(() => {
    loadCampaign()
    loadRecipients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  const loadCampaign = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/campaigns/${campaignId}`)
      setCampaign(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке кампании:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRecipients = async () => {
    try {
      setLoadingRecipients(true)
      const response = await axios.get(
        `${API_BASE_URL}5778/api/marketing/campaigns/${campaignId}/recipients`
      )
      setRecipients(response.data.companies || [])
    } catch (error) {
      console.error('Ошибка при загрузке получателей:', error)
      setRecipients([])
    } finally {
      setLoadingRecipients(false)
    }
  }

  const formatContentForTelegram = (htmlContent) => {
    if (!htmlContent) return ''

    let content = htmlContent

    // Конвертируем HTML теги в Markdown для Telegram
    content = content
      .replace(/<strong>/gi, '*')
      .replace(/<\/strong>/gi, '*')
      .replace(/<b>/gi, '*')
      .replace(/<\/b>/gi, '*')
      .replace(/<em>/gi, '_')
      .replace(/<\/em>/gi, '_')
      .replace(/<i>/gi, '_')
      .replace(/<\/i>/gi, '_')
      .replace(/<code>/gi, '`')
      .replace(/<\/code>/gi, '`')
      .replace(/<a\s+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi, '[$2]($1)')
      .replace(/<p>/gi, '')
      .replace(/<\/p>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<div>/gi, '')
      .replace(/<\/div>/gi, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')

    // Удаляем все остальные HTML теги
    content = content.replace(/<[^>]*>/g, '')

    // Очищаем множественные переносы строк
    content = content.replace(/\n{3,}/g, '\n\n')

    return content.trim()
  }

  if (loading) {
    return (
      <div className="campaign-preview__overlay" onClick={onClose}>
        <div className="campaign-preview__modal" onClick={(e) => e.stopPropagation()}>
          <div className="campaign-preview__loading">Загрузка...</div>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="campaign-preview__overlay" onClick={onClose}>
        <div className="campaign-preview__modal" onClick={(e) => e.stopPropagation()}>
          <div className="campaign-preview__error">Кампания не найдена</div>
        </div>
      </div>
    )
  }

  const formattedMessage = formatContentForTelegram(campaign.content)
  const fullMessage = campaign.category
    ? `${campaign.category.icon || '📁'} ${campaign.category.name}\n\n*${
        campaign.name
      }*\n\n${formattedMessage}`
    : `*${campaign.name}*\n\n${formattedMessage}`

  return (
    <div className="campaign-preview__overlay" onClick={onClose}>
      <div className="campaign-preview__modal" onClick={(e) => e.stopPropagation()}>
        <div className="campaign-preview__header">
          <h2>Предпросмотр кампании</h2>
          <button className="campaign-preview__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="campaign-preview__content">
          {/* Предпросмотр сообщения как в Telegram */}
          <div className="campaign-preview__telegram">
            <div className="campaign-preview__telegram-header">
              <div className="campaign-preview__telegram-avatar">TG</div>
              <div className="campaign-preview__telegram-info">
                <div className="campaign-preview__telegram-name">Telegram</div>
                <div className="campaign-preview__telegram-time">сейчас</div>
              </div>
            </div>
            <div className="campaign-preview__telegram-message">
              {/* Изображения - заглушки */}
              {campaign.images && campaign.images.length > 0 && (
                <div
                  className={`campaign-preview__images ${
                    campaign.images.length > 1
                      ? `campaign-preview__images--album campaign-preview__images--count-${campaign.images.length}`
                      : ''
                  }`}
                >
                  {campaign.images.map((image, index) => (
                    <div key={image.id || index} className="campaign-preview__image-placeholder">
                      <div className="campaign-preview__image-placeholder-icon">🖼️</div>
                      <div className="campaign-preview__image-placeholder-text">
                        Тут будет картинка {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Текст сообщения */}
              <div className="campaign-preview__message-text">
                {fullMessage.split('\n').map((line, index) => {
                  // Простое форматирование Markdown для отображения
                  let formattedLine = line
                  formattedLine = formattedLine.replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
                  formattedLine = formattedLine.replace(/_([^_]+)_/g, '<em>$1</em>')
                  formattedLine = formattedLine.replace(/`([^`]+)`/g, '<code>$1</code>')
                  formattedLine = formattedLine.replace(
                    /\[([^\]]+)\]\(([^)]+)\)/g,
                    '<a href="$2" target="_blank">$1</a>'
                  )

                  return (
                    <div
                      key={index}
                      dangerouslySetInnerHTML={{ __html: formattedLine || '&nbsp;' }}
                    />
                  )
                })}
              </div>

              {/* Вложения - заглушки */}
              {campaign.attachments && campaign.attachments.length > 0 && (
                <div className="campaign-preview__attachments">
                  {campaign.attachments.map((attachment, index) => (
                    <div
                      key={attachment.id || index}
                      className="campaign-preview__attachment-placeholder"
                    >
                      <div className="campaign-preview__attachment-placeholder-icon">📎</div>
                      <div className="campaign-preview__attachment-placeholder-text">
                        Тут будет файл {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Контактное лицо */}
              {campaign.show_contact_person && campaign.contact_person_name && (
                <div className="campaign-preview__contact">
                  <div>Контактное лицо: {campaign.contact_person_name}</div>
                </div>
              )}

              {/* Время отправки (как в Telegram) */}
              <div className="campaign-preview__message-time">
                {new Date().toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          {/* Список получателей */}
          <div className="campaign-preview__recipients">
            <h3>Получатели кампании</h3>
            {loadingRecipients ? (
              <div className="campaign-preview__loading-recipients">
                Загрузка списка получателей...
              </div>
            ) : recipients.length > 0 ? (
              <>
                <div className="campaign-preview__recipients-count">
                  Всего получателей: {recipients.length}
                </div>
                <div className="campaign-preview__recipients-list">
                  {recipients.map((recipient) => (
                    <div key={recipient.id} className="campaign-preview__recipient-item">
                      {recipient.name || recipient.company_name}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="campaign-preview__no-recipients">
                Нет получателей. Убедитесь, что выбраны компании с подключенным Telegram.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CampaignPreview
