require('dotenv').config()
const express = require('express')
const Firebird = require('node-firebird')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 5005

app.use(cors())
app.use(express.json())

const dbOptions = {
  host: process.env.DB_HOST, // или 'localhost'
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  lowercase_keys: false,
  role: null,
  pageSize: 4096,
}

// Функция для получения настроек БД по году
function getDbOptions(year) {
  if (!year) return dbOptions // если год не указан - используем БД по умолчанию

  const yearDbVar = `DB_DATABASE_${year}`
  if (process.env[yearDbVar]) {
    return {
      ...dbOptions,
      database: process.env[yearDbVar],
    }
  }
  return dbOptions // если для указанного года нет отдельной переменной - используем БД по умолчанию
}

// Новый маршрут для получения наименований элементов в заказе
app.get('/app/order/items/:orderNo/:inn/:year?', (req, res) => {
  const orderNo = req.params.orderNo
  const inn = req.params.inn
  const year = req.params.year // может быть undefined

  // Получаем настройки БД в зависимости от года
  const currentDbOptions = getDbOptions(year)

  Firebird.attach(currentDbOptions, (err, db) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ message: 'Ошибка подключения к базе данных' })
    }

    console.log(
      `Executing query with ORDERNO: ${orderNo}, INN: ${inn}, YEAR: ${year || 'default (2025)'}`
    )

    const query = `
      SELECT oi.name 
      FROM orders o 
      JOIN customers c ON c.customerid = o.customerid 
      JOIN contragents ca ON ca.contragid = c.contragid 
      JOIN orderitems oi ON o.orderid = oi.orderid 
      WHERE o.AGREEMENTNO = ? AND ca.INN = ? AND oi.name <> 'goods'
      ORDER BY oi.name
    `

    db.query(query, [orderNo, inn], (err, result) => {
      if (err) {
        console.error('Database query error:', err)
        return res.status(500).json({ message: 'Ошибка выполнения запроса' })
      }

      if (result.length === 0) {
        return res.status(200).json({ message: 'Данный заказ не был найден.' })
      }
      console.log(result)

      res.json({ result })

      db.detach()
    })
  })
})

// Новый маршрут для получения TOTALPRICE из заказа
app.get('/app/totalprice/:orderNo/:inn/:isButton?', (req, res) => {
  const orderNo = req.params.orderNo.replace(/^0+/, '')
  const inn = req.params.inn
  const isButton = req.params.isButton === 'true' // Преобразование строки в булевый тип

  Firebird.attach(dbOptions, (err, db) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ message: 'Ошибка подключения к базе данных' })
    }

    let query
    const queryParams = [`%${orderNo}%`, inn] // По умолчанию для частичного совпадения

    if (isButton) {
      // Если isButton true, то используем полное совпадение
      query = `
        SELECT o.TOTALPRICE, o.ORDERNO  
        FROM orders o 
        JOIN customers c ON c.customerid = o.customerid 
        JOIN contragents ca ON ca.contragid = c.contragid 
        WHERE UPPER(o.ORDERNO) = UPPER(?) 
        AND ca.INN = ?
        AND o.deleted = 0`
      queryParams[0] = orderNo // Изменяем на полное совпадение
    } else {
      // Частичное совпадение
      query = `
        SELECT o.TOTALPRICE, o.ORDERNO  
        FROM orders o 
        JOIN customers c ON c.customerid = o.customerid 
        JOIN contragents ca ON ca.contragid = c.contragid 
        WHERE UPPER(o.ORDERNO) LIKE UPPER(?) 
        AND ca.INN = ?
        AND o.deleted = 0`
    }

    db.query(query, queryParams, (err, result) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ message: 'Ошибка выполнения запроса' })
      }

      if (result.length === 0) {
        return res.status(404).json({ message: 'Заказ или контрагент не найден' })
      }

      console.log(`Найдено заказов: ${result.length}`)
      if (result.length > 1) {
        // Если найдено несколько заказов
        return res.json(result)
      }

      // Если найден только один заказ
      const totalPrice = result[0].TOTALPRICE
      res.json({ totalPrice })
    })
  })
})

// Запуск сервера
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
