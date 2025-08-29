import { AiFillCloseCircle } from 'react-icons/ai'
import './HelpModal.scss'

const HelpModalMenegerNotificationsCalls = ({ open, onClose, type }) => {
  if (!open) return null

  return (
    <div className="modal-overlay-creat-group">
      <div className="modal-content-creat-group">
        <AiFillCloseCircle
          className="modal-overlay-close-creat-group"
          onClick={onClose}
        />

        {type === 'managerNotifications' && (
          <>
            <strong className="title-creat-group">Менеджер уведомлений.</strong>
            <p>
              Данный компонент отображает уведомления, которые еще не были
              отображены в Менеджере задач и создателем которых является
              пользователь. С помощью данного компонента имеется возможность
              редактировать комментарий, дату и время отображения уведомления.
            </p>

            <strong>Описание элементов</strong>
            <ul>
              <li>
                <strong>Заголовок уведомления</strong> — отображает тему
                уведомления.
              </li>
              <li>
                <strong>Комментарий</strong> — содержит дополнительную
                информацию о звонке.
              </li>
              <li>
                <strong>Дата планирования</strong> — указывает, когда должен
                быть выполнен звонок.
              </li>
              <li>
                <strong>Кнопка Редактировать</strong> — позволяет изменить дату
                и комментарий уведомления.
              </li>
            </ul>

            <strong>Заключение</strong>
            <p>
              Используйте этот интерфейс для управления уведомлениями.
              Убедитесь, что все данные введены корректно перед сохранением.
            </p>
          </>
        )}

        <button onClick={onClose}>Закрыть</button>
      </div>
    </div>
  )
}

export default HelpModalMenegerNotificationsCalls
