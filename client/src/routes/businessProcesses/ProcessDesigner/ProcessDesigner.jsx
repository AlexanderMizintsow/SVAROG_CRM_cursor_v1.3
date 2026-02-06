import { useCallback } from 'react'
import Toastify from 'toastify-js'
import useBusinessProcessStore from '../../../store/useBusinessProcessStore.js'
import { createProcess, updateProcess, deleteProcess } from '../../../api/businessProcessApi.js'
import Palette from './Palette/Palette.jsx'
import FlowCanvas from './Canvas/FlowCanvas.jsx'
import PropertiesPanel from './PropertiesPanel/PropertiesPanel.jsx'
import DesignerToolbar from './DesignerToolbar.jsx'
import './ProcessDesigner.scss'

const ProcessDesigner = () => {
  const {
    scheme,
    selectedProcess,
    processName,
    processDescription,
    isDraft,
    setProcessName,
    setProcessDescription,
    setIsDraft,
    resetDesigner,
  } = useBusinessProcessStore()

  const validateScheme = useCallback((forPublish = false) => {
    const nodes = Array.isArray(scheme?.nodes) ? scheme.nodes : []
    const edges = Array.isArray(scheme?.edges) ? scheme.edges : []
    const startCount = nodes.filter((n) => n.type === 'start').length
    if (startCount === 0) {
      return 'Добавьте блок «Старт» (ровно один).'
    }
    if (startCount > 1) {
      return 'Должен быть только один блок «Старт».'
    }
    const endCount = nodes.filter((n) => n.type === 'end').length
    if (endCount === 0) {
      return 'Добавьте хотя бы один блок «Конец».'
    }
    if (!processName?.trim()) {
      return 'Укажите название процесса.'
    }

    // При публикации — проверки обязательных полей и связности
    if (forPublish) {
      const targetIds = new Set(edges.map((e) => e.target))

      for (const node of nodes) {
        // Дорожки — чисто визуальные контейнеры, не участвуют в связности процесса
        if (node.type === 'lane') continue
        if (node.type === 'start') continue
        if (!targetIds.has(node.id)) {
          const label = node.label || node.type || node.id
          return `Блок «${label}» не связан со схемой. У каждого блока (кроме Старт) должен быть хотя бы один вход.`
        }
        if (node.type === 'gateway_join') {
          const incomingFrom = edges.filter((e) => e.target === node.id).map((e) => nodes.find((n) => n.id === e.source)?.type).filter(Boolean)
          const allowed = ['create_task', 'assign_task', 'decision']
          const hasAllowed = incomingFrom.some((t) => allowed.includes(t))
          if (!hasAllowed) {
            const label = node.label || node.type || node.id
            return `Блок «Развилка-Слияние» («${label}»): подключите хотя бы один входящий блок «Создать задачу», «Назначить задачу» или «Принятие решения».`
          }
        }
        if (node.type === 'splitter') {
          const outgoingCount = edges.filter((e) => e.source === node.id).length
          if (outgoingCount < 2) {
            const label = node.label || node.type || node.id
            return `Блок «Разделитель» («${label}»): подключите минимум две исходящие ветки.`
          }
        }
      }

      for (const node of nodes) {
        if (node.type === 'lane') continue
        const s = node.settings || {}
        const label = node.label || node.type

        if (node.type === 'create_task' && (s.createMode || 'prepared') === 'prepared') {
          if (!(s.title || '').trim()) {
            return `Блок «Создать задачу» («${label}»): заполните «Название задачи (шаблон)».`
          }
          if (!(s.description || '').trim()) {
            return `Блок «Создать задачу» («${label}»): заполните «Описание (шаблон, HTML)».`
          }
          const assigneeSource = s.assigneeSource || 'users'
          if (assigneeSource === 'users') {
            const ids = s.assigneeUserIds || []
            if (!Array.isArray(ids) || ids.length === 0) {
              return `Блок «Создать задачу» («${label}»): выберите хотя бы одного исполнителя.`
            }
          } else if (assigneeSource === 'department' && !s.departmentId) {
            return `Блок «Создать задачу» («${label}»): выберите отдел для исполнителей.`
          } else if (assigneeSource === 'role' && !s.roleId) {
            return `Блок «Создать задачу» («${label}»): выберите роль для исполнителей.`
          }
        }

        if (node.type === 'notification') {
          const ch = s.channels || {}
          const hasChannel = ch.inApp !== false || ch.telegram === true
          if (!hasChannel) {
            return `Блок «Уведомление» («${label}»): выберите хотя бы один канал (В приложении или Telegram).`
          }
          if (!(s.messageText || '').trim()) {
            return `Блок «Уведомление» («${label}»): заполните «Текст сообщения».`
          }
          const recipientSource = s.recipientSource || 'users'
          if (recipientSource === 'users') {
            const ids = s.userIds || []
            if (!Array.isArray(ids) || ids.length === 0) {
              return `Блок «Уведомление» («${label}»): выберите хотя бы одного получателя.`
            }
          } else if (recipientSource === 'department' && !s.departmentId) {
            return `Блок «Уведомление» («${label}»): выберите отдел получателей.`
          } else if (recipientSource === 'role' && !s.roleId) {
            return `Блок «Уведомление» («${label}»): выберите роль получателей.`
          } else if (recipientSource === 'task_assignee' && !s.taskSourceNodeId) {
            return `Блок «Уведомление» («${label}»): выберите блок-источник исполнителя задачи.`
          }
        }
      }
    }

    return null
  }, [scheme, processName])

  const handleSaveDraft = useCallback(async () => {
    const err = validateScheme()
    if (err) {
      Toastify({ text: err, close: true, backgroundColor: '#b91c1c' }).showToast()
      return
    }
    try {
      if (selectedProcess?.id) {
        await updateProcess(selectedProcess.id, {
          name: processName.trim(),
          description: processDescription?.trim() || '',
          scheme,
          is_draft: true,
        })
        Toastify({ text: 'Черновик сохранён', close: true, backgroundColor: '#059669' }).showToast()
      } else {
        await createProcess({
          name: processName.trim(),
          description: processDescription?.trim() || '',
          scheme,
          is_draft: true,
        })
        Toastify({ text: 'Процесс создан (черновик)', close: true, backgroundColor: '#059669' }).showToast()
        resetDesigner()
      }
    } catch (e) {
      console.error(e)
      Toastify({
        text: e.response?.data?.error || 'Не удалось сохранить',
        close: true,
        backgroundColor: '#b91c1c',
      }).showToast()
    }
  }, [validateScheme, selectedProcess, processName, processDescription, scheme, resetDesigner])

  const handlePublish = useCallback(async () => {
    const err = validateScheme(true)
    if (err) {
      Toastify({ text: err, close: true, backgroundColor: '#b91c1c' }).showToast()
      return
    }
    try {
      if (selectedProcess?.id) {
        await updateProcess(selectedProcess.id, {
          name: processName.trim(),
          description: processDescription?.trim() || '',
          scheme,
          is_draft: false,
        })
        Toastify({ text: 'Процесс опубликован', close: true, backgroundColor: '#059669' }).showToast()
      } else {
        await createProcess({
          name: processName.trim(),
          description: processDescription?.trim() || '',
          scheme,
          is_draft: false,
        })
        Toastify({ text: 'Процесс создан и опубликован', close: true, backgroundColor: '#059669' }).showToast()
        resetDesigner()
      }
    } catch (e) {
      console.error(e)
      Toastify({
        text: e.response?.data?.error || 'Не удалось опубликовать',
        close: true,
        backgroundColor: '#b91c1c',
      }).showToast()
    }
  }, [validateScheme, selectedProcess, processName, processDescription, scheme, resetDesigner])

  const handleDeleteProcess = useCallback(async () => {
    if (!selectedProcess?.id) return
    const name = selectedProcess?.name || processName || 'Без названия'
    const ok = window.confirm(`Удалить процесс «${name}»?`)
    if (!ok) return
    try {
      await deleteProcess(selectedProcess.id)
      Toastify({ text: 'Процесс удалён', close: true, backgroundColor: '#059669' }).showToast()
      resetDesigner()
    } catch (e) {
      console.error(e)
      Toastify({
        text: e.response?.data?.error || 'Не удалось удалить процесс',
        close: true,
        backgroundColor: '#b91c1c',
      }).showToast()
    }
  }, [selectedProcess?.id, selectedProcess?.name, processName, resetDesigner])

  return (
    <div className="process-designer">
      <DesignerToolbar
        processName={processName}
        processDescription={processDescription}
        isDraft={isDraft}
        canDelete={!!selectedProcess?.id}
        onProcessNameChange={setProcessName}
        onProcessDescriptionChange={setProcessDescription}
        onIsDraftChange={setIsDraft}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onNewProcess={resetDesigner}
        onDelete={handleDeleteProcess}
      />

      <div className="process-designer__body">
        <aside className="process-designer__palette">
          <Palette />
        </aside>
        <main className="process-designer__canvas">
          <FlowCanvas />
        </main>
        <aside className="process-designer__properties">
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  )
}

export default ProcessDesigner
