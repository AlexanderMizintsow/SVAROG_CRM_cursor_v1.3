import { useState, useEffect } from 'react'
import axios from 'axios'
import Toastify from 'toastify-js'
import useUserStore from '../../../store/userStore'
import {
  Paper,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Box,
  Grid,
  IconButton,
  Tabs,
  Tab,
  Card,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import { API_BASE_URL } from '../../../../config'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  Save as SaveIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import * as XLSX from 'xlsx'
import LeafVisualizer from './LeafVisualizer'
import './editorHandle.scss'

const EditorHandle = () => {
  const { user } = useUserStore()
  const userId = user?.id
  const isAdmin = user?.role_name === 'Администратор'

  const [editorData, setEditorData] = useState({
    leafTypes: [],
    parameters: [],
    handles: [],
    rules: [],
  })
  const [loading, setLoading] = useState(true)
  const [selectedLeafType, setSelectedLeafType] = useState('')
  const [selectedParameters, setSelectedParameters] = useState({}) // { parameter_id: [value_id1, value_id2, ...] }
  const [selectedHandles, setSelectedHandles] = useState([]) // Множественный выбор ручек
  const [foundHandles, setFoundHandles] = useState([])
  const [warnings, setWarnings] = useState([])
  const [history, setHistory] = useState([])
  const [historyTab, setHistoryTab] = useState(0)
  const [approvalStatus, setApprovalStatus] = useState(null)
  const [snapshots, setSnapshots] = useState([])
  const [openRestoreDialog, setOpenRestoreDialog] = useState(false)
  const [openApprovalUsersDialog, setOpenApprovalUsersDialog] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [approvalUsers, setApprovalUsers] = useState([])
  const [searchUser, setSearchUser] = useState('')

  // Модальные окна
  const [openParameterDialog, setOpenParameterDialog] = useState(false)
  const [openParameterValueDialog, setOpenParameterValueDialog] = useState(false)
  const [openHandleDialog, setOpenHandleDialog] = useState(false)
  const [openRuleViewDialog, setOpenRuleViewDialog] = useState(false)
  const [openRuleEditDialog, setOpenRuleEditDialog] = useState(false)
  const [openLeafTypeDialog, setOpenLeafTypeDialog] = useState(false)
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editingParameterId, setEditingParameterId] = useState(null)
  const [viewingRule, setViewingRule] = useState(null)

  // Формы
  const [parameterForm, setParameterForm] = useState({ name: '', description: '', is_multiple: false })
  const [parameterValueForm, setParameterValueForm] = useState({ value: '', display_order: 0 })
  const [handleForm, setHandleForm] = useState({ article: '', name: '', description: '' })
  const [ruleForm, setRuleForm] = useState({ quantity: 1 })
  const [leafTypeForm, setLeafTypeForm] = useState({ name: '', description: '' })

  // Загрузка данных
  useEffect(() => {
    loadEditorData()
    loadHistory()
    loadApprovalStatus()
    loadSnapshots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadEditorData = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_BASE_URL}5000/api/editor-handle/data`)
      setEditorData(response.data)
      
      if (response.data.leafTypes.length > 0 && !selectedLeafType) {
        setSelectedLeafType(response.data.leafTypes[0].id.toString())
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error)
      Toastify({
        text: 'Ошибка при загрузке данных',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/editor-handle/history`)
      setHistory(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке истории:', error)
    }
  }

  const loadApprovalStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/editor-handle/approval-status`)
      setApprovalStatus(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке статуса эталонности:', error)
    }
  }

  const loadSnapshots = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/editor-handle/snapshots`)
      setSnapshots(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке снапшотов:', error)
    }
  }

  const loadAllUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/editor-handle/all-users`)
      setAllUsers(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке пользователей:', error)
    }
  }

  const loadApprovalUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/editor-handle/approval-users`)
      setApprovalUsers(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке пользователей подтверждения:', error)
    }
  }

  const handleAddApprovalUser = async (userIdToAdd) => {
    try {
      await axios.post(`${API_BASE_URL}5000/api/editor-handle/approval-users`, {
        user_id: userIdToAdd,
        created_by: userId // ID администратора, который добавляет пользователя
      })
      Toastify({
        text: 'Пользователь успешно добавлен',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      loadApprovalUsers()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при добавлении пользователя',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleRemoveApprovalUser = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя из списка разрешенных?')) return
    
    try {
      await axios.delete(`${API_BASE_URL}5000/api/editor-handle/approval-users/${id}`)
      Toastify({
        text: 'Пользователь успешно удален',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      loadApprovalUsers()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: 'Ошибка при удалении пользователя',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Форматирование ФИО для отображения
  const formatUserFullName = (user) => {
    const parts = []
    if (user.last_name) parts.push(user.last_name)
    if (user.first_name) parts.push(user.first_name)
    if (user.middle_name) parts.push(user.middle_name)
    return parts.join(' ') || user.username || `ID: ${user.id}`
  }

  const handleApprove = async () => {
    try {
      await axios.post(`${API_BASE_URL}5000/api/editor-handle/approve`, {
        user_id: userId
      })
      Toastify({
        text: 'Эталонность подтверждена',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при подтверждении эталонности',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleCreateSnapshot = async () => {
    try {
      await axios.post(`${API_BASE_URL}5000/api/editor-handle/snapshots`, {
        description: `Снапшот от ${new Date().toLocaleString('ru-RU')}`,
        user_id: userId
      })
      Toastify({
        text: 'Снапшот успешно создан',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      loadSnapshots()
    } catch (error) {
      Toastify({
        text: 'Ошибка при создании снапшота',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleRestoreSnapshot = async (snapshotId) => {
    const snapshot = snapshots.find(s => s.id === snapshotId)
    const wasApproved = snapshot?.is_approved
    
    let confirmMessage = 'Вы уверены, что хотите восстановить данные из этого снапшота? Все текущие изменения будут потеряны!'
    if (wasApproved) {
      confirmMessage += ' Эталонность будет автоматически восстановлена.'
    } else {
      confirmMessage += ' После восстановления потребуется подтверждение эталонности.'
    }
    
    if (!window.confirm(confirmMessage)) return
    
    try {
      await axios.post(`${API_BASE_URL}5000/api/editor-handle/restore`, {
        snapshot_id: snapshotId,
        user_id: userId
      })
      
      let successMessage = 'Данные успешно восстановлены.'
      if (wasApproved) {
        successMessage += ' Эталонность восстановлена автоматически.'
      } else {
        successMessage += ' Требуется подтверждение эталонности.'
      }
      
      Toastify({
        text: successMessage,
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      loadEditorData()
      loadApprovalStatus()
      loadSnapshots()
      setOpenRestoreDialog(false)
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при восстановлении данных',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleDeleteSnapshot = async (snapshotId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот снапшот? Это действие нельзя отменить.')) return
    
    try {
      await axios.delete(`${API_BASE_URL}5000/api/editor-handle/snapshots/${snapshotId}`)
      Toastify({
        text: 'Снапшот успешно удален',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      loadSnapshots()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при удалении снапшота',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Проверка, может ли пользователь подтверждать
  const canApprove = () => {
    if (!approvalStatus || !userId) return false
    
    // Пользователь должен быть в списке тех, кто может подтверждать
    const canUserApprove = approvalStatus.requiredUsers.some(user => user.id === userId)
    if (!canUserApprove) return false
    
    // Пользователь не должен был уже подтвердить на текущую дату
    const hasAlreadyApproved = approvalStatus.approvals.some(approval => approval.approved_by === userId)
    
    // Кнопка показывается если:
    // 1. Пользователь еще не подтвердил ИЛИ
    // 2. Есть изменения после подтверждения (требуется повторное подтверждение)
    return !hasAlreadyApproved || approvalStatus.hasChanges
  }

  // Фильтрация пользователей для выбора
  const getFilteredUsers = () => {
    if (!searchUser) return allUsers.filter(user => !approvalUsers.some(au => au.user_id === user.id))
    
    const searchLower = searchUser.toLowerCase()
    return allUsers.filter(user => {
      const isAlreadyAdded = approvalUsers.some(au => au.user_id === user.id)
      if (isAlreadyAdded) return false
      
      const fullName = formatUserFullName(user).toLowerCase()
      const username = (user.username || '').toLowerCase()
      return fullName.includes(searchLower) || username.includes(searchLower)
    })
  }

  // Подбор ручек по параметрам
  const findHandles = async () => {
    if (!selectedLeafType) {
      Toastify({
        text: 'Выберите тип створки',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
      return
    }

    try {
      // Фильтруем параметры: убираем те, у которых нет выбранных значений
      // Это важно: если параметр не выбран, он не должен влиять на поиск
      const filteredParameters = {}
      Object.entries(selectedParameters).forEach(([paramId, valueIds]) => {
        if (valueIds && Array.isArray(valueIds) && valueIds.length > 0) {
          filteredParameters[paramId] = valueIds
        }
      })
      
      const response = await axios.post(`${API_BASE_URL}5000/api/editor-handle/find-handles`, {
        leaf_type_id: parseInt(selectedLeafType),
        parameters: filteredParameters,
      })
      
      setFoundHandles(response.data.handles || [])
      setWarnings(response.data.warnings || [])
      
      if (response.data.handles.length === 0) {
        Toastify({
          text: 'Ручки не найдены для данной комбинации параметров',
          close: true,
          backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        }).showToast()
      }
    } catch (error) {
      console.error('Ошибка при подборе ручек:', error)
      Toastify({
        text: 'Ошибка при подборе ручек',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Обработка изменения параметров (поддержка множественного выбора)
  const handleParameterChange = (parameterId, valueIds) => {
    setSelectedParameters(prev => ({
      ...prev,
      [parameterId]: Array.isArray(valueIds) ? valueIds : (valueIds ? [valueIds] : []),
    }))
  }

  // Управление параметрами
  const handleCreateParameter = async () => {
    try {
      await axios.post(`${API_BASE_URL}5000/api/editor-handle/parameters`, {
        ...parameterForm,
        user_id: userId,
      })
      Toastify({
        text: 'Параметр успешно создан',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      setOpenParameterDialog(false)
      setParameterForm({ name: '', description: '', is_multiple: false })
      loadEditorData()
      loadHistory()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при создании параметра',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleUpdateParameter = async () => {
    try {
      await axios.put(`${API_BASE_URL}5000/api/editor-handle/parameters/${editingItem.id}`, {
        ...parameterForm,
        user_id: userId,
      })
      Toastify({
        text: 'Параметр успешно обновлен',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      setOpenParameterDialog(false)
      setEditingItem(null)
      setParameterForm({ name: '', description: '', is_multiple: false })
      loadEditorData()
      loadHistory()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при обновлении параметра',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleDeleteParameter = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот параметр?')) return
    
    try {
      await axios.delete(`${API_BASE_URL}5000/api/editor-handle/parameters/${id}`, {
        data: { user_id: userId }
      })
      Toastify({
        text: 'Параметр успешно удален',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      loadEditorData()
      loadHistory()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при удалении параметра',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Управление значениями параметров
  const handleCreateParameterValue = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}5000/api/editor-handle/parameters/${editingParameterId}/values`,
        parameterValueForm
      )
      Toastify({
        text: 'Значение параметра успешно создано',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      setOpenParameterValueDialog(false)
      setParameterValueForm({ value: '', display_order: 0 })
      loadEditorData()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при создании значения параметра',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleDeleteParameterValue = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить это значение?')) return
    
    try {
      await axios.delete(`${API_BASE_URL}5000/api/editor-handle/parameter-values/${id}`)
      Toastify({
        text: 'Значение параметра успешно удалено',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      loadEditorData()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при удалении значения параметра',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Управление ручками
  const handleCreateHandle = async () => {
    try {
      await axios.post(`${API_BASE_URL}5000/api/editor-handle/handles`, {
        ...handleForm,
        user_id: userId,
      })
      Toastify({
        text: 'Ручка успешно создана',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      setOpenHandleDialog(false)
      setHandleForm({ article: '', name: '', description: '' })
      loadEditorData()
      loadHistory()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при создании ручки',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleUpdateHandle = async () => {
    try {
      await axios.put(`${API_BASE_URL}5000/api/editor-handle/handles/${editingItem.id}`, {
        ...handleForm,
        user_id: userId,
      })
      Toastify({
        text: 'Ручка успешно обновлена',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      setOpenHandleDialog(false)
      setEditingItem(null)
      setHandleForm({ article: '', name: '', description: '' })
      loadEditorData()
      loadHistory()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при обновлении ручки',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleDeleteHandle = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту ручку?')) return
    
    try {
      await axios.delete(`${API_BASE_URL}5000/api/editor-handle/handles/${id}`, {
        data: { user_id: userId }
      })
      Toastify({
        text: 'Ручка успешно удалена',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      loadEditorData()
      loadHistory()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при удалении ручки',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Управление типами створок
  const handleCreateLeafType = async () => {
    try {
      await axios.post(`${API_BASE_URL}5000/api/editor-handle/leaf-types`, {
        ...leafTypeForm,
        user_id: userId,
      })
      Toastify({
        text: 'Тип створки успешно создан',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      setOpenLeafTypeDialog(false)
      setLeafTypeForm({ name: '', description: '' })
      loadEditorData()
      loadHistory()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при создании типа створки',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleDeleteLeafType = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот тип створки?')) return
    
    try {
      await axios.delete(`${API_BASE_URL}5000/api/editor-handle/leaf-types/${id}`, {
        data: { user_id: userId }
      })
      Toastify({
        text: 'Тип створки успешно удален',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      loadEditorData()
      loadHistory()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при удалении типа створки',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Сохранение правила (с множественным выбором ручек)
  const handleSaveRule = async () => {
    if (!selectedHandles.length || !selectedLeafType) {
      Toastify({
        text: 'Выберите ручки и тип створки',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
      return
    }

    try {
      // Формируем условия из выбранных параметров
      // Логика ИЛИ: если для параметра выбрано несколько значений, создаем несколько условий
      const conditions = []
      Object.entries(selectedParameters).forEach(([paramId, valueIds]) => {
        if (valueIds && valueIds.length > 0) {
          // Для каждого выбранного значения создаем отдельное условие (ИЛИ)
          valueIds.forEach(valueId => {
            conditions.push({
              parameter_id: parseInt(paramId),
              parameter_value_id: parseInt(valueId),
            })
          })
        } else {
          // Если для параметра не выбраны значения, добавляем условие с NULL (любое значение)
          conditions.push({
            parameter_id: parseInt(paramId),
            parameter_value_id: null,
          })
        }
      })

      const response = await axios.post(`${API_BASE_URL}5000/api/editor-handle/rules`, {
        handle_ids: selectedHandles.map(id => parseInt(id)),
        leaf_type_id: parseInt(selectedLeafType),
        quantity: ruleForm.quantity || 1,
        conditions: conditions,
        user_id: userId,
      })
      
      Toastify({
        text: response.data.message || 'Правило успешно сохранено',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      
      setRuleForm({ quantity: 1 })
      setSelectedHandles([])
      setSelectedParameters({})
      loadEditorData()
      loadHistory()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при сохранении правила',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Просмотр правила
  const handleViewRule = async (ruleId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/editor-handle/rules/${ruleId}`)
      setViewingRule(response.data)
      setOpenRuleViewDialog(true)
    } catch (error) {
      Toastify({
        text: 'Ошибка при загрузке правила',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Редактирование правила
  const handleEditRule = async (ruleId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/editor-handle/rules/${ruleId}`)
      const rule = response.data
      
      // Заполняем форму
      setSelectedLeafType(rule.leaf_type_id.toString())
      setSelectedHandles([rule.handle_id.toString()])
      setRuleForm({ quantity: rule.quantity || 1 })
      
      // Заполняем параметры из условий
      const params = {}
      rule.conditions.forEach(condition => {
        if (!params[condition.parameter_id]) {
          params[condition.parameter_id] = []
        }
        if (condition.parameter_value_id) {
          params[condition.parameter_id].push(condition.parameter_value_id)
        }
      })
      setSelectedParameters(params)
      
      setEditingItem(rule)
      setOpenRuleEditDialog(true)
    } catch (error) {
      Toastify({
        text: 'Ошибка при загрузке правила',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Обновление правила
  const handleUpdateRule = async () => {
    if (!editingItem) return

    try {
      const conditions = []
      Object.entries(selectedParameters).forEach(([paramId, valueIds]) => {
        if (valueIds && valueIds.length > 0) {
          valueIds.forEach(valueId => {
            conditions.push({
              parameter_id: parseInt(paramId),
              parameter_value_id: parseInt(valueId),
            })
          })
        } else {
          conditions.push({
            parameter_id: parseInt(paramId),
            parameter_value_id: null,
          })
        }
      })

      await axios.put(`${API_BASE_URL}5000/api/editor-handle/rules/${editingItem.id}`, {
        handle_id: parseInt(selectedHandles[0]),
        leaf_type_id: parseInt(selectedLeafType),
        quantity: ruleForm.quantity || 1,
        conditions: conditions,
        user_id: userId,
      })
      
      Toastify({
        text: 'Правило успешно обновлено',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      
      setOpenRuleEditDialog(false)
      setEditingItem(null)
      setRuleForm({ quantity: 1 })
      setSelectedHandles([])
      setSelectedParameters({})
      loadEditorData()
      loadHistory()
      loadApprovalStatus()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при обновлении правила',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Удаление правила
  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Вы уверены, что хотите удалить это правило?')) return
    
    try {
      await axios.delete(`${API_BASE_URL}5000/api/editor-handle/rules/${ruleId}`, {
        data: { user_id: userId }
      })
      Toastify({
        text: 'Правило успешно удалено',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      loadEditorData()
      loadHistory()
    } catch (error) {
      Toastify({
        text: error.response?.data?.error || 'Ошибка при удалении правила',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Экспорт в Excel
  const handleExportExcel = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/editor-handle/export`)
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(response.data.data)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Правила ручек')
      XLSX.writeFile(workbook, 'правила_ручек.xlsx')
      
      Toastify({
        text: 'Данные успешно экспортированы',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
    } catch (error) {
      Toastify({
        text: 'Ошибка при экспорте данных',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  // Импорт из Excel
  const handleImportExcel = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' })
        
        const response = await axios.post(`${API_BASE_URL}5000/api/editor-handle/import`, { data: jsonData })
        
        Toastify({
          text: `Импорт завершен: создано ${response.data.created}, обновлено ${response.data.updated}`,
          close: true,
          backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
        }).showToast()
        
        if (response.data.errors && response.data.errors.length > 0) {
          console.error('Ошибки импорта:', response.data.errors)
        }
        
        loadEditorData()
        loadHistory()
      } catch (error) {
        Toastify({
          text: error.response?.data?.error || 'Ошибка при импорте данных',
          close: true,
          backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        }).showToast()
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Форматирование истории
  const formatHistoryAction = (action) => {
    const actions = {
      created: 'Создано',
      updated: 'Обновлено',
      deleted: 'Удалено',
    }
    return actions[action] || action
  }

  const formatHistoryEntity = (entityType) => {
    const entities = {
      handle: 'Ручка',
      parameter: 'Параметр',
      rule: 'Правило',
      leaf_type: 'Тип створки',
    }
    return entities[entityType] || entityType
  }

  const getUserName = (historyItem) => {
    if (historyItem.first_name || historyItem.last_name) {
      return `${historyItem.last_name || ''} ${historyItem.first_name || ''} ${historyItem.middle_name || ''}`.trim() || historyItem.username || `ID: ${historyItem.changed_by}`
    }
    return historyItem.username || `ID: ${historyItem.changed_by}`
  }

  if (loading) {
    return (
      <div className="editor-handle">
        <div className="editor-handle__loading">Загрузка...</div>
      </div>
    )
  }

  // Форматирование ФИО
  const formatUserName = (user) => {
    const lastName = user.last_name || ''
    const firstName = user.first_name ? user.first_name[0] : ''
    const middleName = user.middle_name ? user.middle_name[0] : ''
    return `${lastName} ${firstName}.${middleName ? middleName + '.' : ''}`.trim()
  }

  return (
    <Box className="editor-handle">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          Редактор ручек для створок
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => {
              loadHistory()
              setOpenHistoryDialog(true)
            }}
          >
            История изменений
          </Button>
          <Button
            variant="outlined"
            onClick={() => setOpenRestoreDialog(true)}
          >
            Восстановить из снапшота
          </Button>
          {isAdmin && (
            <Button
              variant="outlined"
              onClick={() => {
                loadAllUsers()
                loadApprovalUsers()
                setOpenApprovalUsersDialog(true)
              }}
            >
              Управление пользователями подтверждения
            </Button>
          )}
        </Box>
      </Box>

      {/* Статус эталонности */}
      {approvalStatus && (
        <Alert 
          severity={approvalStatus.isApproved ? 'success' : 'error'}
          sx={{ mb: 2 }}
          action={
            canApprove() && (
              <Button color="inherit" size="small" onClick={handleApprove}>
                Подтвердить эталонность
              </Button>
            )
          }
        >
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              {approvalStatus.isApproved ? '✓ Эталонные данные' : '✗ Эталонность не подтверждена'}
            </Typography>
            {approvalStatus.isApproved && approvalStatus.approvals.length > 0 && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Подтверждено: {approvalStatus.approvals.map(a => formatUserName(a)).join(', ')}
              </Typography>
            )}
            {approvalStatus.hasChanges && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Внимание: После подтверждения были внесены изменения
              </Typography>
            )}
            {approvalStatus.approvals.length > 0 && approvalStatus.approvals.length < approvalStatus.requiredUsers.length && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Ожидается подтверждение от: {approvalStatus.requiredUsers
                  .filter(u => !approvalStatus.approvals.some(a => a.approved_by === u.id))
                  .map(u => formatUserName(u))
                  .join(', ')}
              </Typography>
            )}
          </Box>
        </Alert>
      )}

      {/* Экспорт/Импорт */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportExcel}
        >
          Экспорт в Excel
        </Button>
        <Button
          variant="outlined"
          component="label"
          startIcon={<FileUploadIcon />}
        >
          Импорт из Excel
          <input
            type="file"
            hidden
            accept=".xlsx,.xls"
            onChange={handleImportExcel}
          />
        </Button>
      </Box>

      <Grid container spacing={2}>
        {/* Левая панель - Параметры */}
        <Grid item xs={12} md={7}>
          {/* Выбор типа створки */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Тип створки</InputLabel>
                <Select
                  value={selectedLeafType}
                  label="Тип створки"
                  onChange={(e) => setSelectedLeafType(e.target.value)}
                >
                  {editorData.leafTypes.map((type) => (
                    <MenuItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  setLeafTypeForm({ name: '', description: '' })
                  setEditingItem(null)
                  setOpenLeafTypeDialog(true)
                }}
              >
                Добавить
              </Button>
              {selectedLeafType && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteLeafType(parseInt(selectedLeafType))}
                  title="Удалить тип створки"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>

            {/* Компактное отображение параметров */}
            <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>
              Параметры
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {editorData.parameters.map((param) => (
                <Card key={param.id} variant="outlined" sx={{ p: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {param.name}
                    </Typography>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingParameterId(param.id)
                          setParameterValueForm({ value: '', display_order: 0 })
                          setOpenParameterValueDialog(true)
                        }}
                        title="Добавить значение"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingItem(param)
                          setParameterForm({
                            name: param.name,
                            description: param.description || '',
                            is_multiple: param.is_multiple || false,
                          })
                          setOpenParameterDialog(true)
                        }}
                        title="Редактировать"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteParameter(param.id)}
                        title="Удалить"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  
                  <FormControl fullWidth size="small">
                    {param.is_multiple ? (
                      <Select
                        multiple
                        value={selectedParameters[param.id] || []}
                        onChange={(e) => handleParameterChange(param.id, e.target.value)}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((valueId) => {
                              const value = param.values.find(v => v.id === valueId)
                              return value ? (
                                <Chip key={valueId} label={value.value} size="small" />
                              ) : null
                            })}
                          </Box>
                        )}
                        displayEmpty
                      >
                        {param.values.length === 0 ? (
                          <MenuItem disabled>Нет значений</MenuItem>
                        ) : (
                          param.values.map((value) => (
                            <MenuItem key={value.id} value={value.id}>
                              <Checkbox checked={(selectedParameters[param.id] || []).indexOf(value.id) > -1} />
                              {value.value}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    ) : (
                      <Select
                        value={selectedParameters[param.id]?.[0] || ''}
                        onChange={(e) => handleParameterChange(param.id, e.target.value ? [e.target.value] : [])}
                        displayEmpty
                      >
                        <MenuItem value="">Не выбрано</MenuItem>
                        {param.values.map((value) => (
                          <MenuItem key={value.id} value={value.id}>
                            {value.value}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  </FormControl>
                  
                  {/* Компактный список значений */}
                  {param.values.length > 0 && (
                    <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {param.values.map((value) => (
                        <Chip
                          key={value.id}
                          label={value.value}
                          size="small"
                          onDelete={() => handleDeleteParameterValue(value.id)}
                          sx={{ fontSize: '0.7rem', height: '20px' }}
                        />
                      ))}
                    </Box>
                  )}
                </Card>
              ))}
            </Box>

            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => {
                setParameterForm({ name: '', description: '', is_multiple: true })
                setEditingItem(null)
                setOpenParameterDialog(true)
              }}
              sx={{ mt: 1.5 }}
              fullWidth
            >
              Добавить параметр
            </Button>

            {/* Кнопка подбора ручек */}
            <Button
              variant="contained"
              onClick={findHandles}
              sx={{ mt: 2, width: '100%' }}
            >
              Подобрать ручки
            </Button>
          </Paper>

          {/* Найденные ручки */}
          {foundHandles.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Найденные ручки ({foundHandles.length})
              </Typography>
              {foundHandles.map((handle) => (
                <Card key={handle.handle_id} variant="outlined" sx={{ mb: 1, p: 1.5 }}>
                  <Typography variant="subtitle2">
                    <strong>Артикул:</strong> {handle.article}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {handle.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Количество: {handle.quantity}
                  </Typography>
                </Card>
              ))}
            </Paper>
          )}

          {/* Предупреждения */}
          {warnings.length > 0 && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom color="warning.main">
                Предупреждения
              </Typography>
              {warnings.map((warning, index) => (
                <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                  {warning.message}
                </Alert>
              ))}
            </Paper>
          )}
        </Grid>

        {/* Правая панель - Управление */}
        <Grid item xs={12} md={5}>
          {/* Компактная схема */}
          <Paper sx={{ p: 1, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 0.5 }}>
              Схема створки
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <LeafVisualizer
                leafTypeId={selectedLeafType}
                leafTypes={editorData.leafTypes}
                foundHandles={foundHandles}
              />
            </Box>
          </Paper>

          {/* Сохранение правила */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Сохранить правило
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Ручки (можно выбрать несколько)</InputLabel>
              <Select
                multiple
                value={selectedHandles}
                label="Ручки (можно выбрать несколько)"
                onChange={(e) => setSelectedHandles(e.target.value)}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((handleId) => {
                      const handle = editorData.handles.find(h => h.id.toString() === handleId)
                      return handle ? (
                        <Chip key={handleId} label={`${handle.article}`} size="small" />
                      ) : null
                    })}
                  </Box>
                )}
              >
                {editorData.handles.map((handle) => (
                  <MenuItem key={handle.id} value={handle.id.toString()}>
                    <Checkbox checked={selectedHandles.indexOf(handle.id.toString()) > -1} />
                    {handle.article} - {handle.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              size="small"
              label="Количество"
              type="number"
              value={ruleForm.quantity}
              onChange={(e) => setRuleForm({ ...ruleForm, quantity: parseInt(e.target.value) || 1 })}
              sx={{ mb: 2 }}
            />
            <Button
              variant="contained"
              fullWidth
              startIcon={<SaveIcon />}
              onClick={handleSaveRule}
            >
              Сохранить правило
            </Button>
          </Paper>

          {/* Список правил - дерево */}
          <Paper sx={{ p: 1, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
              Правила ({editorData.rules.length})
            </Typography>
            <Box sx={{ maxHeight: 500, overflowY: 'auto' }}>
              {(() => {
                // Группируем правила по типу створки, затем по ручке
                const groupedRules = {}
                
                editorData.rules.forEach(rule => {
                  const leafTypeId = rule.leaf_type_id
                  const leafTypeName = rule.leaf_type_name || 'Без типа'
                  const handleId = rule.handle_id
                  const handle = editorData.handles.find(h => h.id === handleId)
                  
                  if (!handle) return
                  
                  // Инициализация уровня типа створки
                  if (!groupedRules[leafTypeId]) {
                    groupedRules[leafTypeId] = {
                      leafTypeName,
                      handles: {}
                    }
                  }
                  
                  // Инициализация уровня ручки
                  if (!groupedRules[leafTypeId].handles[handleId]) {
                    groupedRules[leafTypeId].handles[handleId] = {
                      handle: {
                        article: handle.article,
                        name: handle.name
                      },
                      rules: []
                    }
                  }
                  
                  groupedRules[leafTypeId].handles[handleId].rules.push(rule)
                })
                
                // Сортируем по названию типа створки
                const sortedLeafTypes = Object.keys(groupedRules).sort((a, b) => 
                  groupedRules[a].leafTypeName.localeCompare(groupedRules[b].leafTypeName)
                )
                
                return sortedLeafTypes.length > 0 ? (
                  sortedLeafTypes.map(leafTypeId => {
                    const leafTypeData = groupedRules[leafTypeId]
                    const sortedHandles = Object.keys(leafTypeData.handles).sort((a, b) => {
                      const handleA = leafTypeData.handles[a].handle
                      const handleB = leafTypeData.handles[b].handle
                      return (handleA.article || '').localeCompare(handleB.article || '')
                    })
                    
                    return (
                      <Accordion key={leafTypeId} defaultExpanded={false} sx={{ mb: 0.5, '&:before': { display: 'none' } }}>
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />}
                          sx={{ 
                            minHeight: 32,
                            '& .MuiAccordionSummary-content': { my: 0.25 },
                            backgroundColor: 'primary.light',
                            color: 'primary.contrastText',
                            '&:hover': { backgroundColor: 'primary.main' }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
                            <Typography variant="body2" fontWeight={600}>
                              {leafTypeData.leafTypeName}
                            </Typography>
                            <Chip 
                              label={sortedHandles.length}
                              size="small" 
                              sx={{ ml: 'auto', height: 18, fontSize: '0.65rem', backgroundColor: 'rgba(255,255,255,0.2)' }}
                            />
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: 0, py: 0.25 }}>
                          {sortedHandles.map(handleId => {
                            const handleData = leafTypeData.handles[handleId]
                            return (
                              <Accordion key={handleId} sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}>
                                <AccordionSummary
                                  expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
                                  sx={{ 
                                    minHeight: 28,
                                    '& .MuiAccordionSummary-content': { my: 0 },
                                    backgroundColor: 'grey.100',
                                    pl: 1.5,
                                    '&:hover': { backgroundColor: 'grey.200' }
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
                                    <Typography variant="caption" fontWeight={500}>
                                      {handleData.handle.article} - {handleData.handle.name}
                                    </Typography>
                                    <Chip 
                                      label={handleData.rules.length}
                                      size="small"
                                      sx={{ ml: 'auto', height: 16, fontSize: '0.6rem' }}
                                    />
                                  </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ p: 0.5, pl: 2 }}>
                                  {handleData.rules.map((rule, index) => {
                                    const conditions = rule.conditions || []
                                    const conditionsText = conditions.length > 0
                                      ? conditions.map(c => {
                                          const paramName = c.parameter_name || 'Параметр'
                                          const value = c.parameter_value || 'Любое значение'
                                          return `${paramName}: ${value}`
                                        }).join('; ')
                                      : 'Любые значения'
                                    
                                    return (
                                      <Box
                                        key={rule.id}
                                        sx={{
                                          p: 0.5,
                                          mb: 0.25,
                                          border: '1px solid',
                                          borderColor: 'grey.300',
                                          borderRadius: 0.5,
                                          backgroundColor: 'white',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          fontSize: '0.75rem',
                                          '&:hover': {
                                            backgroundColor: 'grey.50',
                                            borderColor: 'primary.main'
                                          }
                                        }}
                                      >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                                          <Typography variant="caption" fontWeight={500} sx={{ minWidth: 24 }}>
                                            #{index + 1}
                                          </Typography>
                                          <Chip 
                                            label={`×${rule.quantity}`} 
                                            size="small"
                                            sx={{ height: 16, fontSize: '0.6rem' }}
                                          />
                                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', ml: 0.5 }}>
                                            {conditionsText}
                                          </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 0.25 }}>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleViewRule(rule.id)}
                                            title="Просмотр"
                                            sx={{ p: 0.25 }}
                                          >
                                            <VisibilityIcon sx={{ fontSize: 14 }} />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleEditRule(rule.id)}
                                            title="Редактировать"
                                            sx={{ p: 0.25 }}
                                          >
                                            <EditIcon sx={{ fontSize: 14 }} />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleDeleteRule(rule.id)}
                                            title="Удалить"
                                            color="error"
                                            sx={{ p: 0.25 }}
                                          >
                                            <DeleteIcon sx={{ fontSize: 14 }} />
                                          </IconButton>
                                        </Box>
                                      </Box>
                                    )
                                  })}
                                </AccordionDetails>
                              </Accordion>
                            )
                          })}
                        </AccordionDetails>
                      </Accordion>
                    )
                  })
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ p: 1, textAlign: 'center', display: 'block' }}>
                    Нет правил
                  </Typography>
                )
              })()}
            </Box>
          </Paper>

          {/* Управление ручками */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Ручки
            </Typography>
            <TableContainer sx={{ maxHeight: 300, overflowY: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Артикул</TableCell>
                    <TableCell>Наименование</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {editorData.handles.map((handle) => (
                    <TableRow key={handle.id}>
                      <TableCell>{handle.article}</TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {handle.name}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingItem(handle)
                            setHandleForm({
                              article: handle.article,
                              name: handle.name,
                              description: handle.description || '',
                            })
                            setOpenHandleDialog(true)
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteHandle(handle.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => {
                setHandleForm({ article: '', name: '', description: '' })
                setEditingItem(null)
                setOpenHandleDialog(true)
              }}
              sx={{ mt: 1 }}
              fullWidth
            >
              Добавить ручку
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Диалог создания/редактирования параметра */}
      <Dialog open={openParameterDialog} onClose={() => setOpenParameterDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? 'Редактировать параметр' : 'Создать параметр'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Название"
            value={parameterForm.name}
            onChange={(e) => setParameterForm({ ...parameterForm, name: e.target.value })}
            sx={{ mb: 2, mt: 2 }}
          />
          <TextField
            fullWidth
            label="Описание"
            multiline
            rows={3}
            value={parameterForm.description}
            onChange={(e) => setParameterForm({ ...parameterForm, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={parameterForm.is_multiple}
                disabled
              //  onChange={(e) => setParameterForm({ ...parameterForm, is_multiple: e.target.checked })}
              />
            }
            label="Множественный выбор значений (ИЛИ)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenParameterDialog(false)}>Отмена</Button>
          <Button onClick={editingItem ? handleUpdateParameter : handleCreateParameter} variant="contained">
            {editingItem ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания значения параметра */}
      <Dialog open={openParameterValueDialog} onClose={() => setOpenParameterValueDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Добавить значение параметра</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Значение"
            value={parameterValueForm.value}
            onChange={(e) => setParameterValueForm({ ...parameterValueForm, value: e.target.value })}
            sx={{ mb: 2, mt: 2 }}
          />
          <TextField
            fullWidth
            label="Порядок отображения"
            type="number"
            value={parameterValueForm.display_order}
            onChange={(e) => setParameterValueForm({ ...parameterValueForm, display_order: parseInt(e.target.value) || 0 })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenParameterValueDialog(false)}>Отмена</Button>
          <Button onClick={handleCreateParameterValue} variant="contained">
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания/редактирования ручки */}
      <Dialog open={openHandleDialog} onClose={() => setOpenHandleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? 'Редактировать ручку' : 'Создать ручку'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Артикул"
            value={handleForm.article}
            onChange={(e) => setHandleForm({ ...handleForm, article: e.target.value })}
            sx={{ mb: 2, mt: 2 }}
          />
          <TextField
            fullWidth
            label="Наименование"
            value={handleForm.name}
            onChange={(e) => setHandleForm({ ...handleForm, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Описание"
            multiline
            rows={3}
            value={handleForm.description}
            onChange={(e) => setHandleForm({ ...handleForm, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenHandleDialog(false)}>Отмена</Button>
          <Button onClick={editingItem ? handleUpdateHandle : handleCreateHandle} variant="contained">
            {editingItem ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания типа створки */}
      <Dialog open={openLeafTypeDialog} onClose={() => setOpenLeafTypeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Создать тип створки</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Название"
            value={leafTypeForm.name}
            onChange={(e) => setLeafTypeForm({ ...leafTypeForm, name: e.target.value })}
            sx={{ mb: 2, mt: 2 }}
          />
          <TextField
            fullWidth
            label="Описание"
            multiline
            rows={3}
            value={leafTypeForm.description}
            onChange={(e) => setLeafTypeForm({ ...leafTypeForm, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenLeafTypeDialog(false)}>Отмена</Button>
          <Button onClick={handleCreateLeafType} variant="contained">
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог просмотра правила */}
      <Dialog open={openRuleViewDialog} onClose={() => setOpenRuleViewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Правило: {viewingRule?.handle_article} - {viewingRule?.leaf_type_name}
        </DialogTitle>
        <DialogContent>
          {viewingRule && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Ручка:</strong> {viewingRule.handle_article} - {viewingRule.handle_name}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Тип створки:</strong> {viewingRule.leaf_type_name}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Количество:</strong> {viewingRule.quantity}
              </Typography>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Условия:
              </Typography>
              {viewingRule.conditions && viewingRule.conditions.length > 0 ? (
                <Box>
                  {Object.entries(
                    viewingRule.conditions.reduce((acc, cond) => {
                      if (!acc[cond.parameter_name]) {
                        acc[cond.parameter_name] = []
                      }
                      acc[cond.parameter_name].push(cond.parameter_value || 'Любое значение')
                      return acc
                    }, {})
                  ).map(([paramName, values]) => (
                    <Box key={paramName} sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {paramName}: {values.join(', ')}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Нет условий
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRuleViewDialog(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования правила */}
      <Dialog open={openRuleEditDialog} onClose={() => setOpenRuleEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Редактировать правило</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2, mt: 2 }}>
            <InputLabel>Ручка</InputLabel>
            <Select
              value={selectedHandles[0] || ''}
              label="Ручка"
              onChange={(e) => setSelectedHandles([e.target.value])}
            >
              {editorData.handles.map((handle) => (
                <MenuItem key={handle.id} value={handle.id.toString()}>
                  {handle.article} - {handle.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Количество"
            type="number"
            value={ruleForm.quantity}
            onChange={(e) => setRuleForm({ ...ruleForm, quantity: parseInt(e.target.value) || 1 })}
            sx={{ mb: 2 }}
          />
          <Typography variant="subtitle2" gutterBottom>
            Параметры (текущие значения):
          </Typography>
          {editorData.parameters.map((param) => (
            <FormControl key={param.id} fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel>{param.name}</InputLabel>
              {param.is_multiple ? (
                <Select
                  multiple
                  value={selectedParameters[param.id] || []}
                  onChange={(e) => handleParameterChange(param.id, e.target.value)}
                  label={param.name}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((valueId) => {
                        const value = param.values.find(v => v.id === valueId)
                        return value ? (
                          <Chip key={valueId} label={value.value} size="small" />
                        ) : null
                      })}
                    </Box>
                  )}
                >
                  {param.values.map((value) => (
                    <MenuItem key={value.id} value={value.id}>
                      <Checkbox checked={(selectedParameters[param.id] || []).indexOf(value.id) > -1} />
                      {value.value}
                    </MenuItem>
                  ))}
                </Select>
              ) : (
                <Select
                  value={selectedParameters[param.id]?.[0] || ''}
                  onChange={(e) => handleParameterChange(param.id, e.target.value ? [e.target.value] : [])}
                  label={param.name}
                >
                  <MenuItem value="">Не выбрано</MenuItem>
                  {param.values.map((value) => (
                    <MenuItem key={value.id} value={value.id}>
                      {value.value}
                    </MenuItem>
                  ))}
                </Select>
              )}
            </FormControl>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRuleEditDialog(false)}>Отмена</Button>
          <Button onClick={handleUpdateRule} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог истории изменений */}
      <Dialog open={openHistoryDialog} onClose={() => setOpenHistoryDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>История изменений</DialogTitle>
        <DialogContent>
          <Tabs value={historyTab} onChange={(e, v) => setHistoryTab(v)} sx={{ mb: 2 }}>
            <Tab label="Все" />
            <Tab label="Правила" />
            <Tab label="Ручки" />
            <Tab label="Параметры" />
            <Tab label="Типы створок" />
          </Tabs>
          <TableContainer sx={{ maxHeight: 500, overflowY: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Дата</TableCell>
                  <TableCell>Тип</TableCell>
                  <TableCell>Действие</TableCell>
                  <TableCell>Пользователь</TableCell>
                  <TableCell>Детали</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history
                  .filter(item => {
                    if (historyTab === 0) return true
                    if (historyTab === 1) return item.entity_type === 'rule'
                    if (historyTab === 2) return item.entity_type === 'handle'
                    if (historyTab === 3) return item.entity_type === 'parameter'
                    if (historyTab === 4) return item.entity_type === 'leaf_type'
                    return true
                  })
                  .map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {new Date(item.created_at).toLocaleString('ru-RU')}
                      </TableCell>
                      <TableCell>{formatHistoryEntity(item.entity_type)}</TableCell>
                      <TableCell>{formatHistoryAction(item.action)}</TableCell>
                      <TableCell>{getUserName(item)}</TableCell>
                      <TableCell>
                        <Box sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.action === 'created' && item.new_data && (() => {
                            try {
                              const data = typeof item.new_data === 'string' 
                                ? JSON.parse(item.new_data) 
                                : item.new_data
                              return (
                                <Typography variant="caption">
                                  {JSON.stringify(data, null, 2).substring(0, 100)}...
                                </Typography>
                              )
                            } catch (e) {
                              return (
                                <Typography variant="caption">
                                  {typeof item.new_data === 'string' 
                                    ? item.new_data.substring(0, 100) 
                                    : 'Создано'}
                                </Typography>
                              )
                            }
                          })()}
                          {item.action === 'updated' && (
                            <Typography variant="caption" color="text.secondary">
                              Изменено
                            </Typography>
                          )}
                          {item.action === 'deleted' && (
                            <Typography variant="caption" color="error">
                              Удалено
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenHistoryDialog(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог восстановления из снапшота */}
      <Dialog open={openRestoreDialog} onClose={() => setOpenRestoreDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Восстановление из снапшота</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="error" sx={{ mb: 2 }}>
            Внимание: Восстановление данных удалит все текущие изменения. Убедитесь, что вы сохранили важные данные.
          </Typography>
          <TableContainer sx={{ maxHeight: 400, overflowY: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Дата</TableCell>
                  <TableCell>Описание</TableCell>
                  <TableCell>Статус эталонности</TableCell>
                  <TableCell>Создал</TableCell>
                  <TableCell>Действие</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {snapshots.map((snapshot) => (
                  <TableRow key={snapshot.id}>
                    <TableCell>
                      {new Date(snapshot.snapshot_date).toLocaleString('ru-RU')}
                    </TableCell>
                    <TableCell>{snapshot.description || 'Без описания'}</TableCell>
                    <TableCell>
                      {snapshot.is_approved ? (
                        <Chip 
                          label="Эталон подтвержден" 
                          color="success" 
                          size="small"
                          icon={<CheckCircleIcon />}
                        />
                      ) : (
                        <Chip 
                          label="Эталон не подтвержден" 
                          color="default" 
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {snapshot.first_name || snapshot.last_name
                        ? `${snapshot.last_name || ''} ${snapshot.first_name || ''} ${snapshot.middle_name || ''}`.trim()
                        : snapshot.username || 'Неизвестно'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={() => handleRestoreSnapshot(snapshot.id)}
                        >
                          Восстановить
                        </Button>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteSnapshot(snapshot.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {snapshots.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      Нет доступных снапшотов
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRestoreDialog(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleCreateSnapshot}
            startIcon={<AddIcon />}
          >
            Создать снапшот
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог управления пользователями подтверждения (только для администратора) */}
      {isAdmin && (
        <Dialog open={openApprovalUsersDialog} onClose={() => setOpenApprovalUsersDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Управление пользователями для подтверждения эталонности</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              Выберите пользователей, которые смогут подтверждать эталонность данных. 
              После подтверждения всеми выбранными пользователями, данные будут считаться эталонными.
            </Typography>
            
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Разрешенные пользователи:
            </Typography>
            {approvalUsers.length > 0 ? (
              <TableContainer sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ФИО</TableCell>
                      <TableCell>Роль</TableCell>
                      <TableCell>Действие</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {approvalUsers.map((approvalUser) => (
                      <TableRow key={approvalUser.id}>
                        <TableCell>{formatUserFullName(approvalUser)}</TableCell>
                        <TableCell>{approvalUser.role_name || 'Не указана'}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveApprovalUser(approvalUser.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Нет разрешенных пользователей. Добавьте пользователей из списка ниже.
              </Typography>
            )}

            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Добавить пользователя:
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="Поиск по фамилии или имени"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              sx={{ mb: 2 }}
              placeholder="Введите фамилию или имя для поиска"
            />
            <TableContainer sx={{ maxHeight: 400, overflowY: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ФИО</TableCell>
                    <TableCell>Роль</TableCell>
                    <TableCell>Действие</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getFilteredUsers().map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{formatUserFullName(user)}</TableCell>
                      <TableCell>{user.role_name || 'Не указана'}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleAddApprovalUser(user.id)}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {getFilteredUsers().length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        {searchUser ? 'Пользователи не найдены' : 'Все пользователи уже добавлены'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setOpenApprovalUsersDialog(false)
              setSearchUser('')
            }}>Закрыть</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  )
}

export default EditorHandle
