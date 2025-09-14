// api.js
const axios = require('axios')
const cron = require('node-cron')
const net = require('net')
const iconv = require('iconv-lite')
const fs = require('fs').promises
const path = require('path')
const { createReadStream } = require('fs')
const formatDateForSQL = require('../helpers/dateUtils')
const dbPool = require('../database/db')
const { API_BASE_URL } = require('../config')
const { promisify } = require('util')
const { handleCancel } = require('../helpers/buttonCancel')
const setTimeoutPromise = promisify(setTimeout)

// Общая функция для выполнения задачи с таймаутом
async function runWithTimeout(fn, timeoutMs, taskName) {
  let timeout
  let isCompleted = false

  try {
    const taskPromise = fn()
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        if (!isCompleted) {
          isCompleted = true
          reject(new Error(`Таймаут выполнения задачи ${taskName} (${timeoutMs}ms)`))
        }
      }, timeoutMs)
    })

    const result = await Promise.race([taskPromise, timeoutPromise])
    isCompleted = true
    return result
  } catch (error) {
    isCompleted = true
    throw error
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}
//*************************************************************************************************************************************** */

// ЕГРЮЛ API
async function getCompanyDataEGRUL(query) {
  const token = '88f05639d8dd70ee2bdb8d890d1fbd52964c5840'
  const url = 'http://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party'

  const options = {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Token ' + token,
    },
    data: { query: query },
  }

  try {
    const response = await axios.post(url, options.data, {
      headers: options.headers,
    })

    if (response.data.suggestions && response.data.suggestions.length > 0) {
      const data = response.data.suggestions[0].data
      // Формируем объект с данными компании
      const companyInfo = {
        legalAddress: data.address.value || 'Не указано',
        fullAddress: data.address.unrestricted_value || 'Не указано',
        inn: data.inn || 'Не указано',
        kpp: data.kpp || 'Не указано',
        ogrn: data.ogrn || 'Не указано',
        shortName: data.name.short_with_opf || 'Не указано',
        registrationDate: new Date(data.state.registration_date).toLocaleDateString(),

        /*
        fullName: data.name.full_with_opf || 'Не указано', 
        ogrnDate: data.ogrn_date
          ? new Date(data.ogrn_date).toLocaleDateString()
          : 'Не указано',
        hid: data.hid || 'Не указано',
        type: data.type || 'Не указано',
        fio:
          data.type === 'INDIVIDUAL'
            ? `${data.fio.surname} ${data.fio.name} ${data.fio.patronymic}`
            : 'Не применимо',
        okato: data.okato || 'Не указано',
        oktmo: data.oktmo || 'Не указано',
        okpo: data.okpo || 'Не указано',
        okogu: data.okogu || 'Не указано',
        okfs: data.okfs || 'Не указано',
        okved: data.okved || 'Не указано',
        okvedType: data.okved_type || 'Не указано',
        opf: `${data.opf.full} (${data.opf.short})`,
        management: data.management
          ? {
              name: data.management.name || 'Не указано',
              post: data.management.post || 'Не указано',
              startDate: data.management.start_date
                ? new Date(data.management.start_date).toLocaleDateString()
                : 'Не указано',
            }
          : null,
        branchCount: data.branch_count || 0,
        branchType: data.branch_type || 'Не указано',

        status: data.state.status || 'Не указано',
       
        liquidationDate: data.state.liquidation_date
          ? new Date(data.state.liquidation_date).toLocaleDateString()
          : 'Не указано',
        actualityDate: data.state.actuality_date
          ? new Date(data.state.actuality_date).toLocaleDateString()
          : 'Не указано',
          */
      }

      return companyInfo
    } else {
      throw new Error('Нет доступных рекомендаций.')
    }
  } catch (error) {
    console.error('Ошибка:', error)
  }
}

// Поиск id доступных МПП ********************************************************************************
const getMppByCompany = async (companyId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}5000/api/users/mpp/${companyId}`)
    return response.data.id
  } catch (error) {
    console.error(`Ошибка при получении userId: ${error.message}`)
    throw error
  }
}

// Поиск id доступных МПР ********************************************************************************
const getMprByCompany = async (companyId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}5000/api/users/mpr/${companyId}`)
    return response.data.id
  } catch (error) {
    console.error(`Ошибка при получении userId: ${error.message}`)
    throw error
  }
}

