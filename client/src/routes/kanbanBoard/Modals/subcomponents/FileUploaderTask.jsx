import { Checkbox, FormControlLabel } from '@mui/material'
import { LuDelete } from 'react-icons/lu'
import styles from '../AddModal.module.scss'

const FileUploaderTask = ({
  checkedComment,
  handlecheckedComment,
  handleFileChange,
  selectedFiles,
  removeFile,
  hasDangerousFiles,
  isLoading,
}) => {
  return (
    <div className={styles.fileUploadContainer}>
      <div className={styles.fileInputWrapper}>
        <FormControlLabel
          control={
            <Checkbox
              checked={checkedComment}
              onChange={handlecheckedComment}
              name="myCheckbox"
              color="primary"
            />
          }
          label="Добавлять комментарии к файлам"
        />
        <input
          type="file"
          name="images"
          multiple
          onChange={handleFileChange}
          className={styles.fileInput}
          id="file-upload"
        />
        <label htmlFor="file-upload" className={styles.fileInputLabel}>
          Добавить файл
        </label>
        <ul className={styles.fileList}>
          {selectedFiles.map(({ name }, index) => (
            <li key={index} className={styles.fileItem}>
              {name}
              <LuDelete
                title="Удалить файл из списка"
                className={styles.removeFile}
                onClick={() => removeFile(name)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
export default FileUploaderTask
