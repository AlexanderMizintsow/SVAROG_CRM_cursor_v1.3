const fs = require('fs')
const path = require('path')
const { handleCancel } = require('../../helpers/buttonCancel')

async function handleConsultation(bot, chatId, userSessions) {
  userSessions[chatId] = userSessions[chatId] || {}
  // Удаляем предыдущее сообщение при выборе расчета
  if (userSessions[chatId].lastMessageId) {
    try {
      await bot.deleteMessage(chatId, userSessions[chatId].lastMessageId)
    } catch (error) {
      console.error(`Не удалось удалить сообщение: ${error.message}`)
    }
  }

  const message = await bot.sendMessage(chatId, 'Выберите действие:', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🖥️ Как считать? (видео)',
            callback_data: '/consultation_how_calculate',
          },
          /*    {
            text: '🛒 Ассортимент',
            callback_data: '/consultation_assortment',
          },*/
        ],
        [{ text: '❌ Отмена', callback_data: '/cancel' }],
      ],
    },
  })

  // Сохраняем идентификатор сообщения о расчетах
  userSessions[chatId] = userSessions[chatId] || {}
  userSessions[chatId].lastMessageId = message.message_id

  return message
}

async function handleConsultationCalculate(bot, chatId, msg, userSessions) {
  const keyboard = [
    [
      {
        text: 'Вводная часть. 1. Начало работы с Альтавином.',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/1%20Вводная%20часть%20Начало.mp4',
      },
    ],
    [
      {
        text: 'Вводная часть 2.',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/1_1%20Вводная%20часть%20Конец.mp4',
      },
    ],
    [
      {
        text: 'Расчет раскладки и фальш-переплета',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/11%20Раскладка%20и%20фальш.mp4',
      },
    ],
    [
      {
        text: 'Расчет балконного блока',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/2%20Балконный%20блок.mp4',
      },
    ],
    [
      {
        text: 'Расчет лоджии',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/3%20Лоджия.mp4',
      },
    ],
    [
      {
        text: 'Расчет стеклопакета',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/6%20Стеклопакет%20отдельный.mp4',
      },
    ],
    [
      {
        text: 'Расчет алюминиевых дверей',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/Алюминиевые%20двери.mp4',
      },
    ],
    [
      {
        text: 'Расчет дверей',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/Двери.mp4',
      },
    ],
    [
      {
        text: 'Расчет окна',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/Окно.mp4',
      },
    ],
    [
      {
        text: 'Расчет раздвижки Проведаль',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/Проведаль.mp4',
      },
    ],
    [
      {
        text: 'Расчет москитной сетки',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/Москитная%20сеткa.mp4',
      },
    ],
    [
      {
        text: 'Расчет створки в створке',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/Створка%20в%20створке%20(2).mp4',
      },
    ],
    [
      {
        text: 'Расчет створки',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/Створка.mp4',
      },
    ],
    [
      {
        text: 'Расчет стеклопакета',
        url: 'https://disk.yandex.ru/d/JHU0Xx4VFLywZw/Стеклопакет%20новый.mp4',
      },
    ],
    [{ text: '❌ Отмена', callback_data: '/cancel' }],
  ]

  const options = {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  }

  await bot.sendMessage(chatId, 'Выберите видео для просмотра:', options)
  // userSessions[chatId].consultationVideo = true
}

