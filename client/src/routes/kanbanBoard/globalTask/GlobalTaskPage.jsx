// Компонент содержит в себе остаьные стыковочные компоненты
import { useState } from 'react'
import { FaArrowLeft } from 'react-icons/fa'
import GlobalTaskHeader from './GlobalTaskHeader'
import GlobalTaskProgress from './GlobalTaskProgress'
import GlobalTaskCard from './GlobalTaskCard'
import GlobalTaskTabs from './GlobalTaskTabs'
import GlobalTaskSubtasks from './GlobalTaskSubtasks'
import GlobalTaskHistory from './subcomponents/tabs/globalTaskHistory/GlobalTaskHistory'
import GlobalTaskDocuments from './subcomponents/tabs/GlobalTaskDocuments/GlobalTaskDocuments'
import './styles/GlobalTaskPage.scss'

const GlobalTaskPage = ({
  initialTask,
  tasks,
  onBack,
  onRefresh,
  refreshSubTask,
  refreshHistory,
}) => {
  const [attachments, setAttachments] = useState([])
  const [activeTab, setActiveTab] = useState('subtasks')

  // 2. Определение переменных, основанных на пропсах
  const initialTaskIndex =
    tasks && initialTask
      ? tasks.findIndex((task) => task.id === initialTask.id)
      : -1

  // 3. Инициализация состояний useState
  const [currentTaskIndex, setCurrentTaskIndex] = useState(
    tasks && tasks.length > 0 && initialTaskIndex !== -1 ? initialTaskIndex : 0
  )

  // Получаем текущую задачу после определения currentTaskIndex
  const currentTask =
    tasks &&
    tasks.length > 0 &&
    currentTaskIndex >= 0 &&
    currentTaskIndex < tasks.length
      ? tasks[currentTaskIndex]
      : null

  // 4. Добавление условного рендеринга (ранний возврат) - ЭТОТ БЛОК ОСТАЕТСЯ ЗДЕСЬ
  if (!currentTask) {
    console.error('GlobalTaskPage: Задача не найдена или список задач пуст.')
    return (
      <div className="global-task-page">
        <div className="global-task-page__container">
          {onBack && (
            <button onClick={onBack} className="global-task-page__back-button">
              <FaArrowLeft className="global-task-page__back-icon" /> Назад к
              списку
            </button>
          )}
          <p>Задача не найдена.</p>
        </div>
      </div>
    )
  }

  // 6. Определение обработчиков событий и других функций
  const goToPreviousTask = () => {
    if (currentTaskIndex > 0) {
      setCurrentTaskIndex(currentTaskIndex - 1)
    }
  }

  const goToNextTask = () => {
    if (tasks && currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1)
    }
  }

  // Обработчик смены таба
  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
  }

  // 7. Возврат JSX
  return (
    <div className="global-task-page">
      <div className="global-task-page__container">
        {onBack && (
          <button onClick={onBack} className="global-task-page__back-button">
            <FaArrowLeft className="global-task-page__back-icon" /> Назад к
            списку
          </button>
        )}

        <GlobalTaskHeader
          taskId={currentTask.id}
          status={currentTask.status}
          title={currentTask.title}
          createdAt={currentTask.created_at}
          author={currentTask.created_by}
        />
        <GlobalTaskProgress
          taskId={currentTask.id}
          status={currentTask.status}
          completionPercentage={currentTask.completion_percentage}
          dueDate={currentTask.dueDate}
          onRefresh={onRefresh}
        />
        <GlobalTaskCard
          key={currentTask.id}
          task={currentTask}
          onPrevious={goToPreviousTask}
          onNext={goToNextTask}
          hasPrevious={currentTaskIndex > 0}
          hasNext={tasks && currentTaskIndex < tasks.length - 1}
          setAttachments={setAttachments}
          onRefresh={onRefresh}
        />

        {/* Используем GlobalTaskTabs и передаем ему состояние и колбэк */}
        <GlobalTaskTabs activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="global-task-tabs__content mt-4">
          {/* Используем класс из GlobalTaskTabs.scss для стилей контейнера содержимого */}
          {activeTab === 'subtasks' && (
            <GlobalTaskSubtasks
              subtasks={currentTask.subtasks}
              taskId={currentTask.id}
              refreshSubTask={refreshSubTask}
            />
          )}
          {activeTab === 'history' && (
            <GlobalTaskHistory
              taskId={currentTask.id}
              refreshHistory={refreshHistory}
            />
          )}
          {activeTab === 'documents' && (
            <GlobalTaskDocuments
              taskId={currentTask.id}
              setAttachments={setAttachments}
              attachments={attachments}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default GlobalTaskPage
