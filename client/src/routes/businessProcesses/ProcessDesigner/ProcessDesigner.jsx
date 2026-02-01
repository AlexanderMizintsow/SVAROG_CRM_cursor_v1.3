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

  const validateScheme = useCallback(() => {
    const nodes = Array.isArray(scheme?.nodes) ? scheme.nodes : []
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
