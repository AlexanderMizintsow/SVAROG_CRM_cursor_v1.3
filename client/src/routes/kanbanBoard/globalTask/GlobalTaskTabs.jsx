// Отображает табы для переключения
import React from 'react'
import { FaTasks, FaHistory, FaFileAlt } from 'react-icons/fa'
import './styles/GlobalTaskTabs.scss'

const GlobalTaskTabs = ({ activeTab, onTabChange, documentsCount = 0 }) => {
  const tabs = [
    { id: 'subtasks', label: 'Подзадачи', icon: <FaTasks /> },
    { id: 'documents', label: 'Документы', icon: <FaFileAlt /> },
    { id: 'history', label: 'История изменений', icon: <FaHistory /> },
  ]

  return (
    <div className="global-task-tabs">
      <div className="global-task-tabs__list">
        {tabs.map((tab) => {
          const showDocBadge = tab.id === 'documents' && documentsCount > 0
          const labelExtra =
            tab.id === 'documents' && documentsCount > 0
              ? `, вложений: ${documentsCount}`
              : ''

          return (
            <span key={tab.id} className="global-task-tabs__item">
              <button
                type="button"
                className={`global-task-tabs__button ${
                  activeTab === tab.id ? 'global-task-tabs__button--active' : ''
                }`}
                onClick={() => onTabChange(tab.id)}
                aria-label={showDocBadge ? `${tab.label}${labelExtra}` : undefined}
              >
                {tab.icon &&
                  React.cloneElement(tab.icon, {
                    className: 'global-task-tabs__icon',
                  })}
                {tab.label}
              </button>
              {showDocBadge && (
                <span className="global-task-tabs__doc-badge" aria-hidden="true">
                  {documentsCount > 99 ? '99+' : documentsCount}
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default GlobalTaskTabs
