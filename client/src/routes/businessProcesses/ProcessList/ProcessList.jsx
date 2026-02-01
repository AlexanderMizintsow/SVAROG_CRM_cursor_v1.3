import { useState, useEffect, useRef } from 'react'
import Toastify from 'toastify-js'
import useUserStore from '../../../store/userStore'
import useBusinessProcessStore from '../../../store/useBusinessProcessStore'
import {
  getProcesses,
  startProcess,
  getInstance,
  completeTaskCreation,
  deleteProcess,
} from '../../../api/businessProcessApi.js'
import ProcessCard from './ProcessCard'
import StartProcessModal from './StartProcessModal'
import AddModal from '../../kanbanBoard/Modals/AddModal.jsx'
import './ProcessList.scss'

const POLL_INTERVAL_MS = 2000
const FINAL_STATUSES = ['completed', 'failed', 'cancelled']

const ProcessList = ({ onEditProcess, onCreateNew }) => {
  const { user } = useUserStore()
  const { processes, setProcesses, setLoading, setError } = useBusinessProcessStore()
  const [loading, setLoadingLocal] = useState(true)
  const [startModalProcess, setStartModalProcess] = useState(null)
  const [activeInstanceId, setActiveInstanceId] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [pendingTaskCreationData, setPendingTaskCreationData] = useState(null)
  const skipReopenForInstanceIdRef = useRef(null)

  const loadProcesses = async () => {
    setLoadingLocal(true)
    setLoading(true)
    try {
      const list = await getProcesses({ is_draft: false })
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
  }

  useEffect(() => {
    loadProcesses()
  }, [])

  const handleStart = (process) => {
    setStartModalProcess(process)
  }

  const handleEdit = (process) => {
    if (typeof onEditProcess === 'function') onEditProcess(process)
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
    if (!activeInstanceId || addModalOpen) return
    const t = setInterval(async () => {
      try {
        const instance = await getInstance(activeInstanceId)
        const status = instance.status
        const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
        const pending = context.pending_task_creation

        if (FINAL_STATUSES.includes(status)) {
          setActiveInstanceId(null)
          skipReopenForInstanceIdRef.current = null
          return
        }
        if (status !== 'waiting_user_input') {
          skipReopenForInstanceIdRef.current = null
          return
        }
        if (!pending || !pending.templateData) return
        if (skipReopenForInstanceIdRef.current === activeInstanceId) return
        setPendingTaskCreationData({ instanceId: activeInstanceId, templateData: pending.templateData })
        setAddModalOpen(true)
      } catch (e) {
        console.warn('ProcessList poll instance:', e)
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [activeInstanceId, addModalOpen])

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
        priority: pendingTaskCreationData.templateData.priority || 'низкий',
        implementers: pendingTaskCreationData.templateData.assigneeUserIds || [],
        approvers: pendingTaskCreationData.templateData.approverUserIds || [],
        viewers: pendingTaskCreationData.templateData.viewerUserIds || [],
      }
    : undefined

  if (loading) {
    return (
      <div className="process-list process-list--loading">
        <p>Загрузка процессов...</p>
      </div>
    )
  }

  return (
    <div className="process-list">
      {processes.length === 0 ? (
        <div className="process-list__empty">
          <p>Нет опубликованных бизнес-процессов.</p>
          <p className="process-list__empty-hint">
            Создайте процесс во вкладке «Конструктор» и опубликуйте его.
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
              onStart={() => handleStart(process)}
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
    </div>
  )
}

export default ProcessList
