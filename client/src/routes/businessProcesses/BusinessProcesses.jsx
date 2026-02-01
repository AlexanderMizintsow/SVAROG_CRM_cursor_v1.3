import { useState } from 'react'
import { FcFlowChart } from 'react-icons/fc'
import { AiOutlineUnorderedList, AiOutlineForm, AiOutlineBars } from 'react-icons/ai'
import ProcessList from './ProcessList/ProcessList'
import ProcessDesigner from './ProcessDesigner/ProcessDesigner'
import ProcessInstances from './ProcessInstances/ProcessInstances'
import useBusinessProcessStore from '../../store/useBusinessProcessStore'
import './businessProcesses.scss'

const TABS = [
  { id: 'list', label: 'Готовые процессы', icon: AiOutlineUnorderedList },
  { id: 'designer', label: 'Конструктор', icon: AiOutlineForm },
  { id: 'instances', label: 'Экземпляры', icon: AiOutlineBars },
]

const BusinessProcesses = () => {
  const [activeTab, setActiveTab] = useState('list')
  const { loadProcessIntoDesigner, resetDesigner } = useBusinessProcessStore()

  const handleEditProcess = (process) => {
    loadProcessIntoDesigner(process)
    setActiveTab('designer')
  }

  const handleCreateNew = () => {
    resetDesigner()
    setActiveTab('designer')
  }

  return (
    <div className="business-processes">
      <header className="business-processes__header">
        <div className="business-processes__title-row">
          <FcFlowChart className="business-processes__icon" />
          <h1 className="business-processes__title">Бизнес-процессы</h1>
        </div>
        <nav className="business-processes__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`business-processes__tab ${activeTab === tab.id ? 'business-processes__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="business-processes__tab-icon" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <div className="business-processes__content">
        {activeTab === 'list' && (
          <ProcessList
            onEditProcess={handleEditProcess}
            onCreateNew={handleCreateNew}
          />
        )}
        {activeTab === 'designer' && <ProcessDesigner />}
        {activeTab === 'instances' && <ProcessInstances />}
      </div>
    </div>
  )
}

export default BusinessProcesses
