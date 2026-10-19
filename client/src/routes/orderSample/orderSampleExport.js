import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { font } from '../../assets/fonts/Roboto-Regular-normal.js'

const COLUMNS = [
  { header: 'Наименование', value: (row) => row.orderName },
  { header: 'Номер', value: (row) => row.orderNumber },
  { header: 'Менеджер', value: (row) => row.managerName },
  { header: 'Дата', value: (row) => row.dateLabel },
  { header: 'Статус', value: (row) => row.statusLabel },
  { header: 'Изделие', value: (row) => row.itemName },
  { header: 'Профиль', value: (row) => row.profileName },
  { header: 'Фурнитура', value: (row) => row.furnitureName },
  { header: 'Цвет внутри', value: (row) => row.colorIn },
  { header: 'Цвет снаружи', value: (row) => row.colorOut },
  { header: 'Ширина', value: (row) => row.width ?? '' },
  { header: 'Высота', value: (row) => row.height ?? '' },
  { header: 'Створки', value: (row) => row.sashCount ?? '' },
]

export const flattenOrders = (orders, formatDate) =>
  orders.flatMap((order) => {
    const head = {
      orderName: order.orderName || '',
      orderNumber: order.orderNumber,
      managerName: order.managerName || '',
      dateLabel: formatDate(order.dateCreated),
      statusLabel: order.statusLabel,
      itemName: '',
      profileName: '',
      furnitureName: '',
      colorIn: '',
      colorOut: '',
      width: '',
      height: '',
      sashCount: '',
    }
    if (!order.items?.length) return [head]
    return order.items.map((item) => ({
      ...head,
      itemName: item.itemName,
      profileName: item.profileName,
      furnitureName: item.furnitureName,
      colorIn: item.colorIn,
      colorOut: item.colorOut,
      width: item.width ?? '',
      height: item.height ?? '',
      sashCount: item.sashCount ?? '',
    }))
  })

export const exportOrdersExcel = (rows) => {
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((row) => {
      const record = {}
      COLUMNS.forEach((column) => {
        record[column.header] = column.value(row)
      })
      return record
    })
  )
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Выборка')
  XLSX.writeFile(book, 'выборка_заказов.xlsx')
}

export const exportOrdersPdf = (rows) => {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.addFileToVFS('Roboto-Regular.ttf', font)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.setFont('Roboto')
  doc.setFontSize(14)
  doc.text('Выборка заказов', 14, 12)
  doc.autoTable({
    startY: 18,
    head: [COLUMNS.map((column) => column.header)],
    body: rows.map((row) => COLUMNS.map((column) => String(column.value(row) ?? ''))),
    styles: { font: 'Roboto', fontSize: 8 },
    headStyles: { fillColor: [47, 111, 237] },
  })
  doc.save('выборка_заказов.pdf')
}
