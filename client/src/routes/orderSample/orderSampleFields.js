export const ORDER_STATUSES = [
  { id: 0, name: 'Создан' },
  { id: 4, name: 'В производстве' },
  { id: 3, name: 'Закрыт' },
]

export const PROFILE_MATERIALS = [
  { id: 0, name: 'Пластик' },
  { id: 1, name: 'Алюминий' },
  { id: 2, name: 'Дерево' },
]

export const GLASS_SHAPES = [
  { id: 0, name: 'Прямоугольное' },
  { id: 1, name: 'Косоугольное' },
  { id: 2, name: 'Арочное' },
  { id: 3, name: 'Косоугольное арочное' },
]

export const YES_NO = [
  { id: 1, name: 'Есть' },
  { id: 0, name: 'Нет' },
]

export const SEARCH_FIELDS = [
  { id: 'profile', label: 'Система профиля', group: 'Изделие', input: 'catalog', catalog: 'profiles' },
  { id: 'furniture', label: 'Система фурнитуры', group: 'Изделие', input: 'catalog', catalog: 'furniture' },
  { id: 'profileMaterial', label: 'Материал профиля', group: 'Изделие', input: 'choice', choices: PROFILE_MATERIALS },
  { id: 'profileBase', label: 'Основа профиля', group: 'Изделие', input: 'catalog', catalog: 'bases' },
  { id: 'itemType', label: 'Вид изделия', group: 'Изделие', input: 'catalog', catalog: 'itemTypes' },
  { id: 'colorIn', label: 'Цвет изделия внутри', group: 'Изделие', input: 'catalog', catalog: 'colors' },
  { id: 'colorOut', label: 'Цвет изделия снаружи', group: 'Изделие', input: 'catalog', catalog: 'colors' },
  { id: 'sashCount', label: 'Число створок', group: 'Изделие', input: 'range' },
  { id: 'width', label: 'Ширина', group: 'Изделие', input: 'range' },
  { id: 'height', label: 'Высота', group: 'Изделие', input: 'range' },
  { id: 'area', label: 'Площадь', group: 'Изделие', input: 'range' },
  { id: 'weight', label: 'Масса', group: 'Изделие', input: 'range' },
  { id: 'itemName', label: 'Название позиции', group: 'Изделие', input: 'text' },
  { id: 'article', label: 'Артикул', group: 'Комплектующее', input: 'text' },
  { id: 'internalArticle', label: 'Внутренний артикул', group: 'Комплектующее', input: 'text' },
  { id: 'componentName', label: 'Название компонента', group: 'Комплектующее', input: 'text' },
  { id: 'componentType', label: 'Тип компонента', group: 'Комплектующее', input: 'catalog', catalog: 'stuffTypes' },
  { id: 'componentColorIn', label: 'Цвет компонента внутри', group: 'Комплектующее', input: 'catalog', catalog: 'colors' },
  { id: 'componentColorOut', label: 'Цвет компонента снаружи', group: 'Комплектующее', input: 'catalog', catalog: 'colors' },
  { id: 'beamLength', label: 'Длина балки', group: 'Комплектующее', input: 'range' },
  { id: 'radius', label: 'Радиус балки', group: 'Комплектующее', input: 'range' },
  { id: 'radiusOnly', label: 'Только балки с радиусом', group: 'Комплектующее', input: 'flag' },
  { id: 'cutAngle', label: 'Угол спила', group: 'Комплектующее', input: 'range' },
  { id: 'beamMark', label: 'Маркировка балки', group: 'Комплектующее', input: 'text' },
  { id: 'part', label: 'Часть изделия', group: 'Комплектующее', input: 'text' },
  { id: 'side', label: 'Сторона изделия', group: 'Комплектующее', input: 'text' },
  { id: 'connection', label: 'Соединение концов', group: 'Комплектующее', input: 'text' },
  { id: 'glassFormula', label: 'Формула стеклопакета', group: 'Стеклопакет', input: 'text' },
  { id: 'glassFormulaName', label: 'Наименование по формуле', group: 'Стеклопакет', input: 'text' },
  { id: 'glassSystem', label: 'Система заполнения', group: 'Стеклопакет', input: 'catalog', catalog: 'glassSystems' },
  { id: 'glassShape', label: 'Форма заполнения', group: 'Стеклопакет', input: 'choice', choices: GLASS_SHAPES },
  { id: 'shprosses', label: 'Шпросы', group: 'Стеклопакет', input: 'choice', choices: YES_NO },
  { id: 'glassThick', label: 'Толщина стеклопакета', group: 'Стеклопакет', input: 'range' },
  { id: 'chambers', label: 'Число камер', group: 'Стеклопакет', input: 'range' },
]

export const fieldById = (id) => SEARCH_FIELDS.find((field) => field.id === id)

export const fieldGroups = () => {
  const groups = []
  SEARCH_FIELDS.forEach((field) => {
    let group = groups.find((item) => item.title === field.group)
    if (!group) {
      group = { title: field.group, fields: [] }
      groups.push(group)
    }
    group.fields.push(field)
  })
  return groups
}
