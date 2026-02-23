import { useState, useEffect, useRef, useCallback } from 'react'
import Toastify from 'toastify-js'
import useUserStore from '../../../store/userStore'
import useBusinessProcessStore from '../../../store/useBusinessProcessStore'
import {
  getProcesses,
  startProcess,
  getInstance,
  completeTaskCreation,
  completeProjectCreation,
  deleteProcess,
  updateProcess,
} from '../../../api/businessProcessApi.js'
import ProcessCard from './ProcessCard'
import StartProcessModal from './StartProcessModal'
import AddModal from '../../kanbanBoard/Modals/AddModal.jsx'
import CreateGlobalTaskForm from '../../kanbanBoard/globalTask/CreateGlobalTaskForm.jsx'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config.js'
import './ProcessList.scss'

const POLL_INTERVAL_MS = 2000
const FINAL_STATUSES = ['completed', 'failed', 'cancelled']

const ProcessList = ({ showDrafts = false, onEditProcess, onCreateNew }) => {
  const { user } = useUserStore()
  const { processes, setProcesses, setLoading, setError } = useBusinessProcessStore()
  const [loading, setLoadingLocal] = useState(true)
  const [startModalProcess, setStartModalProcess] = useState(null)
  const [activeInstanceId, setActiveInstanceId] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [pendingTaskCreationData, setPendingTaskCreationData] = useState(null)
  const [projectCreationModalOpen, setProjectCreationModalOpen] = useState(false)
  const [pendingProjectCreationData, setPendingProjectCreationData] = useState(null)
  const skipReopenForInstanceIdRef = useRef(null)

  const loadProcesses = useCallback(async () => {
    setLoadingLocal(true)
    setLoading(true)
    try {
      const list = await getProcesses({ is_draft: showDrafts })
      setProcesses(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error('Ошибка загрузки процессов:', err)
      setProcesses([])
      setError(err.message || 'Не удалось загрузить список процессов')
      Toastify({
        text: 'Не удалось загрузить список процессов. Убедитесь, что сервер BPE запущен (порт 5010).',
        close: true,
        backgroundColor: '#64748b',
      }).showToast()
    } finally {
      setLoadingLocal(false)
      setLoading(false)
    }
  }, [showDrafts, setProcesses, setLoading, setError])

  useEffect(() => {
    loadProcesses()
  }, [loadProcesses])

  const handleStart = (process) => {
    setStartModalProcess(process)
  }

  const handleEdit = (process) => {
    if (typeof onEditProcess === 'function') onEditProcess(process)
  }

  const handlePublish = async (process) => {
    const name = process?.name || 'Без названия'
    const ok = window.confirm(`Опубликовать процесс «${name}»? После публикации он появится в списке готовых процессов и его можно будет запускать.`)
    if (!ok) return
    try {
      await updateProcess(process.id, {
        name: process.name,
        description: process.description || '',
        scheme: process.scheme,
        is_draft: false,
      })
      Toastify({ text: 'Процесс опубликован', close: true, backgroundColor: '#059669' }).showToast()
      await loadProcesses()
    } catch (err) {
      console.error('Ошибка публикации процесса:', err)
      Toastify({
        text: err.response?.data?.error || 'Не удалось опубликовать процесс',
        close: true,
        backgroundColor: 'linear-gradient(to right, #b91c1c, #dc2626)',
      }).showToast()
    }
  }

  const handleDelete = async (process) => {
    const name = process?.name || 'Без названия'
    const ok = window.confirm(`Удалить процесс «${name}»?`)
    if (!ok) return
    try {
      await deleteProcess(process.id)
      Toastify({ text: 'Процесс удалён', close: true, backgroundColor: '#059669' }).showToast()
      await loadProcesses()
    } catch (err) {
      console.error('Ошибка удаления процесса:', err)
      Toastify({
        text: err.response?.data?.error || 'Не удалось удалить процесс',
        close: true,
        backgroundColor: 'linear-gradient(to right, #b91c1c, #dc2626)',
      }).showToast()
    }
  }

  const handleCloseStartModal = () => {
    setStartModalProcess(null)
  }

  const handleConfirmStart = async (initiatorId) => {
    if (!startModalProcess) return
    try {
      const instance = await startProcess(startModalProcess.id, {
        initiator_id: initiatorId || user?.id,
        launched_by_user_id: user?.id,
      })
      Toastify({
        text: 'Процесс запущен',
        close: true,
        backgroundColor: 'linear-gradient(to right, #059669, #10b981)',
      }).showToast()
      handleCloseStartModal()
      if (instance && instance.id) {
        setActiveInstanceId(instance.id)
        skipReopenForInstanceIdRef.current = null
      }
    } catch (err) {
      console.error('Ошибка запуска процесса:', err)
      Toastify({
        text: err.response?.data?.error || 'Не удалось запустить процесс',
        close: true,
        backgroundColor: 'linear-gradient(to right, #b91c1c, #dc2626)',
      }).showToast()
    }
  }

  useEffect(() => {
    if (!activeInstanceId || addModalOpen || projectCreationModalOpen) return
    const t = setInterval(async () => {
      try {
        const instance = await getInstance(activeInstanceId)
        const status = instance.status
        const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
        const pendingTask = context.pending_task_creation
        const pendingProject = context.pending_project_creation

        if (FINAL_STATUSES.includes(status)) {
          setActiveInstanceId(null)
          skipReopenForInstanceIdRef.current = null
          return
        }
        if (status !== 'waiting_user_input') {
          skipReopenForInstanceIdRef.current = null
          return
        }
        if (pendingProject && pendingProject.templateData && skipReopenForInstanceIdRef.current !== activeInstanceId) {
          setPendingProjectCreationData({ instanceId: activeInstanceId, templateData: pendingProject.templateData })
          setProjectCreationModalOpen(true)
          return
        }
        if (!pendingTask || !pendingTask.templateData) return
        if (skipReopenForInstanceIdRef.current === activeInstanceId) return
        setPendingTaskCreationData({ instanceId: activeInstanceId, templateData: pendingTask.templateData })
        setAddModalOpen(true)
      } catch (e) {
        console.warn('ProcessList poll instance:', e)
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [activeInstanceId, addModalOpen, projectCreationModalOpen])

  const handleAddModalClose = (taskId) => {
    if (taskId != null && pendingTaskCreationData) {
      completeTaskCreation(pendingTaskCreationData.instanceId, { task_id: taskId })
        .then(() => {
          Toastify({
            text: 'Задача создана, процесс продолжен',
            close: true,
            backgroundColor: 'linear-gradient(to right, #059669, #10b981)',
          }).showToast()
        })
        .catch((err) => {
          Toastify({
            text: err.response?.data?.error || 'Ошибка продолжения процесса',
            close: true,
            backgroundColor: 'linear-gradient(to right, #b91c1c, #dc2626)',
          }).showToast()
        })
    } else if (pendingTaskCreationData) {
      skipReopenForInstanceIdRef.current = pendingTaskCreationData.instanceId
    }
    setAddModalOpen(false)
    setPendingTaskCreationData(null)
  }

  const initialTaskDataFromTemplate = pendingTaskCreationData?.templateData
    ? {
        title: pendingTaskCreationData.templateData.title || '',
        description: pendingTaskCreationData.templateData.description || '',
        deadline: pendingTaskCreationData.templateData.deadline || '',
        priority: pendingTaskCreationData.templateData.priority || 'низкий',
        implementers: pendingTaskCreationData.templateData.assigneeUserIds || [],
        approvers: pendingTaskCreationData.templateData.approverUserIds || [],
        viewers: pendingTaskCreationData.templateData.viewerUserIds || [],
      }
    : undefined

  const initialProjectDataFromTemplate = pendingProjectCreationData?.templateData
    ? {
        title: pendingProjectCreationData.templateData.title || '',
        description: pendingProjectCreationData.templateData.description || '',
        goals: Array.isArray(pendingProjectCreationData.templateData.goals) && pendingProjectCreationData.templateData.goals.length
          ? pendingProjectCreationData.templateData.goals
          : [''],
        deadline: pendingProjectCreationData.templateData.deadline
          ? new Date(pendingProjectCreationData.templateData.deadline)
          : null,
        priority: pendingProjectCreationData.templateData.priority || 'medium',
        additionalInfo: Array.isArray(pendingProjectCreationData.templateData.additionalInfo)
          ? (pendingProjectCreationData.templateData.additionalInfo.reduce((acc, it) => {
              const k = String(it?.key || '').trim()
              if (k) acc[k] = it?.value ?? ''
              return acc
            }, {}))
          : {},
        responsibles: Array.isArray(pendingProjectCreationData.templateData.responsibles)
          ? pendingProjectCreationData.templateData.responsibles
          : [],
      }
    : undefined

  const handleProjectCreationModalSave = async (newTaskData) => {
    if (!pendingProjectCreationData) return
    try {
      const dataToSend = {
        ...newTaskData,
        created_by: user?.id,
        deadline: newTaskData.deadline ? newTaskData.deadline.toISOString() : null,
      }
      const response = await axios.post(
        `${API_BASE_URL}5000/api/create/global-tasks`,
        dataToSend,
        { headers: { 'Content-Type': 'application/json' } }
      )
      const projectId = response.data?.taskId
      if (projectId != null) {
        await completeProjectCreation(pendingProjectCreationData.instanceId, { project_id: projectId })
        Toastify({
          text: 'Проект создан, процесс продолжен',
          close: true,
          backgroundColor: 'linear-gradient(to right, #059669, #10b981)',
        }).showToast()
      }
    } catch (err) {
      console.error('Ошибка создания проекта:', err)
      Toastify({
        text: err.response?.data?.error || 'Ошибка при создании проекта',
        close: true,
        backgroundColor: 'linear-gradient(to right, #b91c1c, #dc2626)',
      }).showToast()
      return
    }
    setProjectCreationModalOpen(false)
    setPendingProjectCreationData(null)
  }

  const handleProjectCreationModalClose = () => {
    if (pendingProjectCreationData) {
      skipReopenForInstanceIdRef.current = pendingProjectCreationData.instanceId
    }
    setProjectCreationModalOpen(false)
    setPendingProjectCreationData(null)
  }

  if (loading) {
    return (
      <div className="process-list process-list--loading">
        <p>Загрузка процессов...</p>
      </div>
    )
  }

  const emptyMessage = showDrafts
    ? { title: 'Нет черновиков.', hint: 'Создайте процесс во вкладке «Конструктор» и сохраните его как черновик.' }
    : { title: 'Нет опубликованных бизнес-процессов.', hint: 'Создайте процесс во вкладке «Конструктор» и опубликуйте его.' }

  return (
    <div className="process-list">
      {processes.length === 0 ? (
        <div className="process-list__empty">
          <p>{emptyMessage.title}</p>
          <p className="process-list__empty-hint">
            {emptyMessage.hint}
          </p>
          {typeof onCreateNew === 'function' && (
            <button
              type="button"
              className="process-list__create-btn"
              onClick={onCreateNew}
            >
              Создать процесс
            </button>
          )}
        </div>
      ) : (
        <div className="process-list__grid">
          {processes.map((process) => (
            <ProcessCard
              key={process.id}
              process={process}
              isDraft={showDrafts}
              currentUserId={user?.id}
              onStart={() => handleStart(process)}
              onPublish={() => handlePublish(process)}
              onEdit={() => handleEdit(process)}
              onDelete={() => handleDelete(process)}
            />
          ))}
        </div>
      )}

      {startModalProcess && (
        <StartProcessModal
          process={startModalProcess}
          currentUserId={user?.id}
          onClose={handleCloseStartModal}
          onConfirm={handleConfirmStart}
        />
      )}

      {addModalOpen && pendingTaskCreationData && (
        <AddModal
          isOpen={addModalOpen}
          setOpen={setAddModalOpen}
          onClose={handleAddModalClose}
          userId={user?.id}
          initialTaskData={initialTaskDataFromTemplate}
          businessProcessInstanceId={pendingTaskCreationData.instanceId}
        />
      )}

      {projectCreationModalOpen && pendingProjectCreationData && (
        <CreateGlobalTaskForm
          initialData={initialProjectDataFromTemplate}
          onSave={handleProjectCreationModalSave}
          onCancel={handleProjectCreationModalClose}
        />
      )}
    </div>
  )
}

export default ProcessList
