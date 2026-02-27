import { useCallback, useState } from 'react'
import Toastify from 'toastify-js'
import useBusinessProcessStore from '../../../store/useBusinessProcessStore.js'
import useUserStore from '../../../store/userStore'
import { createProcess, updateProcess, deleteProcess } from '../../../api/businessProcessApi.js'
import Palette from './Palette/Palette.jsx'
import FlowCanvas from './Canvas/FlowCanvas.jsx'
import PropertiesPanel from './PropertiesPanel/PropertiesPanel.jsx'
import DesignerToolbar from './DesignerToolbar.jsx'
import ProcessDesignerVisibility from './ProcessDesignerVisibility/ProcessDesignerVisibility.jsx'
import ConfirmationDialog from '../../../components/confirmationDialog/ConfirmationDialog'
import './ProcessDesigner.scss'

const ProcessDesigner = () => {
  const { user } = useUserStore()
  const {
    scheme,
    selectedProcess,
    processName,
    processDescription,
    isDraft,
    visibilityUserIds,
    setProcessName,
    setProcessDescription,
    setIsDraft,
    setScheme,
    resetDesigner,
  } = useBusinessProcessStore()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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
          const allowed = ['create_task', 'assign_task', 'create_project', 'decision']
          const hasAllowed = incomingFrom.some((t) => allowed.includes(t))
          if (!hasAllowed) {
            const label = node.label || node.type || node.id
            return `Блок «Развилка-Слияние» («${label}»): подключите хотя бы один входящий блок «Создать задачу», «Назначить задачу», «Создать проект» или «Принятие решения».`
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

        if (node.type === 'create_project') {
          if (!(s.title || '').trim()) {
            return `Блок «Создать проект» («${label}»): заполните «Название проекта».`
          }
        }

        if (node.type === 'project_update_status') {
          if (!(s.status || '').trim()) {
            return `Блок «Проект: статус» («${label}»): укажите новый статус проекта.`
          }
        }

        if (node.type === 'project_add_comment') {
          if (!(s.comment || '').trim()) {
            return `Блок «Проект: комментарий» («${label}»): заполните комментарий.`
          }
        }

        if (node.type === 'project_post_chat') {
          if (!(s.text || '').trim()) {
            return `Блок «Проект: чат» («${label}»): заполните текст сообщения.`
          }
        }

        if (node.type === 'project_add_responsibles') {
          const rs = Array.isArray(s.responsibles) ? s.responsibles : []
          if (rs.length === 0) {
            return `Блок «Проект: ответственные» («${label}»): добавьте хотя бы одного ответственного.`
          }
          const bad = rs.some((r) => !r || !r.id)
          if (bad) {
            return `Блок «Проект: ответственные» («${label}»): у всех ответственных должен быть выбран пользователь.`
          }
        }

        if (node.type === 'project_update_goals') {
          const g = Array.isArray(s.goals) ? s.goals : []
          if (g.length === 0) {
            return `Блок «Проект: цели» («${label}»): добавьте хотя бы одну цель.`
          }
        }

        if (node.type === 'project_update_additional_info') {
          const rows = Array.isArray(s.additionalInfo) ? s.additionalInfo : []
          if (rows.length === 0) {
            return `Блок «Проект: доп. инфо» («${label}»): добавьте хотя бы одно поле key → value.`
          }
        }

        if (node.type === 'project_add_attachment') {
          if (!(s.file_url || '').trim() || !(s.file_type || '').trim() || !(s.name_file || '').trim()) {
            return `Блок «Проект: вложение» («${label}»): заполните file_url, file_type и name_file.`
          }
        }

        if (node.type === 'project_update_task_status') {
          if (!(s.status || '').trim()) {
            return `Блок «Подзадача: статус» («${label}»): укажите новый статус задачи.`
          }
        }

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

        if (node.type === 'create_task' && s.linkToProject === true && (s.createMode || 'prepared') === 'modal_at_runtime') {
          return `Блок «Создать задачу» («${label}»): подзадачи проекта пока поддерживаются только в режиме «Создать сразу».`
        }
        if (node.type === 'create_task' && s.linkToParentTask === true && (s.createMode || 'prepared') === 'modal_at_runtime') {
          return `Блок «Создать задачу» («${label}»): подзадача задачи из схемы пока поддерживается только в режиме «Создать сразу».`
        }
        if (node.type === 'create_task' && s.linkToParentTask === true && (s.parentTaskSource || 'last') === 'by_node' && !s.parentTaskNodeId) {
          return `Блок «Создать задачу» («${label}»): выберите блок «Создать задачу» — родительскую задачу.`
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
          visibility_user_ids: Array.isArray(visibilityUserIds) ? visibilityUserIds : [],
        })
        Toastify({ text: 'Черновик сохранён', close: true, backgroundColor: '#059669' }).showToast()
      } else {
        await createProcess({
          name: processName.trim(),
          description: processDescription?.trim() || '',
          scheme,
          is_draft: true,
          visibility_user_ids: Array.isArray(visibilityUserIds) ? visibilityUserIds : [],
          created_by: user?.id ?? null,
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
          visibility_user_ids: Array.isArray(visibilityUserIds) ? visibilityUserIds : [],
        })
        Toastify({ text: 'Процесс опубликован', close: true, backgroundColor: '#059669' }).showToast()
      } else {
        await createProcess({
          name: processName.trim(),
          description: processDescription?.trim() || '',
          scheme,
          is_draft: false,
          visibility_user_ids: Array.isArray(visibilityUserIds) ? visibilityUserIds : [],
          created_by: user?.id ?? null,
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
  }, [validateScheme, selectedProcess, processName, processDescription, scheme, visibilityUserIds, resetDesigner])

  const handleDeleteProcessClick = useCallback(() => {
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteProcessConfirm = useCallback(async () => {
    if (!selectedProcess?.id) return
    setDeleteDialogOpen(false)
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
  }, [selectedProcess?.id, resetDesigner])

  const deleteConfirmName = selectedProcess?.name || processName || 'Без названия'

  return (
    <div className="process-designer">
      {deleteDialogOpen && (
        <ConfirmationDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleDeleteProcessConfirm}
          title="Подтверждение удаления"
          message={`Действительно удалить процесс «${deleteConfirmName}»?`}
          btn1="Нет"
          btn2="Да"
        />
      )}

      <div className="process-designer__visibility-wrap">
        <ProcessDesignerVisibility />
      </div>
      <DesignerToolbar
        processName={processName}
        processDescription={processDescription}
        isDraft={isDraft}
        gatewayDebugNotify={scheme?.meta?.gatewayDebugNotify === true}
        canDelete={!!selectedProcess?.id && (user?.role_name === 'Администратор' || Number(selectedProcess?.created_by) === Number(user?.id))}
        onProcessNameChange={setProcessName}
        onProcessDescriptionChange={setProcessDescription}
        onIsDraftChange={setIsDraft}
        onGatewayDebugNotifyChange={(checked) => {
          const meta = scheme?.meta && typeof scheme.meta === 'object' ? scheme.meta : {}
          setScheme({ ...(scheme || { nodes: [], edges: [] }), meta: { ...meta, gatewayDebugNotify: !!checked } })
        }}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onNewProcess={resetDesigner}
        onDelete={handleDeleteProcessClick}
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
