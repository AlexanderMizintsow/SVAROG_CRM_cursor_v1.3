// Отображает табы для переключения
import React from 'react'
import { FaTasks, FaHistory, FaFileAlt } from 'react-icons/fa'
import './styles/GlobalTaskTabs.scss'

const GlobalTaskTabs = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'subtasks', label: 'Подзадачи', icon: <FaTasks /> },
    { id: 'documents', label: 'Документы', icon: <FaFileAlt /> },
    { id: 'history', label: 'История изменений', icon: <FaHistory /> },
  ]

  return (
    <div className="global-task-tabs">
      <div className="global-task-tabs__list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`global-task-tabs__button ${
              activeTab === tab.id ? 'global-task-tabs__button--active' : ''
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon &&
              React.cloneElement(tab.icon, {
                className: 'global-task-tabs__icon',
              })}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default GlobalTaskTabs
