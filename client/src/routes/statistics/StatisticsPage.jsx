import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Card,
  CardContent,
  Divider,
} from '@mui/material'
// import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers'
// import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
// import { ru } from 'date-fns/locale'
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Assessment as AssessmentIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material'
import './statisticsPage.scss'

const StatisticsPage = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState([])
  const [summaryData, setSummaryData] = useState([])
  const [stuffTypes, setStuffTypes] = useState([])
  const [activeTab, setActiveTab] = useState(0)

  // Фильтры
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    orderStatus: '',
    stuffType: '',
    materialName: '',
    year: '2025',
  })

  // Загрузка типов товаров при монтировании компонента
  useEffect(() => {
    fetchStuffTypes()
  }, [filters.year])

  const fetchStuffTypes = async () => {
    try {
      const response = await fetch(
        `http://localhost:5005/app/statistics/stuff-types/${filters.year}`
      )
      const result = await response.json()
      if (response.ok) {
        setStuffTypes(result.result || [])
      } else {
        setError(result.message || 'Ошибка загрузки типов товаров')
      }
    } catch (err) {
      setError('Ошибка подключения к серверу')
    }
  }

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const fetchStatistics = async () => {
    setLoading(true)
    setError(null)

    try {
      const requestData = {
        ...filters,
        startDate: formatDateForAPI(filters.startDate),
        endDate: formatDateForAPI(filters.endDate),
      }

      const response = await fetch('http://localhost:5005/app/statistics/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const result = await response.json()

      if (response.ok) {
        setData(result.result || [])
      } else {
        setError(result.message || 'Ошибка загрузки данных')
      }
    } catch (err) {
      setError('Ошибка подключения к серверу')
    } finally {
      setLoading(false)
    }
  }

  const fetchSummary = async () => {
    setLoading(true)
    setError(null)

    try {
      const requestData = {
        startDate: formatDateForAPI(filters.startDate),
        endDate: formatDateForAPI(filters.endDate),
        orderStatus: filters.orderStatus,
        year: filters.year,
      }

      const response = await fetch('http://localhost:5005/app/statistics/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const result = await response.json()

      if (response.ok) {
        setSummaryData(result.result || [])
      } else {
        setError(result.message || 'Ошибка загрузки сводной статистики')
      }
    } catch (err) {
      setError('Ошибка подключения к серверу')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (activeTab === 0) {
      fetchStatistics()
    } else {
      fetchSummary()
    }
  }

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue)
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU')
  }

  const formatDateForAPI = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toISOString().split('T')[0]
  }

  const formatCurrency = (amount) => {
    if (!amount) return '0 ₽'
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 3:
        return 'success'
      case 4:
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 3:
        return 'Закрыт'
      case 4:
        return 'В производстве'
      default:
        return 'Неизвестно'
    }
  }

  const exportToCSV = () => {
    const csvData = activeTab === 0 ? data : summaryData
    if (csvData.length === 0) return

    const headers =
      activeTab === 0
        ? ['Заказ', 'Изделие', 'Материал', 'Тип', 'Количество', 'Стоимость', 'Дата создания']
        : [
            'Тип материала',
            'Наименование',
            'Маркировка',
            'Количество заказов',
            'Количество изделий',
            'Общее количество',
            'Общая стоимость',
          ]

    const csvContent = [
      headers.join(','),
      ...csvData.map((row) => {
        if (activeTab === 0) {
          return [
            row.ORDERNO || '',
            row.ITEM_NAME || '',
            row.MATERIAL_NAME || '',
            row.ITEM_DESC || '',
            row.ITEM_QTY || 0,
            row.ITEM_PRICE || 0,
            formatDate(row.DATECREATED),
          ].join(',')
        } else {
          return [
            row.STUFF_TYPE || '',
            row.MATERIAL_NAME || '',
            row.MARKING || '',
            row.ORDERS_COUNT || 0,
            row.ITEMS_COUNT || 0,
            row.TOTAL_QTY || 0,
            row.TOTAL_COST || 0,
          ].join(',')
        }
      }),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `statistics_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Box className="statistics-page">
      <Paper elevation={3} className="statistics-header">
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <AssessmentIcon color="primary" fontSize="large" />
          <Typography variant="h4" component="h1">
            Статистика по заказам
          </Typography>
        </Box>

        <Typography variant="body1" color="text.secondary">
          Анализ материалов и изделий по заказам с возможностью фильтрации по датам, статусам и
          типам товаров
        </Typography>
      </Paper>

      <Paper elevation={2} className="filters-section">
        <Typography variant="h6" gutterBottom>
          Фильтры
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Дата начала"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Дата окончания"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Статус заказа</InputLabel>
              <Select
                value={filters.orderStatus}
                onChange={(e) => handleFilterChange('orderStatus', e.target.value)}
                label="Статус заказа"
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value={3}>Закрыт</MenuItem>
                <MenuItem value={4}>В производстве</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Тип товара</InputLabel>
              <Select
                value={filters.stuffType}
                onChange={(e) => handleFilterChange('stuffType', e.target.value)}
                label="Тип товара"
              >
                <MenuItem value="">Все</MenuItem>
                {stuffTypes.map((type) => (
                  <MenuItem key={type.ID} value={type.CODE}>
                    {type.NAME}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Год"
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              type="number"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Наименование материала"
              value={filters.materialName}
              onChange={(e) => handleFilterChange('materialName', e.target.value)}
              placeholder="Введите название материала для поиска"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? <CircularProgress size={20} /> : 'Поиск'}
              </Button>

              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  setFilters({
                    startDate: '',
                    endDate: '',
                    orderStatus: '',
                    stuffType: '',
                    materialName: '',
                    year: '2025',
                  })
                  setData([])
                  setSummaryData([])
                  setError(null)
                }}
              >
                Сбросить
              </Button>

              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={exportToCSV}
                disabled={data.length === 0 && summaryData.length === 0}
              >
                Экспорт CSV
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper elevation={2} className="results-section">
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab icon={<InventoryIcon />} label="Детальная статистика" iconPosition="start" />
          <Tab icon={<AssessmentIcon />} label="Сводная статистика" iconPosition="start" />
        </Tabs>

        {activeTab === 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Заказ</TableCell>
                  <TableCell>Изделие</TableCell>
                  <TableCell>Материал</TableCell>
                  <TableCell>Тип</TableCell>
                  <TableCell>Артикул</TableCell>
                  <TableCell>Размеры</TableCell>
                  <TableCell>Количество</TableCell>
                  <TableCell>Стоимость</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Дата создания</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.ORDERNO}</TableCell>
                    <TableCell>{row.ITEM_NAME}</TableCell>
                    <TableCell>{row.MATERIAL_NAME}</TableCell>
                    <TableCell>{row.ITEM_DESC}</TableCell>
                    <TableCell>{row.ITEM_ART}</TableCell>
                    <TableCell>
                      {row.W && row.H && row.L ? `${row.W}×${row.H}×${row.L}` : '-'}
                    </TableCell>
                    <TableCell>{row.ITEM_QTY}</TableCell>
                    <TableCell>{formatCurrency(row.ITEM_PRICE)}</TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusText(row.ORDERSTATUS)}
                        color={getStatusColor(row.ORDERSTATUS)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(row.DATECREATED)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Grid container spacing={2}>
            {summaryData.map((row, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {row.MATERIAL_NAME}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {row.STUFF_TYPE} • {row.MARKING}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Заказов:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {row.ORDERS_COUNT}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Изделий:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {row.ITEMS_COUNT}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Количество:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {row.TOTAL_QTY?.toFixed(2) || 0}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">Стоимость:</Typography>
                      <Typography variant="body2" fontWeight="bold" color="primary">
                        {formatCurrency(row.TOTAL_COST)}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {!loading && data.length === 0 && summaryData.length === 0 && (
          <Box textAlign="center" py={4}>
            <Typography variant="h6" color="text.secondary">
              Нет данных для отображения
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Выберите фильтры и нажмите "Поиск"
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  )
}

export default StatisticsPage
