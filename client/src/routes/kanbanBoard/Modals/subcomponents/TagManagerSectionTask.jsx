// блок управления тегами

import { CiBookmarkPlus } from 'react-icons/ci'
import { LuDelete } from 'react-icons/lu'
import styles from '../AddModal.module.scss'

const TagManagerSectionTask = ({
  taskData,
  selectedTag,
  setSelectedTag,
  handleOpenDropdown,
  handleAddTag,
  handleRemoveTag,
  availableTags,
  handleOpenTagsManager,
}) => {
  return (
    <div className={styles.border}>
      <span
        onClick={handleOpenTagsManager}
        className={styles.icon_tag_add}
        title="Редактор тэгов"
      >
        <CiBookmarkPlus />
      </span>
      <p className={styles.titleInput}> Добавить тег</p>

      <div className={styles.inputSection}>
        <div>
          <select
            value={selectedTag}
            onFocus={handleOpenDropdown}
            onChange={(e) => {
              const value = e.target.value
              if (value) {
                handleAddTag(value)
              } else {
                setSelectedTag('')
              }
            }}
            required
          >
            <option value="">Выберите тег</option>
            {availableTags.map((tag, index) => (
              <option key={index} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          {taskData.tags && (
            <div className={styles.addPerson}>
              Теги:{' '}
              {JSON.parse(taskData.tags).map((tag, index) => (
                <div
                  key={index}
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  {tag.title}
                  <LuDelete
                    style={{ marginLeft: 'auto' }}
                    className={styles.removeFile}
                    onClick={() => handleRemoveTag(index)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TagManagerSectionTask
