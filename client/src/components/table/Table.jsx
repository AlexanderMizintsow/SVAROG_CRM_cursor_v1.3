import { DataGrid } from '@mui/x-data-grid'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { font } from '../../assets/fonts/Roboto-Regular-normal.js'
import { RiFileExcel2Line } from 'react-icons/ri'
import { BsFiletypePdf } from 'react-icons/bs'
import './table.scss'

const Table = ({
  columns,
  rows,
  checkboxSelection,
  disableSelectionOnClick,
  disableRowSelectionOnClick,
  exports,
  onRowClick, // Принимаем обработчик клика по строке как пропс
  cursor,
}) => {
  const exportToPdf = (rows, columns) => {
    const doc = new jsPDF()
    doc.addFileToVFS('Roboto-Regular.ttf', font)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    doc.setFont('Roboto')

    const tableColumnNames = columns.map((column) => column.headerName)
    const tableRows = rows.map((row) =>
      columns.map((column) => String(row[column.field]))
    )
    const columnStyles = {
      0: { cellWidth: 'wrap', minCellWidth: 20 },
    }
    doc.autoTable({
      head: [tableColumnNames],
      body: tableRows,
      styles: { font: 'Roboto' },
      columnStyles: columnStyles,
    })

    doc.save('table.pdf')
  }

  const exportToExcel = (rows, columns) => {
    const worksheet = XLSX.utils.json_to_sheet(
      rows.map((row) => {
        let newRow = {}
        columns.forEach((column) => {
          newRow[column.headerName] = row[column.field]
        })
        return newRow
      })
    )
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
    XLSX.writeFile(workbook, 'table.xlsx')
  }

  return (
    <div style={{ height: '100%', width: '100%' }}>
      {exports && (
        <>
          <RiFileExcel2Line
            className="export"
            onClick={() => exportToExcel(rows, columns)}
          />
          <BsFiletypePdf
            className="export"
            onClick={() => exportToPdf(rows, columns)}
          />
        </>
      )}
      <DataGrid
        rows={rows}
        style={{ cursor: cursor ? 'pointer' : '' }} // Применяем стиль курсора
        columns={columns.map((column) => ({
          ...column,
          headerClassName: 'custom-header',
          cellClassName: 'custom-cell',
        }))}
        hideFooterPagination
        checkboxSelection={checkboxSelection}
        disableSelectionOnClick={disableSelectionOnClick}
        disableRowSelectionOnClick={disableRowSelectionOnClick}
        onRowClick={onRowClick} // Добавляем обработчик клика
      />
    </div>
  )
}

export default Table
