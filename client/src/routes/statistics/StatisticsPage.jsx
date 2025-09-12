import { useState, useEffect, useCallback } from 'react'
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
  Pagination,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Tooltip,
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
  TableChart as TableChartIcon,
  ViewModule as ViewModuleIcon,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material'
import './statisticsPage.scss'

const StatisticsPage = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState([])
  const [summaryData, setSummaryData] = useState([])
  const [stuffTypes, setStuffTypes] = useState([])
  const [activeTab, setActiveTab] = useState(0)

  // Новые состояния для пагинации и видов
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalRecords: 0,
    totalPages: 0,
  })
  const [viewMode, setViewMode] = useState('table') // table, cards, analytics
  const [analyticsData, setAnalyticsData] = useState(null)

  // Фильтры
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    orderStatus: '',
    stuffType: '',
    materialName: '',
    year: '2025',
  })

  const fetchStuffTypes = useCallback(async () => {
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
  }, [filters.year])

  // Загрузка типов товаров при монтировании компонента
  useEffect(() => {
    fetchStuffTypes()
  }, [fetchStuffTypes])

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const fetchStatistics = async (page = 1, limit = 50) => {
    setLoading(true)
    setError(null)

    try {
      const requestData = {
        ...filters,
        startDate: formatDateForAPI(filters.startDate),
        endDate: formatDateForAPI(filters.endDate),
        page: page,
        limit: limit,
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
        // Обрабатываем новый формат ответа с пагинацией
        if (result.result && result.result.data) {
          setData(result.result.data || [])
          setPagination(
            result.result.pagination || {
              page: 1,
              limit: 50,
              totalRecords: 0,
              totalPages: 0,
            }
          )
          // Генерируем аналитические данные
          generateAnalyticsData(result.result.data)
        } else {
          setData(result.result || [])
          setPagination({
            page: 1,
            limit: 50,
            totalRecords: result.result?.length || 0,
            totalPages: 1,
          })
          generateAnalyticsData(result.result || [])
        }
      } else {
        setError(result.message || 'Ошибка загрузки данных')
      }
    } catch (err) {
      setError('Ошибка подключения к серверу')
    } finally {
      setLoading(false)
    }
  }

  const fetchSummary = async (page = 1, limit = 50) => {
    setLoading(true)
    setError(null)

    try {
      const requestData = {
        startDate: formatDateForAPI(filters.startDate),
        endDate: formatDateForAPI(filters.endDate),
        orderStatus: filters.orderStatus,
        year: filters.year,
        page: page,
        limit: limit,
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
        // Обрабатываем новый формат ответа с пагинацией
        if (result.result && result.result.data) {
          setSummaryData(result.result.data || [])
          setPagination(
            result.result.pagination || {
              page: 1,
              limit: 50,
              totalRecords: 0,
              totalPages: 0,
            }
          )
        } else {
          setSummaryData(result.result || [])
          setPagination({
            page: 1,
            limit: 50,
            totalRecords: result.result?.length || 0,
            totalPages: 1,
          })
        }
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
      fetchStatistics(1, pagination.limit)
    } else {
      fetchSummary(1, pagination.limit)
    }
  }

  // Функция для генерации аналитических данных
  const generateAnalyticsData = (data) => {
    if (!data || data.length === 0) {
      setAnalyticsData(null)
      return
    }

    // Группировка по типам материалов
    const materialTypes = {}
    const orders = {}
    const totalCost = data.reduce((sum, item) => sum + (item.ITEM_PRICE || 0), 0)
    const totalQuantity = data.reduce((sum, item) => sum + (item.ITEM_QTY || 0), 0)

    data.forEach((item) => {
      const type = item.ITEM_DESC || 'Неизвестно'
      const orderNo = item.ORDERNO || 'Неизвестно'

      if (!materialTypes[type]) {
        materialTypes[type] = {
          count: 0,
          cost: 0,
          quantity: 0,
          percentage: 0,
        }
      }

      if (!orders[orderNo]) {
        orders[orderNo] = {
          count: 0,
          cost: 0,
          materials: new Set(),
        }
      }

      materialTypes[type].count++
      materialTypes[type].cost += item.ITEM_PRICE || 0
      materialTypes[type].quantity += item.ITEM_QTY || 0

      orders[orderNo].count++
      orders[orderNo].cost += item.ITEM_PRICE || 0
      orders[orderNo].materials.add(type)
    })

    // Вычисляем проценты
    Object.keys(materialTypes).forEach((type) => {
      materialTypes[type].percentage =
        totalCost > 0 ? ((materialTypes[type].cost / totalCost) * 100).toFixed(1) : 0
    })

    setAnalyticsData({
      materialTypes,
      orders: Object.keys(orders).map((orderNo) => ({
        orderNo,
        ...orders[orderNo],
        materialsCount: orders[orderNo].materials.size,
      })),
      totals: {
        totalCost,
        totalQuantity,
        totalOrders: Object.keys(orders).length,
        totalMaterials: Object.keys(materialTypes).length,
      },
    })
  }

  const handlePageChange = (event, page) => {
    if (activeTab === 0) {
      fetchStatistics(page, pagination.limit)
    } else {
      fetchSummary(page, pagination.limit)
    }
  }

  const handleViewModeChange = (event, newViewMode) => {
    if (newViewMode !== null) {
      setViewMode(newViewMode)
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
      {/* Компактная шапка */}
      <Paper elevation={2} className="statistics-header">
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <AssessmentIcon color="primary" fontSize="medium" />
            <Typography variant="h5" component="h1">
              Статистика по заказам
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Анализ материалов и изделий
          </Typography>
        </Box>
      </Paper>

      {/* Компактные фильтры */}
      <Paper elevation={1} className="filters-section">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Дата начала"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Дата окончания"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Статус</InputLabel>
              <Select
                value={filters.orderStatus}
                onChange={(e) => handleFilterChange('orderStatus', e.target.value)}
                label="Статус"
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value={3}>Закрыт</MenuItem>
                <MenuItem value={4}>В производстве</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
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

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Год"
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              type="number"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Материал"
              value={filters.materialName}
              onChange={(e) => handleFilterChange('materialName', e.target.value)}
              placeholder="Поиск материала"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Box display="flex" gap={1} alignItems="center">
              <Button
                variant="contained"
                size="small"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? <CircularProgress size={16} /> : 'Поиск'}
              </Button>

              <Button
                variant="outlined"
                size="small"
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
                Сброс
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={exportToCSV}
                disabled={data.length === 0 && summaryData.length === 0}
              >
                CSV
              </Button>

              {/* Переключатель видов */}
              {activeTab === 0 && data.length > 0 && (
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={handleViewModeChange}
                  size="small"
                >
                  <ToggleButton value="table">
                    <Tooltip title="Табличный вид">
                      <TableChartIcon />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="cards">
                    <Tooltip title="Карточки">
                      <ViewModuleIcon />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="analytics">
                    <Tooltip title="Аналитика">
                      <PieChartIcon />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Основной контейнер с прокруткой */}
      <Paper elevation={2} className="results-section">
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab icon={<InventoryIcon />} label="Детальная статистика" iconPosition="start" />
          <Tab icon={<AssessmentIcon />} label="Сводная статистика" iconPosition="start" />
        </Tabs>

        {/* Контейнер с прокруткой для контента */}
        <Box
          className="content-container"
          sx={{
            height: 'calc(90vh - 400px)', // Вычитаем высоту шапки и фильтров
            overflow: 'auto',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#c1c1c1',
              borderRadius: '4px',
              '&:hover': {
                background: '#a8a8a8',
              },
            },
          }}
        >
          {activeTab === 0 ? (
            <>
              {/* Информация о пагинации */}
              {pagination.totalRecords > 0 && (
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    Показано {data.length} из {pagination.totalRecords} записей
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Страница {pagination.page} из {pagination.totalPages}
                  </Typography>
                </Box>
              )}

              {/* Условное отображение разных видов */}
              {viewMode === 'table' && (
                <TableContainer>
                  <Table stickyHeader>
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
              )}

              {viewMode === 'cards' && (
                <Grid container spacing={2}>
                  {data.map((row, index) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="start"
                            mb={1}
                          >
                            <Typography variant="h6" component="h3" noWrap>
                              {row.ORDERNO}
                            </Typography>
                            <Chip
                              label={getStatusText(row.ORDERSTATUS)}
                              color={getStatusColor(row.ORDERSTATUS)}
                              size="small"
                            />
                          </Box>

                          <Typography variant="subtitle2" color="primary" gutterBottom>
                            {row.ITEM_NAME}
                          </Typography>

                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {row.MATERIAL_NAME}
                          </Typography>

                          <Typography variant="body2" gutterBottom>
                            <strong>Тип:</strong> {row.ITEM_DESC}
                          </Typography>

                          <Typography variant="body2" gutterBottom>
                            <strong>Артикул:</strong> {row.ITEM_ART}
                          </Typography>

                          {row.W && row.H && row.L && (
                            <Typography variant="body2" gutterBottom>
                              <strong>Размеры:</strong> {row.W}×{row.H}×{row.L}
                            </Typography>
                          )}

                          <Divider sx={{ my: 1 }} />

                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2">Количество:</Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {row.ITEM_QTY}
                            </Typography>
                          </Box>

                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2">Стоимость:</Typography>
                            <Typography variant="body2" fontWeight="bold" color="primary">
                              {formatCurrency(row.ITEM_PRICE)}
                            </Typography>
                          </Box>

                          <Typography variant="caption" color="text.secondary">
                            {formatDate(row.DATECREATED)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}

              {viewMode === 'analytics' && analyticsData && (
                <Grid container spacing={3}>
                  {/* Общая статистика */}
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                          Общая статистика
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6} sm={3}>
                            <Box textAlign="center">
                              <Typography variant="h4" color="primary">
                                {analyticsData.totals.totalOrders}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Заказов
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <Box textAlign="center">
                              <Typography variant="h4" color="secondary">
                                {analyticsData.totals.totalMaterials}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Типов материалов
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <Box textAlign="center">
                              <Typography variant="h4" color="success.main">
                                {analyticsData.totals.totalQuantity.toFixed(0)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Общее количество
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <Box textAlign="center">
                              <Typography variant="h4" color="warning.main">
                                {formatCurrency(analyticsData.totals.totalCost)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Общая стоимость
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Распределение по типам материалов */}
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          <PieChartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                          Распределение по типам материалов
                        </Typography>
                        {Object.entries(analyticsData.materialTypes)
                          .sort(([, a], [, b]) => b.cost - a.cost)
                          .slice(0, 10)
                          .map(([type, data]) => (
                            <Box key={type} mb={2}>
                              <Box display="flex" justifyContent="space-between" mb={1}>
                                <Typography variant="body2" noWrap>
                                  {type}
                                </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {data.percentage}%
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={parseFloat(data.percentage)}
                                sx={{ height: 8, borderRadius: 4 }}
                              />
                              <Box display="flex" justifyContent="space-between" mt={0.5}>
                                <Typography variant="caption" color="text.secondary">
                                  {data.count} шт.
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatCurrency(data.cost)}
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Топ заказов */}
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          <BarChartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                          Топ заказов по стоимости
                        </Typography>
                        {analyticsData.orders
                          .sort((a, b) => b.cost - a.cost)
                          .slice(0, 10)
                          .map((order) => (
                            <Box key={order.orderNo} mb={2}>
                              <Box
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                mb={1}
                              >
                                <Typography variant="body2" fontWeight="bold">
                                  #{order.orderNo}
                                </Typography>
                                <Typography variant="body2" color="primary" fontWeight="bold">
                                  {formatCurrency(order.cost)}
                                </Typography>
                              </Box>
                              <Box display="flex" justifyContent="space-between">
                                <Typography variant="caption" color="text.secondary">
                                  {order.count} позиций
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {order.materialsCount} типов материалов
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}

              {/* Пагинация */}
              {pagination.totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={3}>
                  <Pagination
                    count={pagination.totalPages}
                    page={pagination.page}
                    onChange={handlePageChange}
                    color="primary"
                    size="large"
                  />
                </Box>
              )}
            </>
          ) : (
            <>
              {/* Информация о пагинации для сводной статистики */}
              {pagination.totalRecords > 0 && (
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    Показано {summaryData.length} из {pagination.totalRecords} записей
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Страница {pagination.page} из {pagination.totalPages}
                  </Typography>
                </Box>
              )}

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

              {/* Пагинация для сводной статистики */}
              {activeTab === 1 && pagination.totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={3}>
                  <Pagination
                    count={pagination.totalPages}
                    page={pagination.page}
                    onChange={handlePageChange}
                    color="primary"
                    size="large"
                  />
                </Box>
              )}
            </>
          )}

          {!loading && data.length === 0 && summaryData.length === 0 && (
            <Box textAlign="center" py={4}>
              <Typography variant="h6" color="text.secondary">
                Нет данных для отображения
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Выберите фильтры и нажмите &quot;Поиск&quot;
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  )
}

export default StatisticsPage
