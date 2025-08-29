/**
 * Утилиты для работы с файлами в Telegram боте
 */

/**
 * Корректно обрабатывает имя файла для отправки в Telegram
 * @param {string} filename - исходное имя файла
 * @returns {string} - обработанное имя файла
 */
function sanitizeFilename(filename) {
  try {
    // Проверяем, что имя файла не пустое
    if (!filename || typeof filename !== 'string') {
      return 'document'
    }

    console.log(`Исходное имя файла: ${filename}`)
    console.log(`Тип данных: ${typeof filename}`)
    console.log(`Длина: ${filename.length}`)
    console.log(`Байты:`, Buffer.from(filename).toString('hex'))

    // Пробуем разные способы декодирования
    let decodedFilename = filename

    // Если имя файла содержит URL-кодированные символы
    if (filename.includes('%')) {
      try {
        decodedFilename = decodeURIComponent(filename)
        console.log(`После decodeURIComponent: ${decodedFilename}`)
      } catch (e) {
        console.log('decodeURIComponent не сработал, используем исходное имя')
      }
    }

    // Если имя файла содержит escape-последовательности
    if (decodedFilename.includes('\\u') || decodedFilename.includes('\\x')) {
      try {
        decodedFilename = JSON.parse(`"${decodedFilename}"`)
        console.log(`После JSON.parse: ${decodedFilename}`)
      } catch (e) {
        console.log('JSON.parse не сработал, используем предыдущее имя')
      }
    }

    // Дополнительная проверка на неправильную кодировку
    // Если имя файла содержит символы, которые не являются валидными для имен файлов
    if (/[^\x00-\x7Fа-яёА-ЯЁ\s\-_.]/.test(decodedFilename)) {
      console.log('Обнаружены невалидные символы, пытаемся исправить кодировку')

      // Пробуем разные кодировки
      try {
        const buffer = Buffer.from(decodedFilename, 'latin1')
        const utf8Name = buffer.toString('utf8')
        if (utf8Name !== decodedFilename) {
          decodedFilename = utf8Name
          console.log(`После конвертации из latin1 в utf8: ${decodedFilename}`)
        }
      } catch (e) {
        console.log('Конвертация из latin1 не удалась')
      }

      try {
        const buffer = Buffer.from(decodedFilename, 'cp1251')
        const utf8Name = buffer.toString('utf8')
        if (utf8Name !== decodedFilename) {
          decodedFilename = utf8Name
          console.log(`После конвертации из cp1251 в utf8: ${decodedFilename}`)
        }
      } catch (e) {
        console.log('Конвертация из cp1251 не удалась')
      }
    }

    // Убираем недопустимые символы для имен файлов
    const cleanFilename = decodedFilename
      .replace(/[<>:"/\\|?*]/g, '_') // Заменяем недопустимые символы
      .replace(/\s+/g, '_') // Заменяем пробелы на подчеркивания
      .trim()

    console.log(`После очистки: ${cleanFilename}`)

    // Если после очистки имя пустое, возвращаем дефолтное
    if (!cleanFilename) {
      return 'document'
    }

    // Ограничиваем длину имени файла (Telegram имеет ограничения)
    if (cleanFilename.length > 100) {
      const extension = cleanFilename.split('.').pop()
      const nameWithoutExt = cleanFilename.substring(0, cleanFilename.lastIndexOf('.'))
      const truncatedName = nameWithoutExt.substring(0, 90) + '.' + extension
      console.log(`Имя обрезано до: ${truncatedName}`)
      return truncatedName
    }

    console.log(`Финальное имя файла: ${cleanFilename}`)
    return cleanFilename
  } catch (error) {
    console.error('Ошибка при обработке имени файла:', error)
    return 'document'
  }
}

/**
 * Создает безопасное имя файла для временного хранения
 * @param {string} originalName - исходное имя файла
 * @param {string} prefix - префикс для временного файла
 * @returns {string} - безопасное имя файла
 */
function createSafeTempFilename(originalName, prefix = 'temp') {
  try {
    const timestamp = Date.now()
    const extension = originalName ? originalName.split('.').pop() : ''
    const safeName = sanitizeFilename(originalName || 'file')

    return `${prefix}_${timestamp}_${safeName}`
  } catch (error) {
    console.error('Ошибка при создании временного имени файла:', error)
    return `temp_${Date.now()}_document`
  }
}

/**
 * Проверяет, является ли имя файла безопасным для отправки
 * @param {string} filename - имя файла для проверки
 * @returns {boolean} - true, если имя файла безопасно
 */
function isFilenameSafe(filename) {
  try {
    if (!filename || typeof filename !== 'string') {
      return false
    }

    // Проверяем на наличие недопустимых символов
    const invalidChars = /[<>:"/\\|?*]/
    if (invalidChars.test(filename)) {
      return false
    }

    // Проверяем длину
    if (filename.length > 100) {
      return false
    }

    // Проверяем, что имя не пустое после очистки
    const cleanName = filename.trim()
    if (!cleanName) {
      return false
    }

    return true
  } catch (error) {
    console.error('Ошибка при проверке безопасности имени файла:', error)
    return false
  }
}

module.exports = {
  sanitizeFilename,
  createSafeTempFilename,
  isFilenameSafe,
}