/*async function handleConsultationCalculate(bot, chatId, msg, userSessions) {
  if (!userSessions[chatId].consultationVideo) {
    const keyboard = [
      [
        {
          text: 'Вводная часть. 1. Начало работы с Альтавином.',
          callback_data: '/introduction_1',
        },
      ],
      [{ text: 'Вводная часть 2.', callback_data: '/introduction_2' }],
      [
        {
          text: 'Расчет раскладки и фальш-переплета',
          callback_data: '/layout_calculation',
        },
      ],
      [
        {
          text: 'Расчет балконного блока',
          callback_data: '/balcony_calculation',
        },
      ],
      [{ text: 'Расчет лоджии', callback_data: '/loggia_calculation' }],
      [{ text: 'Расчет стеклопакета', callback_data: '/glazing_calculation' }],
      [
        {
          text: 'Расчет алюминиевых дверей',
          callback_data: '/aluminum_doors_calculation',
        },
      ],
      [{ text: 'Расчет дверей', callback_data: '/doors_calculation' }],
      [{ text: 'Расчет окна', callback_data: '/window_calculation' }],
      [
        {
          text: 'Расчет раздвижки Проведаль',
          callback_data: '/sliding_calculation',
        },
      ],
      [
        {
          text: 'Расчет москитной сетки',
          callback_data: '/mosquito_net_calculation',
        },
      ],
      [
        {
          text: 'Расчет створки в створке',
          callback_data: '/sash_in_sash_calculation',
        },
      ],
      [{ text: 'Расчет створки', callback_data: '/sash_calculation' }],
      [{ text: 'Расчет стеклопакета', callback_data: '/glazed_calculation' }],
    ]

    const options = {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }

    await bot.sendMessage(chatId, 'Выберите видео для просмотра:', options)
    userSessions[chatId].consultationVideo = true
  }

  // Обработка выбранного видео
  if (userSessions[chatId].consultationVideo) {
    switch (msg) {
      case '/introduction_1':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/1%20Вводная%20часть%20Начало.mp4' // Вводная часть 1.
        )
        break
      case '/introduction_2':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/1_1%20Вводная%20часть%20Конец.mp4' // Вводная часть 2.
        )
        break
      case '/layout_calculation':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/11%20Раскладка%20и%20фальш.mp4' //Расчет раскладки и фальш-переплета
        )
        break
      case '/balcony_calculation':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/2%20%D0%91%D0%B0%D0%BB%D0%BA%D0%BE%D0%BD%D0%BD%D1%8B%D0%B8%CC%86%20%D0%B1%D0%BB%D0%BE%D0%BA.mp4' // Расчет балконного блока
        )
        break
      case '/loggia_calculation':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/3%20%D0%9B%D0%BE%D0%B4%D0%B6%D0%B8%D1%8F.mp4' // Расчет лоджии
        )
        break
      case '/glazing_calculation':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/6%20%D0%A1%D1%82%D0%B5%D0%BA%D0%BB%D0%BE%D0%BF%D0%B0%D0%BA%D0%B5%D1%82%20%D0%BE%D1%82%D0%B4%D0%B5%D0%BB%D1%8C%D0%BD%D1%8B%D0%B8%CC%86.mp4' // Расчет стеклопакета
        )
        break
      case '/aluminum_doors_calculation':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/%D0%90%D0%BB%D1%8E%D0%BC%D0%B8%D0%BD%D0%B8%D0%BD%D0%B8%D0%B2%D1%8B%D0%B5%20%D0%B4%D0%B2%D0%B5%D1%80%D0%B8.mp4' // Расчет алюминиевых дверей
        )
        break
      case '/doors_calculation':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/%D0%94%D0%B2%D0%B5%D1%80%D0%B8.mp4' // Расчет дверей
        )
        break
      case '/window_calculation':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/%D0%9E%D0%BA%D0%BD%D0%BE.mp4' // Расчет окна
        )
        break
      case '/sliding_calculation':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/%D0%9F%D1%80%D0%BE%D0%B2%D0%B5%D0%B4%D0%B0%D0%BB%D1%8C.mp4' //Расчет раздвижки Проведаль
        )
        break
      case '/mosquito_net_calculation':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/%D0%9C%D0%A1%20%D0%BD%D0%BE%D0%B2%D1%8B%D0%B8%CC%86.mp4' // Расчет москитной сетки
        )
        break
      case '/sash_in_sash_calculation':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/%D0%A1%D1%82%D0%B2%D0%BE%D1%80%D0%BA%D0%B0%20%D0%B2%20%D1%81%D1%82%D0%B2%D0%BE%D1%80%D0%BA%D0%B5%20(2).mp4' // Расчет створки в створке
        )
        break
      case '/sash_calculation':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/%D0%A1%D1%82%D0%B2%D0%BE%D1%80%D0%BA%D0%B0.mp4' // Расчет створки
        )
        break
      case '/glazed_calculation':
        await bot.sendMessage(
          chatId,
          'Ссылка: https://disk.yandex.ru/d/JHU0Xx4VFLywZw/%D0%A1%D1%82%D0%B5%D0%BA%D0%BB%D0%BE%D0%BF%D0%B0%D0%BA%D0%B5%D1%82%20%D0%BD%D0%BE%D0%B2%D1%8B%D0%B8%CC%86.mp4' // Расчет створки
        )
        break
    }
  }
}*/

/*async function handleConsultationCalculate(bot, chatId, msg, userSessions) {
  if (!userSessions[chatId].consultationVideo) {
    const directoryPath = path.join(__dirname, 'videos')
    const keyboard = []

    fs.readdir(directoryPath, async (err, files) => {
      if (err) {
        console.error('Ошибка при чтении папки:', err)
        await bot.sendMessage(
          chatId,
          'Ошибка: не удалось прочитать папку с видео.'
        )
        return
      }

      const videoFiles = files.filter((file) => file.endsWith('.mp4'))
      for (const file of videoFiles) {
        console.log(file)
        keyboard.push([{ text: file, callback_data: file }])
      }

      if (keyboard.length === 0) {
        await bot.sendMessage(chatId, 'Нет доступных видеофайлов.')
        return
      }

      const options = {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      }

      await bot.sendMessage(chatId, 'Выберите видео для просмотра:', options)
      userSessions[chatId].consultationVideo = true
      return
    })
  }

  if (userSessions[chatId].consultationVideo) {
    console.log('msg1', msg)
    userSessions[chatId].consultationVideo = false
    const fileName = msg
    const localFilePath = path.join(__dirname, 'videos', fileName)

    console.log('Полный путь к видеофайлу:', localFilePath)
    fs.access(localFilePath, fs.constants.F_OK, (err) => {
      if (err) {
        handleCancel(bot, chatId, userSessions)
        console.error('Файл не найден:', err)
      } else {
        console.log('Файл доступен.')
      }
    })

    try {
      await bot.sendMessage(chatId, 'Ожидайте загрузку видео файла')
      await bot.sendVideo(chatId, localFilePath)

      console.log('Видео отправлено.')
    } catch (error) {
      console.error('Ошибка при отправке видео:', error.message, error.stack)
      await bot.sendMessage(
        chatId,
        'Ошибка при отправке видео: ' + error.message
      )
      handleCancel(bot, chatId, userSessions)
    }
  }
}*/

module.exports = {
  handleConsultation,
  handleConsultationCalculate,
}
