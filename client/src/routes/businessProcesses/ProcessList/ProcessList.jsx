import { useState, useEffect } from 'react'
import Toastify from 'toastify-js'
import useUserStore from '../../../store/userStore'
import useBusinessProcessStore from '../../../store/useBusinessProcessStore'
import {
  getProcesses,
  startProcess,
} from '../../../api/businessProcessApi'
import ProcessCard from './ProcessCard'
import StartProcessModal from './StartProcessModal'
import './ProcessList.scss'

const ProcessList = () => {
  const { user } = useUserStore()
  const { processes, setProcesses, setLoading, setError } = useBusinessProcessStore()
  const [loading, setLoadingLocal] = useState(true)
  const [startModalProcess, setStartModalProcess] = useState(null)

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

  const handleCloseStartModal = () => {
    setStartModalProcess(null)
  }

  const handleConfirmStart = async (initiatorId) => {
    if (!startModalProcess) return
    try {
      await startProcess(startModalProcess.id, {
        initiator_id: initiatorId || user?.id,
        launched_by_user_id: user?.id,
      })
      Toastify({
        text: 'Процесс запущен',
        close: true,
        backgroundColor: 'linear-gradient(to right, #059669, #10b981)',
      }).showToast()
      handleCloseStartModal()
    } catch (err) {
      console.error('Ошибка запуска процесса:', err)
      Toastify({
        text: err.response?.data?.error || 'Не удалось запустить процесс',
        close: true,
        backgroundColor: 'linear-gradient(to right, #b91c1c, #dc2626)',
      }).showToast()
    }
  }

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
        </div>
      ) : (
        <div className="process-list__grid">
          {processes.map((process) => (
            <ProcessCard
              key={process.id}
              process={process}
              onStart={() => handleStart(process)}
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
    </div>
  )
}

export default ProcessList
