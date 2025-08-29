import { useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import UserStore from '../../../../store/userStore'
import './GoalsEditor.scss'

// Компонент редактора целей
const GoalsEditor = ({ currentGoals, globalTaskId, onClose, onRefresh }) => {
  const { user } = UserStore()
  const [goals, setGoals] = useState(currentGoals || [])
  const [newGoal, setNewGoal] = useState('')
  const userId = user ? user.id : null

  // Функция для определения отличий
  const getDifferences = (oldGoals, newGoals) => {
    const oldSet = new Set(oldGoals)
    const newSet = new Set(newGoals)

    const addedGoals = [...newSet].filter((g) => !oldSet.has(g))
    const removedGoals = [...oldSet].filter((g) => !newSet.has(g))

    return { addedGoals, removedGoals }
  }

  // Обертка для вставки записи истории
  const logHistoryChange = async (addedGoals = [], removedGoals = []) => {
    // Формируем описание
    let description = ''
    if (addedGoals.length > 0) {
      description += `Добавлены новые цели: ${addedGoals.join(', ')}. `
    }
    if (removedGoals.length > 0) {
      description += `Удалены цели: ${removedGoals.join(', ')}.`
    }

    // Вызов функции для записи истории
    await axios.post(
      `${API_BASE_URL}5000/api/global-task/${globalTaskId}/history`,
      {
        eventType: 'обновление',
        description,
        createdBy: userId,
        data: null,
      }
    )
  }

  // Добавление новой цели
  const handleAddGoal = () => {
    if (newGoal.trim() !== '') {
      setGoals([...goals, newGoal.trim()])
      setNewGoal('')
    }
  }

  // Удаление цели по индексу
  const handleRemoveGoal = (index) => {
    setGoals(goals.filter((_, i) => i !== index))
  }

  // Сохранение целей в базу данных
  const handleSave = async () => {
    try {
      // Определяем изменения
      const { addedGoals, removedGoals } = getDifferences(currentGoals, goals)

      // Логируем изменения, если есть
      if (addedGoals.length > 0 || removedGoals.length > 0) {
        await logHistoryChange(addedGoals, removedGoals)
      }

      await axios.put(
        `${API_BASE_URL}5000/api/tasks/${globalTaskId}/update-goals`,
        {
          goals: goals,
          userId,
        }
      )

      if (onClose) {
        onClose()
      }
      if (onRefresh) {
        onRefresh(globalTaskId)
      }
    } catch (err) {
      console.error('Ошибка при сохранении целей:', err)
      alert('Не удалось сохранить цели. Попробуйте снова.')
    }
  }

  return (
    <div className="global-task-additional__modal-overlay">
      <div className="goals-additional-info__modal">
        <h3 className="goals-additional-info__header">Редактор целей</h3>

        {/* Список целей */}
        <ul className="goals-additional-info__list">
          {goals.filter((goal) => goal.trim() !== '').length > 0 ? (
            goals.map(
              (goal, index) =>
                goal.trim() !== '' && (
                  <li key={index}>
                    <span>{goal}</span>
                    <button onClick={() => handleRemoveGoal(index)}>
                      Удалить
                    </button>
                  </li>
                )
            )
          ) : (
            <li>Цели отсутствуют</li>
          )}
        </ul>

        {/* Ввод новой цели */}
        <input
          className="goals-additional-info__input"
          type="text"
          placeholder="Новая цель"
          value={newGoal}
          onChange={(e) => setNewGoal(e.target.value)}
        />

        {/* Кнопки */}
        <div className="goals-additional-info__buttons">
          <button
            className="goals-additional-info__button goals-additional-info__save-btn"
            onClick={handleAddGoal}
          >
            Добавить цель
          </button>
          <button
            className="goals-additional-info__button goals-additional-info__save-btn"
            onClick={handleSave}
          >
            Сохранить
          </button>
          <button
            className="goals-additional-info__button goals-additional-info__cancel-btn"
            onClick={onClose}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export default GoalsEditor
