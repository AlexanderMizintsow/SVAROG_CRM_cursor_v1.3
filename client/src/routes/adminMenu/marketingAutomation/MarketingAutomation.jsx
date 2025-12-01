import { useState, useEffect } from 'react'
import axios from 'axios'
import Toastify from 'toastify-js'
import useUserStore from '../../../store/userStore'
import { API_BASE_URL } from '../../../../config'
import CategoryManager from './components/CategoryManager/CategoryManager'
import CampaignList from './components/CampaignList/CampaignList'
import CampaignForm from './components/CampaignForm/CampaignForm'
import SendLog from './components/SendLog/SendLog'
import Statistics from './components/Statistics/Statistics'
import PermissionsManager from './components/PermissionsManager/PermissionsManager'
import './marketingAutomation.scss'

const MarketingAutomation = () => {
  const { user } = useUserStore()
  const userId = user?.id
  const isAdmin = user?.role_name === 'Администратор'

  const [activeTab, setActiveTab] = useState('campaigns')
  const [loading, setLoading] = useState(false)
  const [userCanEdit, setUserCanEdit] = useState(false)
  const [openCampaignForm, setOpenCampaignForm] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Загрузка прав доступа пользователя
  useEffect(() => {
    const loadUserPermissions = async () => {
      if (!userId) return

      // Администратор всегда имеет права
      if (isAdmin) {
        setUserCanEdit(true)
        return
      }

      try {
        const response = await axios.get(`${API_BASE_URL}5778/api/marketing/permissions`, {
          params: { userId },
        })
        setUserCanEdit(response.data.can_edit || false)
      } catch (error) {
        console.error('Ошибка при загрузке прав доступа:', error)
        setUserCanEdit(false)
      }
    }

    loadUserPermissions()
  }, [userId, isAdmin])

  const handleCreateCampaign = () => {
    setEditingCampaign(null)
    setOpenCampaignForm(true)
  }

  const handleEditCampaign = (campaign) => {
    setEditingCampaign(campaign)
    setOpenCampaignForm(true)
  }

  const handleCloseCampaignForm = () => {
    setOpenCampaignForm(false)
    setEditingCampaign(null)
    setRefreshKey((prev) => prev + 1)
  }

  const canEdit = () => {
    return isAdmin || userCanEdit
  }

  return (
    <div className="marketing-automation">
      <div className="marketing-automation__header">
        <h1 className="marketing-automation__title">Автоматизация маркетинга</h1>
        {canEdit() && (
          <div className="marketing-automation__actions">
            <button
              className="marketing-automation__btn marketing-automation__btn--primary"
              onClick={handleCreateCampaign}
            >
              <span className="marketing-automation__btn-icon">+</span>
              Создать кампанию
            </button>
          </div>
        )}
      </div>

      <div className="marketing-automation__tabs">
        <button
          className={`marketing-automation__tab ${activeTab === 'campaigns' ? 'active' : ''}`}
          onClick={() => setActiveTab('campaigns')}
        >
          Кампании
        </button>
        <button
          className={`marketing-automation__tab ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Категории
        </button>
        <button
          className={`marketing-automation__tab ${activeTab === 'send-log' ? 'active' : ''}`}
          onClick={() => setActiveTab('send-log')}
        >
          Журнал отправок
        </button>
        <button
          className={`marketing-automation__tab ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          Статистика
        </button>
        {isAdmin && (
          <button
            className={`marketing-automation__tab ${activeTab === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('permissions')}
          >
            Права доступа
          </button>
        )}
      </div>

      <div className="marketing-automation__content">
        {activeTab === 'campaigns' && (
          <CampaignList
            onEdit={handleEditCampaign}
            canEdit={canEdit()}
            refreshKey={refreshKey}
          />
        )}
        {activeTab === 'categories' && (
          <CategoryManager canEdit={canEdit()} refreshKey={refreshKey} />
        )}
        {activeTab === 'send-log' && <SendLog />}
        {activeTab === 'statistics' && <Statistics />}
        {activeTab === 'permissions' && isAdmin && (
          <PermissionsManager refreshKey={refreshKey} />
        )}
      </div>

      {openCampaignForm && (
        <CampaignForm
          campaign={editingCampaign}
          onClose={handleCloseCampaignForm}
          onSave={handleCloseCampaignForm}
        />
      )}
    </div>
  )
}

export default MarketingAutomation

