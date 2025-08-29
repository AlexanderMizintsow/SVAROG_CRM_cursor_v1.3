import { useEffect, useState } from 'react'
import { MdMoveDown } from 'react-icons/md'
import TaskNotification from '../../../Task/TaskNotification'
import './dealerGroup.scss'

const DealerGroup = ({
  dealerName,
  tasks,
  handleCompleteTask,
  handleActionMoveTask,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [lastSeenCount, setLastSeenCount] = useState(0)

  // Проверяем localStorage при загрузке компонента
  useEffect(() => {
    const storedCount = localStorage.getItem(
      `dealerGroup-${dealerName}-lastSeenCount`
    )
    if (storedCount) {
      setLastSeenCount(Number(storedCount))
    }
  }, [dealerName])

  // Проверяем, есть ли новые уведомления при изменении списка задач
  const hasNewNotification = () => {
    return tasks.length > lastSeenCount // Если количество задач увеличилось, показываем "NEW"
  }

  // Обновляем lastSeenCount, если количество задач уменьшилось
  useEffect(() => {
    if (tasks.length < lastSeenCount || tasks.length === 0) {
      setLastSeenCount(tasks.length)
      localStorage.setItem(
        `dealerGroup-${dealerName}-lastSeenCount`,
        tasks.length
      )
    }
  }, [tasks.length, lastSeenCount, dealerName])

  const handleToggleGroup = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      const currentCount = tasks.length
      setLastSeenCount(currentCount) // Обновляем количество задач при открытии
      localStorage.setItem(
        `dealerGroup-${dealerName}-lastSeenCount`,
        currentCount
      ) // Сохраняем количество в localStorage
    }
  }

  const handleTaskCompletion = async (taskId) => {
    await handleCompleteTask(taskId) // Завершаем задачу

    // Проверяем, остались ли уведомления
    const updatedTasks = tasks.filter((task) => task.id !== taskId)
    if (updatedTasks.length === 0) {
      setLastSeenCount(0) // Обновляем lastSeenCount, если задач больше нет
      localStorage.setItem(`dealerGroup-${dealerName}-lastSeenCount`, '0') // Сохраняем в localStorage
    }
  }

  // Если задач нет, не отображаем группу
  if (tasks.length === 0) {
    return null // Возвращаем null, если нет задач
  }

  return (
    <div className="dealer-group">
      <div className="dealer-group-header" onClick={handleToggleGroup}>
        <span className="dealer-group-title">
          {dealerName} ({tasks.length}){' '}
          {hasNewNotification() && <span className="new-badge">Новое</span>}
        </span>
        <span>{isOpen ? '▼' : '▲'}</span>
      </div>
      {isOpen && (
        <div className="dealer-group-content">
          {tasks.map((task) => (
            <TaskNotification
              key={task.id.toString()}
              task={task}
              onComplete={handleTaskCompletion} // Передаем новую функцию завершения задачи
              isNotificationColumn={true}
              actionIcon={
                <MdMoveDown
                  className="board-move-task"
                  onClick={() => handleActionMoveTask(task.id)}
                  title="Переназначить уведомление"
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default DealerGroup
