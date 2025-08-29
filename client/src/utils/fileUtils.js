/**
 * Утилиты для работы с файлами на стороне клиента
 */

/**
 * Корректно обрабатывает имя файла для отправки
 * @param {string} filename - исходное имя файла
 * @returns {string} - обработанное имя файла
 */
export function sanitizeFilename(filename) {
  try {
    // Проверяем, что имя файла не пустое
    if (!filename || typeof filename !== 'string') {
      return 'document'
    }

    console.log(`Исходное имя файла на клиенте: ${filename}`)
    console.log(`Тип данных: ${typeof filename}`)
    console.log(`Длина: ${filename.length}`)

    // Убираем недопустимые символы для имен файлов
    const cleanFilename = filename
      .replace(/[<>:"/\\|?*]/g, '_') // Заменяем недопустимые символы
      .replace(/\s+/g, '_') // Заменяем пробелы на подчеркивания
      .trim()

    console.log(`После очистки на клиенте: ${cleanFilename}`)

    // Если после очистки имя пустое, возвращаем дефолтное
    if (!cleanFilename) {
      return 'document'
    }

    // Ограничиваем длину имени файла
    if (cleanFilename.length > 100) {
      const extension = cleanFilename.split('.').pop()
      const nameWithoutExt = cleanFilename.substring(0, cleanFilename.lastIndexOf('.'))
      const truncatedName = nameWithoutExt.substring(0, 90) + '.' + extension
      console.log(`Имя обрезано до: ${truncatedName}`)
      return truncatedName
    }

    console.log(`Финальное имя файла на клиенте: ${cleanFilename}`)
    return cleanFilename
  } catch (error) {
    console.error('Ошибка при обработке имени файла на клиенте:', error)
    return 'document'
  }
}

/**
 * Создает безопасное имя файла для отображения
 * @param {string} originalName - исходное имя файла
 * @returns {string} - безопасное имя файла для отображения
 */
export function createSafeDisplayName(originalName) {
  try {
    if (!originalName || typeof originalName !== 'string') {
      return 'document'
    }

    // Ограничиваем длину для отображения
    if (originalName.length > 30) {
      const extension = originalName.split('.').pop()
      const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'))
      return nameWithoutExt.substring(0, 25) + '...' + extension
    }

    return originalName
  } catch (error) {
    console.error('Ошибка при создании имени для отображения:', error)
    return 'document'
  }
}

/**
 * Проверяет, является ли имя файла безопасным
 * @param {string} filename - имя файла для проверки
 * @returns {boolean} - true, если имя файла безопасно
 */
export function isFilenameSafe(filename) {
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
