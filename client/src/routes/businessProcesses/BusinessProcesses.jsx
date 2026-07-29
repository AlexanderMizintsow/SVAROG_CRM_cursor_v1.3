import { useState } from 'react'
import { FcFlowChart } from 'react-icons/fc'
import { AiOutlineUnorderedList, AiOutlineForm, AiOutlineBars, AiOutlineFileDone } from 'react-icons/ai'
import { MdHelpOutline } from 'react-icons/md'
import ProcessList from './ProcessList/ProcessList'
import ProcessDesigner from './ProcessDesigner/ProcessDesigner'
import ProcessInstances from './ProcessInstances/ProcessInstances'
import HelpModalBusinessProcesses from './HelpModalBusinessProcesses'
import useBusinessProcessStore from '../../store/useBusinessProcessStore'
import './businessProcesses.scss'
import './businessProcessesDark.scss'

const TABS = [
  { id: 'list', label: 'Готовые процессы', icon: AiOutlineUnorderedList },
  { id: 'designer', label: 'Конструктор', icon: AiOutlineForm },
  { id: 'instances', label: 'Экземпляры', icon: AiOutlineBars },
]

const LIST_SUB_TABS = [
  { id: 'published', label: 'Опубликованные', icon: AiOutlineUnorderedList },
  { id: 'drafts', label: 'Черновики', icon: AiOutlineFileDone },
]

const BusinessProcesses = () => {
  const [activeTab, setActiveTab] = useState('list')
  const [listSubTab, setListSubTab] = useState('published')
  const [isHelpOpen, setHelpOpen] = useState(false)
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
          <button
            type="button"
            className="business-processes__help-btn"
            onClick={() => setHelpOpen(true)}
            title="Справка по разделу"
          >
            <MdHelpOutline /> Справка
          </button>
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
          <>
            <nav className="business-processes__sub-tabs">
              {LIST_SUB_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`business-processes__sub-tab ${listSubTab === tab.id ? 'business-processes__sub-tab--active' : ''}`}
                  onClick={() => setListSubTab(tab.id)}
                >
                  <tab.icon className="business-processes__sub-tab-icon" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
            <ProcessList
              showDrafts={listSubTab === 'drafts'}
              onEditProcess={handleEditProcess}
              onCreateNew={handleCreateNew}
            />
          </>
        )}
        {activeTab === 'designer' && <ProcessDesigner />}
        {activeTab === 'instances' && <ProcessInstances />}
      </div>

      <HelpModalBusinessProcesses open={isHelpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

export default BusinessProcesses
