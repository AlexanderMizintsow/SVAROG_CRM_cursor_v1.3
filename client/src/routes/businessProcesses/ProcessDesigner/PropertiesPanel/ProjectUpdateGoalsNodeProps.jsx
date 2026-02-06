import { useMemo } from 'react'
import ProjectSourceSelector from './ProjectSourceSelector'
import './PropertiesPanel.scss'

const ProjectUpdateGoalsNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const handleChange = (patch) => onUpdate({ settings: { ...settings, ...(patch || {}) } })

  const goalsText = useMemo(() => {
    const g = Array.isArray(settings.goals) ? settings.goals : []
    return g.join('\n')
  }, [settings.goals])

  return (
    <div className="properties-panel__fields">
      <ProjectSourceSelector settings={settings} onChange={handleChange} />

      <div className="properties-panel__field">
        <label className="properties-panel__label">Цели (каждая строка — цель)</label>
        <textarea
          className="properties-panel__input properties-panel__textarea"
          rows={5}
          value={goalsText}
          onChange={(e) => {
            const lines = String(e.target.value || '')
              .split('\n')
              .map((x) => x.trim())
              .filter(Boolean)
            handleChange({ goals: lines })
          }}
          placeholder={'Например:\nУточнить размеры\nПодготовить отгрузку\nЗакрыть проект'}
        />
      </div>
    </div>
  )
}

export default ProjectUpdateGoalsNodeProps