// Поиск id НОК ********************************************************************************
const getNokOrMppByCompany = async (companyId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}5000/api/users/nok/${companyId}`)
    return response.data.id
  } catch (error) {
    console.error(`Ошибка при получении userId: ${error.message}`)
    throw error
  }
}

// Функция для создания уведомления ************************************************************************
const createReminder = async ({
  newRecordId,
  userId,
  textCalc,
  typeReminders,
  priority,
  title,
  tags,
  links,
}) => {
  try {
    const response = await axios.post(`${API_BASE_URL}5004/api/reminders`, {
      related_id: newRecordId,
      user_id: userId,
      date_time: formatDateForSQL(new Date()),
      comment: textCalc || '',
      type_reminders: typeReminders,
      priority_notifications: priority,
      title,
      tags,
      links: links.length > 0 ? links : undefined,
    })
    // console.log('response.data', response.data)
    return response.data // Если нужно вернуть результат
  } catch (error) {
    console.error(`Ошибка при создании напоминания: ${error.message}`)
    throw error
  }
}

// API AW
//*********************************************************************************************************************************** */
//*********************************************************************************************************************************** */
//*********************************************************************************************************************************** */

// Функция для получения элементов заказа
const getOrderItemsAW = async (orderNo, inn, year = 2025) => {
  try {
    // Формируем URL (не включаем год, если это 2025)
    console.log('year', year)
    const url =
      year === 2025
        ? `${API_BASE_URL}5005/app/order/items/${orderNo}/${inn}`
        : `${API_BASE_URL}5005/app/order/items/${orderNo}/${inn}/${year}`

    const response = await axios.get(url)
    return response.data
  } catch (error) {
    console.error(`Ошибка при получении заказа ${orderNo}: ${error.message}`)
    throw error
  }
}

// Функция для получения TOTALPRICE по ORDERNO и INN
const getTotalPriceOrderAW = async (orderNo, inn, isButton = false) => {
  console.log(`Запрос на получение цены для заказа: ${orderNo}, ИНН: ${inn}, isButton: ${isButton}`)
  try {
    const response = await axios.get(
      `${API_BASE_URL}5005/app/totalprice/${orderNo}/${inn}/${isButton}`
    )
    return response.data // Возвращаем данные, включая цену и список заказов
  } catch (error) {
    if (error.response) {
      // Если есть ответ сервера
      console.error(`Ошибка: ${error.response.status} - ${error.response.data.message}`)
    } else {
      console.error(`Ошибка: ${error.message}`)
    }
    throw error // Пробрасываем ошибку дальше
  }
}

// API 1С ************************************************************************************************************************************************
// ************************************************************************************************************************************************
// ************************************************************************************************************************************************
// ************************************************************************************************************************************************
// ***`V2R${msg.text}INN${companyInn}` - V2R INN - статус заказа
// *** V3R INN - Время доставки заказа
// *** V6R INN - Информация о поданных рекламациях \ Имеет собственный способ форматирования строки
// *** INN - Сверка по заказам. Показывает список заказов не отгруженных \ Имеет собственный способ форматирования строки

function sendRequest1C(sScan) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()

    client.connect(8240, '192.168.57.77', () => {
      console.log('Соединение установлено с сервером.')
      const message = `Q11\x01EB35000999\x02\t${sScan}\r`
      client.write(iconv.encode(message, 'windows-1251'))
    })

    client.on('data', (data) => {
      console.log('Полученные сырые данные:', data)

      if (!data) {
        console.log('Получены пустые данные.')
        resolve('Пустой ответ от сервера')
        client.destroy()
        return
      }

      const sResRespon = iconv.decode(data, 'windows-1251')
      const sRes = sResRespon //.replace(/^s;/, "");
      console.log('Декодированный ответ:', sRes)

      // Логика сбора строки для V6R
      if (sScan.startsWith('V6R')) {
        const lines = sRes
          .split('\n')
          .filter((line) => line.trim() !== '' && !line.startsWith('q11'))

        const statusWhitelist = [
          'В логистике',
          'Устранено',
          'Новая',
          'В работе',
          'Выполнено',
          'Заказано',
        ]
        const results = lines.flatMap((line) => {
          let trimmedLine = line.trim().replace(/^s;/, '')
          const parts = trimmedLine.split(':')

          if (parts.length < 3 || parts[0].trim() === '' || parts[2].trim() === '') {
            return []
          }

          // Обработка номера заявки
          const number = parts[0].trim().replace(/^0+/, '') || 'Не указан'

          // Обработка статуса
          let statusCode = parts[1].trim()
          if (statusCode.match(/\d{2}\.\d{2}\.\d{4}/) || !statusWhitelist.includes(statusCode)) {
            statusCode = 'Статус не распознан'
          }

          // Обработка номера заказа
          const orderNumber = parts[2].trim() === '00' ? 'Не указан' : parts[2].trim()

          // Обработка комментария с учетом флагов истина/ложь
          let commentParts = []
          let skipNext = false

          for (let i = 3; i < parts.length; i++) {
            const part = parts[i].trim()

            if (skipNext) {
              skipNext = false
              continue
            }

            if (
              part === 'истина' &&
              i + 1 < parts.length &&
              parts[i + 1].match(/\d{2}\.\d{2}\.\d{4}/)
            ) {
              commentParts.push(`Дата: ${parts[i + 1]}`)
              skipNext = true
            } else if (
              part === 'ложь' &&
              i + 1 < parts.length &&
              parts[i + 1].match(/\d{2}\.\d{2}\.\d{4}/)
            ) {
              skipNext = true
            } else if (part !== 'истина' && part !== 'ложь') {
              // Удаляем двоеточия в середине текста
              const cleanPart = part.replace(/^:|:$/g, '')
              if (cleanPart) commentParts.push(cleanPart)
            }
          }

          // Формирование комментария
          let comment = commentParts
            .join(' ')
            .replace(/\s{2,}/g, ' ')
            .replace(/:(\S)/g, ': $1') // Добавляем пробел после двоеточий в тексте
            .trim()

          if (number === 'Не указан' && orderNumber === 'Не указан' && comment === '') {
            return []
          }

          return [
            `🔹 Заявка №${number}`,
            `📋 Номер заказа: ${orderNumber}`,
            `🔄 Текущий статус: ${statusCode}`,
            ...(comment ? [`📝 Комментарий: ${comment}`] : []),
            '━━━━━━━━━━━━━━━━━━━━',
          ]
        })

        if (results.length > 0) {
          resolve(
            [
              '📢 Актуальные заявки',
              '',
              ...results.flat(),
              '',
              'ℹ️ Для уточнения деталей обращайтесь к вашему менеджеру.',
            ].join('\n')
          )
        } else {
          resolve('⚠️ Нет актуальных заявок для отображения')
        }
      }
      // Обработка строки для V7R
      else if (sScan.startsWith('V7R')) {
        const lines = sRes.split('\n').filter((line) => line.trim() !== '')
        const results = lines
          .map((line) => {
            let trimmedLine = line.trim()
            trimmedLine = trimmedLine.replace(/^s;/, '')
            const parts = trimmedLine.split(':').map((part) => part.trim())
            if (parts.length >= 2) {
              const name = parts[0] // Имя
              const address = parts.slice(1).join(':').trim() // Адрес (может содержать дополнительные ':')
              return {
                name: name,
                address: address.replace(/^\d+\s/, ''), // Убираем номера из начала адреса
                full: `${name}, ${address}`, // Полная строка для удобного вывода
              }
            } else {
              return null // Если не соответствует формату
            }
          })
          .filter((obj) => obj !== null) // Фильтруем null-значения

        console.log('Извлеченный текст для V7R:', results)
        resolve(results.length > 0 ? results : [])
      }
      // Обработка строки, начинающейся с INN
      else if (sScan.startsWith('INN')) {
        const lines = sRes.split('\n').filter((line) => line.trim() !== '')
        const results = lines.flatMap((line) => {
          const trimmedLine = line.trim()
          const parts = trimmedLine.split(':')

          // Проверка, что данные имеют необходимую структуру
          if (parts.length >= 5) {
            const orderNumber = parts[0].replace(/^s;/, '').trim()
            const orderName = parts[1].trim()

            // Исправленная обработка суммы
            const sumStr = parts[2].trim().replace(',', '.') // Заменяем запятую на точку
            const sum = parseFloat(sumStr)

            const address = parts.slice(3, -1).join(':').trim()
            const date = parts[parts.length - 1].trim()

            return [
              `Номер заказа: ${orderNumber}, Наименование: ${orderName}, Сумма: ${sum.toFixed(
                2
              )}, Адрес: ${address}, Дата: ${date}`,
            ]
          } else {
            return []
          }
        })

        console.log('Извлеченный текст с INN:', results)
        resolve(results.length > 0 ? results.join('\n\n') : false)
      } else {
        // Логика сбора строки для V2R, V3R, V4R *****************************************************
        const matches = sRes.match(/;(.*?);/g)
        if (matches) {
          const extractedText = matches.map((match) => match.slice(1, -1)).join(', ')

          console.log('Извлеченный текст:', extractedText)

          if (extractedText.length === 0) {
            resolve(false)
          } else {
            resolve(extractedText)
          }
        } else {
          resolve(false)
        }
      }

      client.destroy()
    })

    client.on('error', (err) => {
      console.error(`Произошла ошибка: ${err.message}`)
      reject(err)
    })

    client.on('close', () => {
      console.log('Соединение закрыто.')
    })
  })
}

// *** V6Z - атоотправка уведомления о закрытии рекламации ***********************************************************

//test() -- тестирование без 1С getReclamationClose

async function getReclamationClose(sScan, testMode = false, testData = null) {
  if (testMode) {
    try {
      const result = await processServerResponse(testData, sScan)
      return result
    } catch (err) {
      return `❌ Тестовая ошибка: ${err.message}`
    }
  }

  return new Promise((resolve, reject) => {
    const client = new net.Socket()
    let responseBuffer = ''
    let isProcessing = false
    let connectionTimeout
    let responseTimeout
    let isResolved = false

    // Таймаут на подключение (5 секунд - уменьшено)
    connectionTimeout = setTimeout(() => {
      if (!isResolved && !client.destroyed) {
        isResolved = true
        client.destroy()
        reject(new Error('Таймаут подключения к серверу (5с)'))
      }
    }, 5000)

    // Таймаут на ответ (15 секунд - уменьшено)
    responseTimeout = setTimeout(() => {
      if (!isResolved && !client.destroyed) {
        isResolved = true
        client.destroy()
        reject(new Error('Таймаут ожидания ответа сервера (15с)'))
      }
    }, 15000)

    function cleanup() {
      if (connectionTimeout) clearTimeout(connectionTimeout)
      if (responseTimeout) clearTimeout(responseTimeout)
      if (!client.destroyed) {
        client.destroy()
      }
    }

    function handleError(err, context) {
      if (!isResolved) {
        isResolved = true
        cleanup()
        reject(new Error(`❌ ${context}: ${err.message}`))
      }
    }

    function handleSuccess(result) {
      if (!isResolved) {
        isResolved = true
        cleanup()
        resolve(result)
      }
    }

    try {
      // Устанавливаем таймаут на сокет
      client.setTimeout(20000) // 20 секунд общий таймаут

      // Подключение к серверу
      client.connect(8240, '192.168.57.77', () => {
        try {
          if (connectionTimeout) clearTimeout(connectionTimeout)
          const message = `Q11\x01EB35000999\x02\t${sScan}\r`
          client.write(iconv.encode(message, 'windows-1251'))
          console.log(`Запрос отправлен для скана: ${sScan}`)
        } catch (err) {
          handleError(err, 'Ошибка отправки запроса')
        }
      })

      // Обработка входящих данных
      client.on('data', (data) => {
        if (isProcessing || isResolved) return
        isProcessing = true

        try {
          if (responseTimeout) clearTimeout(responseTimeout)
          const decodedData = iconv.decode(data, 'windows-1251')
          responseBuffer += decodedData

          if (responseBuffer.includes('q11\x01')) {
            processServerResponse(responseBuffer, sScan)
              .then((result) => handleSuccess(result))
              .catch((err) => handleError(err, 'Ошибка обработки данных'))
          }
        } catch (err) {
          handleError(err, 'Ошибка обработки данных')
        } finally {
          isProcessing = false
        }
      })

      client.on('error', (err) => {
        handleError(err, 'Ошибка соединения')
      })

      client.on('close', () => {
        console.log('Соединение с сервером закрыто')
        cleanup()
      })

      client.on('timeout', () => {
        handleError(new Error('Таймаут соединения'), 'Таймаут соединения')
      })
    } catch (err) {
      handleError(err, 'Ошибка выполнения функции')
    }
  })
}

// Обработка ответа сервера
async function processServerResponse(responseData, sScan) {
  try {
    console.log('Начало обработки ответа сервера', { scan: sScan })

    // Нормализация данных
    const cleanData = responseData.split('q11\x01')[0].trim()
    const lines = cleanData
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('q11'))

    if (lines.length === 0) {
      console.log('Нет данных для обработки', { scan: sScan })
      return '🔹 Нет данных по рекламациям для указанного кода'
    }

    // Парсинг и валидация данных
    const parsedClaims = parseClaimLines(lines)
    if (parsedClaims.length === 0) {
      console.log('Нет валидных данных в ответе', { scan: sScan, rawData: cleanData })
      return '🔹 Нет корректных данных по рекламациям'
    }

    // Фильтрация существующих записей
    const newClaims = await filterExistingClaims(parsedClaims)
    if (newClaims.length === 0) {
      console.log('Все записи уже существуют в БД', { scan: sScan })
      return '🔹 Нет новых рекламаций для указанного кода'
    }

    // Пакетное сохранение в БД
    await saveClaimsToDatabase(newClaims)
    console.log('Успешно сохранены записи', { scan: sScan, count: newClaims.length })

    // Формирование ответа пользователю
    return formatClaimsResponse(newClaims)
  } catch (err) {
    console.log('Ошибка обработки ответа сервера', {
      scan: sScan,
      error: err.message,
      stack: err.stack,
    })
    throw new Error('❌ Ошибка обработки данных от сервера')
  }
}

// Парсинг строк с информацией о рекламациях
function parseClaimLines(lines) {
  return lines
    .map((line) => {
      const cleanLine = line.startsWith('s;') ? line.substring(2) : line

      // Разбиваем строку по двоеточиям, но учитываем фиксированную структуру:
      // контрагент:ИНН:дефект:место:номер_заявки:дата
      const parts = cleanLine.split(':').map((p) => p.trim())

      // Должно быть минимум 6 частей
      if (parts.length < 6) return null

      // Последние 2 элемента всегда номер заявки и дата
      const dateStr = parts.pop()
      const requestNumber = parts.pop()

      // Оставшиеся части: контрагент, ИНН, дефект, место
      // ИНН может быть пустым (два двоеточия подряд)
      let kontragent = ''
      let inn = ''
      let defect = ''
      let location = ''

      // Первая часть - всегда контрагент (может содержать двоеточия в названии)
      // Но в нашей структуре контрагент - это первая часть до первого двоеточия
      kontragent = parts[0] || '[не указано]'

      // Вторая часть - ИНН (может быть пустой)
      inn = parts[1] && /^\d+$/.test(parts[1]) ? parts[1] : '[отсутствует]'

      // Третья часть - дефект
      defect = parts[2] || 'не указано'

      // Четвертая часть - место
      location = parts[3] || 'не указано'

      // Парсим дату
      const [day, month, year] = dateStr.split('.')
      const claimDate = new Date(`${year}-${month}-${day}`)

      if (isNaN(claimDate.getTime())) {
        return null
      }

      return {
        claim_number: requestNumber || '',
        kontragent: kontragent,
        inn: inn,
        defect: defect,
        location: location,
        claim_date: claimDate,
        processed: false,
      }
    })
    .filter(Boolean)
}

// Фильтрация существующих записей
async function filterExistingClaims(claims) {
  const claimNumbers = claims.map((c) => c.claim_number)

  try {
    const { rows } = await dbPool.query(
      `SELECT claim_number FROM reclamation_records 
             WHERE claim_number = ANY(\$1)`,
      [claimNumbers]
    )

    const existingNumbers = new Set(rows.map((r) => r.claim_number))
    return claims.filter((c) => !existingNumbers.has(c.claim_number))
  } catch (err) {
    console.log('Ошибка фильтрации существующих записей', {
      error: err.message,
      stack: err.stack,
    })
    return [] // В случае ошибки считаем все записи существующими
  }
}

// Пакетное сохранение рекламаций
async function saveClaimsToDatabase(claims) {
  if (claims.length === 0) return

  const values = claims.map((c) => [
    c.claim_number,
    c.kontragent,
    c.inn,
    c.defect,
    c.location,
    c.claim_date,
    c.processed,
  ])

  try {
    await dbPool.query(
      `INSERT INTO reclamation_records (
                claim_number, kontragent, inn, defect, 
                location, claim_date, processed
             ) SELECT * FROM UNNEST(
                \$1::text[], \$2::text[], \$3::text[], 
                \$4::text[], \$5::text[], \$6::timestamp[], \$7::boolean[]
             )`,
      [
        values.map((v) => v[0]),
        values.map((v) => v[1]),
        values.map((v) => v[2]),
        values.map((v) => v[3]),
        values.map((v) => v[4]),
        values.map((v) => v[5]),
        values.map((v) => v[6]),
      ]
    )
  } catch (err) {
    console.log('Ошибка пакетного сохранения записей', {
      error: err.message,
      stack: err.stack,
    })
    throw err
  }
}

// Форматирование ответа пользователю
function formatClaimsResponse(claims) {
  return claims
    .map(
      (c) =>
        `🔹 <b>Контрагент:</b> ${c.kontragent}\n` +
        `<b>ИНН:</b> ${c.inn}\n` +
        `<b>Дефект:</b> ${c.defect}\n` +
        `<b>Место:</b> ${c.location}\n` +
        `<b>Заявка №:</b> ${c.claim_number}\n` +
        `<b>Дата:</b> ${c.claim_date.toLocaleDateString()}`
    )
    .join('\n\n────────────────\n\n')
}

// Отправка дилерам сообщения о закрытии рекламации **********   *********   **********
// Вспомогательные функции
async function findCompanyByINN(inn) {
  const { rows } = await dbPool.query('SELECT * FROM companies WHERE inn = $1 LIMIT 1', [inn])
  return rows[0]
}

async function findCompanyByName(name) {
  const { rows } = await dbPool.query('SELECT * FROM companies WHERE name_companies = $1 LIMIT 1', [
    name,
  ])
  return rows[0]
}

async function getCompanyChatId(companyId) {
  const { rows } = await dbPool.query(
    'SELECT chat_id FROM user_company_tg_bot WHERE company_id = $1 LIMIT 1',
    [companyId]
  )
  return rows[0]?.chat_id
}

function formatReclamationMessage(r) {
  return {
    text: `
