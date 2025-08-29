// Статические ресурсы
import forestSummerBg from '../../src/assets/board/forest-summer.jpg'
import winterBg from '../../src/assets/board/winter.jpg'
import newYearBg from '../../src/assets/board/newYear.jpg'
import springBg from '../../src/assets/board/spring.jpg'
import summerBg from '../../src/assets/board/summer.jpg'
import autumnBg from '../../src/assets/board/autumn.jpg'

export function getSeasonBackground() {
  const month = new Date().getMonth() // Получаем текущий месяц (0-11)

  if (month === 0) {
    return newYearBg // Январь
  } else if (month === 11 || month === 1) {
    return winterBg // Зима (декабрь, февраль)
  } else if (month >= 2 && month <= 4) {
    return springBg // Весна
  } else if (month === 5 || month === 6) {
    return springBg // Лето (июнь, июль)
  } else if (month === 7) {
    return springBg // Август
  } else {
    return autumnBg // Осень (сентябрь, октябрь, ноябрь)
  }
}
