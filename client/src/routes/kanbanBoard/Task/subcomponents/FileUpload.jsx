import { FaFile } from 'react-icons/fa'
import { GoX } from 'react-icons/go'
import { PiSealQuestion } from 'react-icons/pi'
import { sanitizeFilename, createSafeDisplayName } from '../../../../utils/fileUtils'
import '../Task.scss'

const FileUpload = ({ taskId, files, text, setFiles, setText, isUploading, handleSendFiles }) => {
  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files)

    // Обрабатываем имена файлов для корректной работы с русскими символами
    const processedFiles = selectedFiles.map((file) => {
      // Создаем новый File объект с безопасным именем
      const safeName = sanitizeFilename(file.name)
      console.log(`Обработка файла: ${file.name} -> ${safeName}`)

      // Дополнительная проверка - если имя файла содержит неподдерживаемые символы
      if (!/^[a-zA-Z0-9а-яёА-ЯЁ_\-\s.]+$/u.test(safeName)) {
        console.log('Имя файла содержит неподдерживаемые символы, заменяем на безопасное')
        const extension = safeName.split('.').pop()
        const timestamp = Date.now()
        const newSafeName = `document_${timestamp}.${extension}`
        console.log(`Новое безопасное имя: ${newSafeName}`)

        return new File([file], newSafeName, {
          type: file.type,
          lastModified: file.lastModified,
        })
      }

      // Если имя файла изменилось, создаем новый File объект
      if (safeName !== file.name) {
        return new File([file], safeName, {
          type: file.type,
          lastModified: file.lastModified,
        })
      }

      return file
    })

    setFiles((prevFiles) => [...prevFiles, ...processedFiles])
  }

  const handleDeleteFile = (fileName) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.name !== fileName))
  }

  const shortenFileName = (fileName) => {
    // Используем утилиту для создания безопасного имени для отображения
    return createSafeDisplayName(fileName)
  }

  const handleSendAndReset = async () => {
    await handleSendFiles(text, files) // Отправляем текст и файлы
    setText('') // Сбрасываем текстовое сообщение после отправки
    setFiles([]) // Сбрасываем файлы после успешной отправки
  }
  return (
    <div className="file-upload">
      <input
        type="file"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id={`file-upload-${taskId}`}
      />
      <label
        htmlFor={`file-upload-${taskId}`}
        className={`file-send-button ${isUploading ? 'disabled' : ''}`}
        style={{ background: '#498f1a' }}
      >
        Добавить файл
      </label>

      <textarea
        className="file-upload-textarea-styled"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Введите текст сообщения..."
        rows={2}
        disabled={isUploading}
      />

      {files.length > 0 && (
        <div className="uploaded-files">
          {files.map((file) => (
            <div key={file.name} className="uploaded-file">
              <div className="file-info">
                <FaFile className="file-icon" />
                <span className="file-name">{shortenFileName(file.name)}</span>
                <span className="file-size">
                  {file.size > 30 * 1024 * 1024 ? (
                    <span style={{ color: '#FF0000', fontSize: '14px' }}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  ) : (
                    `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                  )}
                </span>
              </div>
              {!isUploading && (
                <GoX className="remove-file-button" onClick={() => handleDeleteFile(file.name)} />
              )}
            </div>
          ))}
        </div>
      )}
      <p className="file-upload-title-help">
        Текст и файлы ОТПРАВЛЯЮТСЯ ДИЛЕРУ создавшего уведомление
        <PiSealQuestion
          className="icon-question"
          title="Отправляемые сообщения носят односторонний характер и дилер не имеет возможность на них ответить."
        />
      </p>
      {(files.length > 0 || text.trim() !== '') && (
        <button
          className={`send-button-task ${isUploading ? 'disabled' : ''}`}
          onClick={handleSendAndReset}
          disabled={isUploading}
        >
          {isUploading ? 'Отправка...' : 'Отправить'}
        </button>
      )}
    </div>
  )
}

export default FileUpload