🔹 <b>Закрытие рекламации</b> 
<b>Заявка №:</b> ${r.requestNumber}
<b>Дата:</b> ${r.date}
<b>Дефект:</b> ${r.defect}
<b>Место:</b> ${r.location} 
────────────────
<b>Пожалуйста, оцените обработку рекламации:</b>
    `.trim(),
    options: {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '1 ⭐', callback_data: `rate_${r.requestNumber}_1` },
            { text: '2 ⭐', callback_data: `rate_${r.requestNumber}_2` },
            { text: '3 ⭐', callback_data: `rate_${r.requestNumber}_3` },
            { text: '4 ⭐', callback_data: `rate_${r.requestNumber}_4` },
            { text: '5 ⭐', callback_data: `rate_${r.requestNumber}_5` },
          ],
        ],
      },
    },
  }
}

function cleanCompanyName(name) {
  return name
    .replace(/^[🔹►•—\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Основная функция обработки рекламаций
async function processReclamationResult(result, bot) {
  try {
    const reclamations = result
      .split(/\n\s*─{15,}\s*\n/)
      .map((section) => section.trim())
      .filter((section) => section.length > 0 && section.includes('<b>Контрагент:</b>'))
      .map((section) => {
        const lines = section.split('\n').filter((line) => line.trim() !== '')
        const reclamation = {}

        lines.forEach((line) => {
          const trimmedLine = line.trim()
          if (trimmedLine.includes('<b>Контрагент:</b>')) {
            reclamation.contractor = cleanCompanyName(
              trimmedLine.replace('<b>Контрагент:</b>', '').trim()
            )
          } else if (trimmedLine.includes('<b>ИНН:</b>')) {
            const inn = trimmedLine.replace('<b>ИНН:</b>', '').trim()
            reclamation.inn = inn === '[отсутствует]' ? null : inn
          } else if (trimmedLine.includes('<b>Дефект:</b>')) {
            reclamation.defect = trimmedLine.replace('<b>Дефект:</b>', '').trim()
          } else if (trimmedLine.includes('<b>Место:</b>')) {
            reclamation.location = trimmedLine.replace('<b>Место:</b>', '').trim()
          } else if (trimmedLine.includes('<b>Заявка №:</b>')) {
            reclamation.requestNumber = trimmedLine.replace('<b>Заявка №:</b>', '').trim()
          } else if (trimmedLine.includes('<b>Дата:</b>')) {
            reclamation.date = trimmedLine.replace('<b>Дата:</b>', '').trim()
          }
        })

        return reclamation
      })

    console.log(`[CRON] Найдено рекламаций: ${reclamations.length}`)
    console.log('[CRON] Содержимое reclamations:', JSON.stringify(reclamations, null, 2))

    const processingResults = []
    for (const [index, reclamation] of reclamations.entries()) {
      try {
        console.log(
          `[CRON] Обработка рекламации ${index + 1}/${reclamations.length}: №${
            reclamation.requestNumber
          } (${reclamation.contractor})`
        )

        const companyName = reclamation.contractor
        let company = null
        let searchMethod = ''

        if (reclamation.inn) {
          company = await findCompanyByINN(reclamation.inn)
          searchMethod = company ? 'по ИНН' : 'ИНН не найден'
        }

        if (!company) {
          company = await findCompanyByName(companyName)
          searchMethod = company ? 'по названию' : 'компания не найдена'
        }

        if (!company) {
          console.log(
            `[CRON] Компания не найдена: ${companyName} (заявка №${reclamation.requestNumber})`
          )
          processingResults.push({
            success: false,
            requestNumber: reclamation.requestNumber,
            error: 'Company not found',
          })
          continue
        }

        const chatId = await getCompanyChatId(company.id)

        if (!chatId) {
          console.log(
            `[CRON] Нет chat_id для компании: ${companyName} (заявка №${reclamation.requestNumber})`
          )
          processingResults.push({
            success: false,
            requestNumber: reclamation.requestNumber,
            error: 'No chat_id',
          })
          continue
        }

        const messageData = formatReclamationMessage(reclamation)
        // await bot.sendMessage(chatId, message, { parse_mode: 'HTML' })
        //  await sendReclamationToChat(bot, chatId, reclamation)
        const sentMessage = await bot.sendMessage(chatId, messageData.text, messageData.options)

        // Сохраняем ID сообщения для возможного обновления
        await saveReclamationMessage({
          messageId: sentMessage.message_id,
          chatId: chatId,
          requestNumber: reclamation.requestNumber,
        })

        console.log(
          `[CRON] Успешно отправлено: ${companyName} (заявка №${reclamation.requestNumber}) → ${chatId} [${searchMethod}]`
        )
        processingResults.push({ success: true, requestNumber: reclamation.requestNumber })
      } catch (error) {
        console.error(
          `[CRON] Ошибка обработки заявки №${reclamation.requestNumber}:`,
          error.message
        )
        processingResults.push({
          success: false,
          requestNumber: reclamation.requestNumber,
          error: error.message,
        })
      }
    }

    const successful = processingResults.filter((r) => r.success).length
    console.log(`[CRON] Итоговый отчет: ${successful}/${reclamations.length} отправлено успешно`)
    console.log('Детали обработки:', processingResults)
  } catch (error) {
    console.error('[CRON] Критическая ошибка в processReclamationResult:', error)
  }
}

// Инициализация cron-задачи  *******************************************************************************************************************************
function initReclamationCron(bot, cronManager) {
  console.log('[CRON][INIT] Инициализация планировщика проверки рекламаций...')

  const task = async () => {
    const timestamp = new Date().toISOString()
    console.log(`[CRON][V6Z][${timestamp}] Старт проверки рекламаций...`)

    const TASK_TIMEOUT = 2 * 60 * 1000 // 2 минуты таймаут

    try {
      await runWithTimeout(
        async () => {
          console.log('[CRON][V6Z] Запрос данных...')
          const result = await getReclamationClose('V6Z')
          console.log('[CRON][V6Z] Получено записей:', result.length)

          if (result.length > 0) {
            console.log('[CRON][V6Z] Обработка результатов...')
            await processReclamationResult(result, bot)
            console.log('[CRON][V6Z] Обработка завершена')
          } else {
            console.log('[CRON][V6Z] Нет данных для обработки')
          }
        },
        TASK_TIMEOUT,
        'Reclamation Check'
      )
    } catch (error) {
      console.error(`[CRON][V6Z][ERROR] ${error.message}`)
      console.error(error.stack)

      // Логируем ошибку для диагностики
      console.error(`[CRON][V6Z][${timestamp}] Задача завершилась с ошибкой:`, {
        error: error.message,
        stack: error.stack,
        timestamp: timestamp,
      })

      throw error // Перебрасываем ошибку для CronManager
    } finally {
      console.log(`[CRON][V6Z][${timestamp}] Завершено`)
    }
  }

  if (cronManager) {
    return cronManager.addJob('reclamation', '0 10-19/2 * * *', task)
  } else {
    // Fallback к старому способу если CronManager не доступен
    const job = cron.schedule('0 10-19/2 * * *', task, {
      scheduled: true,
      timezone: 'Europe/Saratov',
      recoverMissedExecutions: true,
    })

    job.on('error', (error) => {
      console.error('[CRON][V6Z][CRON_ERROR] Ошибка в cron-задаче:', error)
    })

    return job
  }
}

function initReconciliationCron(bot, cronManager) {
  console.log('[CRON][INIT] Инициализация планировщика сверки заказов...')

  const task = async () => {
    const timestamp = new Date().toISOString()
    console.log(`[CRON][V0Z][${timestamp}] Старт сверки заказов...`)

    const TASK_TIMEOUT = 2 * 60 * 1000 // 2 минуты таймаут

    try {
      await runWithTimeout(
        async () => {
          console.log('[CRON][V0Z] Запрос данных...')
          const response = await getReconciliationOrders('V0Z')
          console.log('[CRON][V0Z] Получено записей:', response.length)

          if (response.length > 0) {
            console.log('[CRON][V0Z] Обработка результатов...')
            await processReconciliationResponse(response, bot)
            console.log('[CRON][V0Z] Обработка завершена')
          } else {
            console.log('[CRON][V0Z] Нет данных для обработки')
          }
        },
        TASK_TIMEOUT,
        'Reconciliation Check'
      )
    } catch (error) {
      console.error(`[CRON][V0Z][ERROR] ${error.message}`)
      console.error(error.stack)

      // Логируем ошибку для диагностики
      console.error(`[CRON][V0Z][${timestamp}] Задача завершилась с ошибкой:`, {
        error: error.message,
        stack: error.stack,
        timestamp: timestamp,
      })

      throw error // Перебрасываем ошибку для CronManager
    } finally {
      console.log(`[CRON][V0Z][${timestamp}] Завершено`)
    }
  }

  if (cronManager) {
    return cronManager.addJob('reconciliation', '35 9 * * *', task)
  } else {
    // Fallback к старому способу если CronManager не доступен
    const job = cron.schedule('35 9 * * *', task, {
      scheduled: true,
      timezone: 'Europe/Saratov',
      recoverMissedExecutions: true,
    })

    job.on('error', (error) => {
      console.error('[CRON][V0Z][CRON_ERROR] Ошибка в cron-задаче:', error)
    })

    return job
  }
}

// Альтернативное расписание для тестирования (каждую минуту)
// cron.schedule('*/1 * * * *', async () => { ... })

//   *******************************************************************************************************************************
//   *******************************************************************************************************************************
//   *******************************************************************************************************************************

//обработчик текстовых сообщений для handleReclamationRating
async function handleRatingComment(bot, chatId, text, userSessions) {
  if (!userSessions[chatId]?.awaitingRatingComment) return

  const { requestNumber, rating } = userSessions[chatId].awaitingRatingComment
  const userId = userSessions[chatId]?.userId

  try {
    // Проверяем существование записи
    const { command, rows } = await dbPool.query(
      `SELECT id FROM reclamation_ratings 
       WHERE request_number = \$1 AND chat_id = \$2 AND user_id = \$3`,
      [requestNumber, chatId, userId]
    )

    if (rows.length === 0) {
      // Если запись не найдена, создаём новую
      await saveReclamationRating({
        requestNumber,
        rating,
        chatId,
        messageId: null, // или можно получить из userSessions если сохраняли
        userId,
        userName: userSessions[chatId]?.userName || 'Unknown',
      })
    }
    console.log('Данные для сохранения комментария:', {
      requestNumber,
      chatId,
      userId,
      comment: text,
    })

    // Обновляем комментарий
    const result = await saveRatingComment({
      comment: text,
      requestNumber,
      chatId,
      userId,
    })

    if (result.rowCount === 0) {
      throw new Error('Не удалось обновить комментарий')
    }
    console.log('Результат обновления:', result.rows[0])
    delete userSessions[chatId].awaitingRatingComment
    await bot.sendMessage(chatId, 'Спасибо за ваш комментарий!')
    handleCancel(bot, chatId, userSessions)
  } catch (error) {
    console.error('Ошибка сохранения комментария:', error)
    await bot.sendMessage(chatId, 'Произошла ошибка при сохранении комментария.')
  }
}

async function handleReclamationRating(
  bot,
  chatId,
  callbackQuery,
  requestNumber,
  rating,
  userSessions
) {
  try {
    // Сохраняем оценку в БД
    await saveReclamationRating({
      requestNumber,
      rating,
      chatId,
      messageId: callbackQuery.message.message_id,
      userId: callbackQuery.from.id,
      userName:
        callbackQuery.from.username ||
        `${callbackQuery.from.first_name || ''} ${callbackQuery.from.last_name || ''}`.trim(),
    })

    // Обновляем сообщение
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
      }
    )

    // Подтверждение
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `Спасибо за оценку ${rating} ⭐!`,
      show_alert: false,
    })

    // Запрашиваем комментарий
    await bot.sendMessage(
      chatId,
      `Вы поставили оценку ${rating} звезд по заявке №${requestNumber}.\n` +
        `Хотите оставить комментарий? (Отправьте текст или нажмите /cancel)`
    )

    // Сохраняем состояние для комментария
    if (!userSessions[chatId]) userSessions[chatId] = {}
    userSessions[chatId].awaitingRatingComment = {
      requestNumber,
      rating,
    }
    console.log('requestNumber', requestNumber)
    console.log('rating', rating)
    // Запись оценки в 1С
    await sendReclamationRating(`V0N${requestNumber}Q${rating}`)
  } catch (error) {
    console.error('Ошибка при обработке оценки:', error)
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Произошла ошибка при сохранении оценки',
      show_alert: true,
    })
  }
}

async function saveReclamationRating(data) {
  await dbPool.query(
    `
    INSERT INTO reclamation_ratings
    (request_number, rating, chat_id, message_id, user_id, user_name, rated_at)
    VALUES (\$1, \$2, \$3, \$4, \$5, \$6, NOW())
  `,
    [data.requestNumber, data.rating, data.chatId, data.messageId, data.userId, data.userName]
  )
}

async function saveRatingComment(data) {
  const result = await dbPool.query(
    `
    UPDATE reclamation_ratings
    SET comment = \$1,
        rated_at = NOW()
    WHERE request_number = \$2 
      AND chat_id = \$3 
      AND user_id = \$4
    RETURNING *;
    `,
    [data.comment, data.requestNumber, data.chatId, data.userId]
  )

  return result
}

async function sendReclamationToChat(bot, chatId, reclamation) {
  const messageData = formatReclamationMessage(reclamation)
  const sentMessage = await bot.sendMessage(chatId, messageData.text, messageData.options)

  // Сохраняем информацию о сообщении для последующей связи с оценкой
  await saveReclamationMessage({
    messageId: sentMessage.message_id,
    chatId: chatId,
    requestNumber: reclamation.requestNumber,
  })
}

async function saveReclamationMessage(data) {
  await dbPool.query(
    `
    INSERT INTO reclamation_messages 
    (message_id, chat_id, request_number, created_at)
    VALUES (\$1, \$2, \$3, NOW())
    ON CONFLICT (message_id, chat_id) DO UPDATE
    SET request_number = \$3
  `,
    [data.messageId, data.chatId, data.requestNumber]
  )
}

function sendReclamationRating(scanCode) {
  return new Promise((resolve, reject) => {
    // Валидация входных данных
    const match = scanCode.match(/^V0N(\d{1,9})Q([1-5])$/)
    if (!match) {
      return reject(new Error('Неверный формат кода. Ожидается V0N{1-9_цифр}Q[1-5]'))
    }

    const [_, claimNumber, rating] = match

    // Дополняем номер заявки нулями до 9 цифр
    const paddedClaimNumber = claimNumber.padStart(9, '0')
    const formattedScanCode = `V0N${paddedClaimNumber}Q${rating}`

    const client = new net.Socket()

    client.connect(8240, '192.168.57.77', () => {
      console.log('Соединение с сервером 1С установлено')
      const message = `Q12\x01EB35000999\x02\t${formattedScanCode}\r`
      console.log('Отправляем сообщение:', message)
      client.write(iconv.encode(message, 'windows-1251'))
    })

    client.on('data', (data) => {
      const response = iconv.decode(data, 'windows-1251')
      console.log('Ответ сервера:', response)
      if (response.includes('q12\x01')) {
        client.destroy()
        resolve()
      } else {
        client.destroy()
        reject(new Error('Неверный ответ сервера'))
      }
    })

    client.on('error', (err) => {
      client.destroy()
      reject(new Error('Ошибка соединения с сервером 1С'))
    })

    setTimeout(() => {
      client.destroy()
      reject(new Error('Таймаут соединения'))
    }, 10000)
  })
}

//******************************************************************************************************************************** */

//*************************************Сверка по заказам *************************************************************************** */
function getReconciliationOrders(sScan, testMode = false) {
  console.log('Начало обработки запроса', { scan: sScan })

  if (testMode) {
    console.log('[TEST] Возвращаем тестовые данные для сверки заказов')
    return Promise.resolve([
      {
        id: '16515',
        name: 'Малькин И.Н. ИП',
        inn: '7777777',
        date: '01.08.2025',
        address: '',
      },
      {
        id: '16515',
        name: 'Десять',
        inn: '77177777',
        date: '01.08.2025',
        address: 'Адрес есть я написал',
      },
    ])
  }

  return new Promise((resolve, reject) => {
    const client = new net.Socket()
    let buffer = Buffer.alloc(0)
    let responseComplete = false
    let connectionTimeout
    let responseTimeout
    let isResolved = false

    // Таймаут на подключение (5 секунд - уменьшено)
    connectionTimeout = setTimeout(() => {
      if (!isResolved && !client.destroyed) {
        isResolved = true
        client.destroy()
        reject(new Error('Таймаут подключения к серверу (5с)'))
      }
    }, 5000)

    // Таймаут на ответ (15 секунд - уменьшено)
    responseTimeout = setTimeout(() => {
      if (!responseComplete && !isResolved && !client.destroyed) {
        console.log('Таймаут соединения, обработка накопленных данных')
        client.destroy()
        processResponse()
      }
    }, 15000)

    function cleanup() {
      if (connectionTimeout) clearTimeout(connectionTimeout)
      if (responseTimeout) clearTimeout(responseTimeout)
      if (!client.destroyed) {
        client.destroy()
      }
    }

    function handleError(err, context) {
      if (!isResolved) {
        isResolved = true
        cleanup()
        reject(new Error(`❌ ${context}: ${err.message}`))
      }
    }

    function handleSuccess(result) {
      if (!isResolved) {
        isResolved = true
        cleanup()
        resolve(result)
      }
    }

    try {
      // Устанавливаем таймаут на сокет
      client.setTimeout(20000) // 20 секунд общий таймаут

      client.once('error', (err) => {
        handleError(err, 'Ошибка соединения')
      })

      client.connect(8240, '192.168.57.77', () => {
        if (connectionTimeout) clearTimeout(connectionTimeout)
        console.log('Соединение установлено с сервером.')
        const message = `Q11\x01EB35000999\x02\t${sScan}\r`
        client.write(iconv.encode(message, 'windows-1251'))
      })

      client.on('data', async (data) => {
        if (!data) {
          console.log('Получен пустой пакет данных')
          return
        }

        buffer = Buffer.concat([buffer, data])
        console.log(`Получено ${data.length} байт, всего в буфере: ${buffer.length} байт`)

        const dataStr = iconv.decode(buffer, 'windows-1251')
        console.log('Декодированный ответ:', dataStr)

        const csvPathMatch = dataStr.match(/\\\\serv8\\Общая\\.+?\.csv/i)
        if (csvPathMatch) {
          console.log('Обнаружен путь к CSV файлу:', csvPathMatch[0])
          try {
            const dealers = await processCsvFile(csvPathMatch[0]) // Добавлено await
            cleanup()
            resolve(dealers)
          } catch (err) {
            // Изменено: при ошибке файла возвращаем пустой массив вместо reject
            console.warn('Ошибка обработки CSV файла:', err.message)
            cleanup()
            resolve([])
          }
          return
        }

        if (dataStr.includes('q11\x01') || dataStr.endsWith('\r\n')) {
          responseComplete = true
          clearTimeout(responseTimeout)
          processResponse()
        }
      })

      client.on('close', () => {
        console.log('Соединение закрыто')
        if (!responseComplete) {
          console.log('Соединение закрыто до получения признака конца ответа')
          processResponse()
        }
      })

      client.on('timeout', () => {
        console.log('Таймаут соединения')
        cleanup()
        processResponse()
      })
    } catch (err) {
      handleError(err, 'Ошибка выполнения функции')
    }

    async function processCsvFile(networkPath) {
      const localPath = networkPath.replace(/^\\\\serv8\\Общая\\/i, 'Z:\\')
      console.log('Обработка файла:', localPath)

      try {
        // Проверка доступности файла с обработкой ошибок
        await checkFileAvailability(localPath)
      } catch (error) {
        console.warn('Файл недоступен:', error.message)
        return [] // Возвращаем пустой массив вместо ошибки
      }

      try {
        const content = await fs.readFile(localPath, 'utf8')

        const dealers = content
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            const parts = line.split(':')
            return {
              id: parts[0]?.trim() || '',
              name: parts[1]?.trim() || '',
              inn: parts[2]?.trim() || '',
              date: parts[3]?.trim() || '',
              address: parts[4]?.trim() || '',
            }
          })

        fs.unlink(localPath).catch((e) => console.error('Ошибка удаления:', e.message))
        return dealers
      } catch (error) {
        console.warn('Ошибка чтения файла:', error.message)
        return [] // Возвращаем пустой массив при ошибках чтения
      }
    }

    async function checkFileAvailability(filePath) {
      const maxAttempts = 3
      const delay = 300

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const stats = await fs.stat(filePath)
          if (stats.size > 0) return

          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        } catch (error) {
          if (attempt >= maxAttempts) {
            throw new Error(`Файл не найден после ${maxAttempts} попыток: ${error.message}`)
          }
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    function processResponse() {
      clearTimeout(responseTimeout)

      try {
        if (buffer.length === 0) {
          console.log('Нет данных для обработки')
          resolve([])
          return
        }

        const sRes = iconv.decode(buffer, 'windows-1251')
        console.log('Полный декодированный ответ:', sRes)

        const lines = sRes.split('\n').filter((line) => line.trim() !== '')

        if (lines.length < 2) {
          console.log('Недостаточно строк в ответе')
          resolve([])
          return
        }

        const dealerLines = lines.slice(1, -1)
        console.log(`Найдено строк для обработки: ${dealerLines.length}`)

        const dealers = dealerLines.map((line) => {
          const parts = line.split(':')
          return {
            id: parts[0]?.trim() || '',
            name: parts[1]?.trim() || '',
            inn: parts[2]?.trim() || '',
            date: parts[3]?.trim() || '',
            address: parts[4]?.trim() || '',
          }
        })

        console.log(`Успешно обработано записей: ${dealers.length}`)
        resolve(dealers)
      } catch (err) {
        console.error('Ошибка обработки ответа:', err)
        reject(err)
      } finally {
        if (!client.destroyed) {
          client.destroy()
        }
      }
    }
  })
}

/*function getReconciliationOrders(sScan, testMode = false) {
  if (testMode) {
    console.log('[TEST] Возвращаем тестовые данные для сверки заказов')
    return Promise.resolve([
      {
        id: '16232',
        name: 'Порохов С.А. ИП',
        inn: '',
        date: '28.07.2025',
      },
      {
        id: '14753',
        name: 'Абдуллина Д.И. ИП',
        inn: '583100341406',
        date: '30.07.2025',
      },
      {
        id: '14989',
        name: 'Малькин И.Н. ИП',
        inn: '7777777',
        date: '28.07.2025',
      },
      {
        id: '16027',
        name: 'Лихачев В.А. ИП',
        inn: '344100498704',
        date: '09.08.2025',
      },
      {
        id: '16225',
        name: 'Золотовская А.В. ИП',
        inn: '7777777',
        date: '09.08.2025',
      },
      {
        id: '16045',
        name: 'Лихачев В.А. ИП',
        inn: '344100498704',
        date: '07.08.2025',
      },
    ])
  }

  return new Promise((resolve, reject) => {
    const client = new net.Socket()

    client.connect(8240, '192.168.57.77', () => {
      console.log('Соединение установлено с сервером.')
      const message = `Q11\x01EB35000999\x02\t${sScan}\r`
      client.write(iconv.encode(message, 'windows-1251'))
    })

    client.on('data', (data) => {
      console.log('Полученные сырые данные:', data)

      if (!data) {
        console.log('Получены пустые данные.')
        resolve([])
        client.destroy()
        return
      }

      // Декодирование данных
      const sRes = iconv.decode(data, 'windows-1251')
      console.log('Декодированный ответ:', sRes)

      const lines = sRes.split('\n').filter((line) => line.trim() !== '')

      const dealerLines = lines.slice(1, -1)

      const dealers = dealerLines.map((line) => {
        const [id, name, inn, date] = line.split(':')
        return {
          id: id.trim(),
          name: name.trim(),
          inn: inn.trim(),
          date: date.trim(),
        }
      })

      resolve(dealers)
      client.destroy()
    })

    client.on('error', (err) => {
      console.error(`Произошла ошибка: ${err.message}`)
      reject(err)
    })

    client.on('close', () => {
      console.log('Соединение закрыто.')
    })
  })
}*/

async function processReconciliationResponse(response, bot) {
  if (!Array.isArray(response) || !response.length) {
    console.log('[CRON] Нет данных для обработки сверки заказов')
    return
  }

  console.log(`[CRON] Начало обработки ${response.length} записей сверки заказов`)

  // 1. Группируем заказы по компаниям
  const ordersByCompany = await groupOrdersByCompanies(response)

  // 2. Отправляем группированные сообщения
  await sendGroupedReconciliationMessages(bot, ordersByCompany)

  console.log('[CRON] Завершена обработка сверки заказов')
}

// Группировка заказов по компаниям
async function groupOrdersByCompanies(orders) {
  const grouped = {}

  for (const order of orders) {
    try {
      const normalizedOrder = {
        ...order,
        name: order.name?.trim(),
        inn: order.inn?.trim() || null,
      }

      // Поиск компании
      let company = null
      if (normalizedOrder.inn) {
        company = await findCompanyByINN(normalizedOrder.inn)
      }
      if (!company && normalizedOrder.name) {
        company = await findCompanyByName(normalizedOrder.name)
      }

      if (company) {
        const chatId = await getCompanyChatId(company.id)
        if (chatId) {
          if (!grouped[chatId]) {
            grouped[chatId] = {
              company,
              orders: [],
            }
          }
          grouped[chatId].orders.push(normalizedOrder)
        }
      }
    } catch (error) {
      console.error(`Ошибка обработки заказа ID: ${order.id}:`, error)
    }
  }

  return grouped
}

// Отправка группированных сообщений
async function sendGroupedReconciliationMessages(bot, ordersByCompany) {
  const MAX_ORDERS_PER_MESSAGE = 10

  for (const [chatId, data] of Object.entries(ordersByCompany)) {
    try {
      const { company, orders } = data
      const totalOrders = orders.length

      // Разбиваем на части если заказов много
      for (let i = 0; i < orders.length; i += MAX_ORDERS_PER_MESSAGE) {
        const chunk = orders.slice(i, i + MAX_ORDERS_PER_MESSAGE)
        const isLastChunk = i + MAX_ORDERS_PER_MESSAGE >= totalOrders

        const message = formatReconciliationMessage(chunk, company, {
          chunkIndex: Math.floor(i / MAX_ORDERS_PER_MESSAGE),
          totalChunks: Math.ceil(totalOrders / MAX_ORDERS_PER_MESSAGE),
          isLastChunk,
        })

        // Исправленный вызов метода отправки
        await bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        })
      }

      console.log(`Отправлено ${totalOrders} заказов компании ${company} (chatId: ${chatId})`)
    } catch (error) {
      console.error(`Ошибка отправки сообщений для chatId ${chatId}:`, error)
    }
  }
}

// Форматирование сообщения (остается без изменений)
function formatReconciliationMessage(orders, company, meta = {}) {
  const { chunkIndex = 0, totalChunks = 1, isLastChunk = true } = meta
  const countInfo = totalChunks > 1 ? ` (${chunkIndex + 1}/${totalChunks})` : ''

  let message = `📊 *Сверка заказов${countInfo}*\n\n`

  orders.forEach((order, index) => {
    message += `🔹 * ${chunkIndex * orders.length + index + 1}:*\n`
    message += `▸ Номер: ${order.id || '—'}\n`
    message += `▸ Дата отгрузки: ${order.date || 'не указана'}\n`
    if (order.address) {
      message += `▸ Адрес: ${order.address}\n`
    }
    message += `\n`
  })

  if (isLastChunk) {
    message += `_Всего заказов: ${orders.length * totalChunks}_\n`
    message += `_Дата отгрузки заказов является ориентировочной_`
  }

  return message
}

// Безопасная отправка сообщения
async function sendSafeMessage(bot, chatId, text) {
  try {
    await bot.telegram.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    })
  } catch (error) {
    console.error(`Ошибка отправки сообщения в чат ${chatId}:`, error)
    throw error
  }
}

// Форматирование и отправка сообщения о сверке заказов
async function sendReconciliationMessage(bot, chatId, order, company) {
  const messageText =
    `🔍 *Сверка заказов*\n\n` +
    `*Номер заказа:* ${order.id}\n` +
    `*Дата отгрузки:* ${order.date}\n\n` +
    `Пожалуйста, проверьте информацию по заказу. Дата отгрузки заказов является ориентировочной`

  try {
    await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' })
    console.log(`Сообщение о сверке отправлено в чат ${chatId}`)
    return true
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error)
    return false
  }
}

//******************************************************************************************************************************** */
//******************************************************************************************************************************** */
//******************************************************************************************************************************** */

// Функция для подсчета рабочих дней между двумя датами
// Массив праздников без указания года
const publicHolidays = [
  '01-01', // Новый год
  '01-07', // Рождество Христово
  '02-23', // День защитника Отечества
  '03-08', // Международный женский день
  '05-01', // Праздник Весны и Труда
  '05-09', // День Победы
  '06-12', // День России
  '11-04', // День народного единства
]

function getHolidaysForYear(year) {
  return publicHolidays.map((date) => `${year}-${date}`)
}

function countWorkingDays(startDate, endDate) {
  let count = 0
  let currentDate = new Date(startDate)
  const currentYear = currentDate.getFullYear()

  // Получаем праздничные даты для текущего года
  const holidayDates = getHolidaysForYear(currentYear).map((date) => new Date(date))

  while (currentDate <= endDate) {
    const day = currentDate.getDay()

    // Проверяем, является ли текущий день выходным или праздничным
    const isWeekend = day === 0 || day === 6 // Воскресенье или суббота
    const isHoliday = holidayDates.some(
      (holiday) =>
        currentDate.getFullYear() === holiday.getFullYear() &&
        currentDate.getMonth() === holiday.getMonth() &&
        currentDate.getDate() === holiday.getDate()
    )

    if (!isWeekend && !isHoliday) {
      count++
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return count
}

// Пример использования
//const startDate = new Date('2023-03-01'); // Начальная дата
//const endDate = new Date('2023-03-31'); // Конечная дата
//const workingDaysCount = countWorkingDays(startDate, endDate);

module.exports = {
  getMppByCompany,
  getMprByCompany,
  createReminder,
  getNokOrMppByCompany,
  sendRequest1C,
  getTotalPriceOrderAW,
  getOrderItemsAW,
  getCompanyDataEGRUL,
  getReclamationClose,
  initReclamationCron,
  initReconciliationCron,
  processReclamationResult,
  handleReclamationRating,
  handleRatingComment,
  getReconciliationOrders,
}
