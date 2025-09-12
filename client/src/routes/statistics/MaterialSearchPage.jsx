import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Chip,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Divider,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Pagination,
} from '@mui/material'
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  FilterList as FilterListIcon,
  Assignment as AssignmentIcon,
  Inventory as InventoryIcon,
  Build as BuildIcon,
  Info as InfoIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { debounce } from 'lodash'
import axios from 'axios'
import { API_BASE_URL } from '../../../config.js'
import './materialSearchPage.scss'

const MaterialSearchPage = () => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    orderStatus: '',
    stuffType: '',
    materialName: '',
    materialMarking: '',
    orderNumber: '',
    year: new Date().getFullYear().toString(),
  })

  const [stuffTypes, setStuffTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [expandedOrders, setExpandedOrders] = useState(new Set())
  const [expandedItems, setExpandedItems] = useState(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [orderDetails, setOrderDetails] = useState(new Map()) // Кэш деталей заказов
  const [loadingDetails, setLoadingDetails] = useState(new Set()) // Загружающиеся детали
  const [orderMaterialsStats, setOrderMaterialsStats] = useState(new Map()) // Кэш статистики по материалам заказов
  const [loadingMaterialsStats, setLoadingMaterialsStats] = useState(new Set()) // Загружающаяся статистика

  // Состояние для мини-окошка поиска заказов
  const [orderSearchOpen, setOrderSearchOpen] = useState(false)
  const [orderSearchQuery, setOrderSearchQuery] = useState('')
  const [orderSearchResults, setOrderSearchResults] = useState([])
  const [loadingOrderSearch, setLoadingOrderSearch] = useState(false)

  // Загрузка типов товаров
  const fetchStuffTypes = useCallback(async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}5005/app/statistics/stuff-types/${filters.year}`
      )
      setStuffTypes(response.data.result || [])
    } catch (err) {
      console.error('Error fetching stuff types:', err)
    }
  }, [filters.year])

  // Поиск материалов (оптимизированная версия)
  const searchMaterials = useCallback(
    async (page = 1) => {
      setLoading(true)
      setError('')

      try {
        // Создаем чистый объект фильтров без DOM элементов
        const cleanFilters = {
          startDate: String(filters.startDate || ''),
          endDate: String(filters.endDate || ''),
          orderStatus: String(filters.orderStatus || ''),
          stuffType: String(filters.stuffType || ''),
          materialName: String(filters.materialName || ''),
          materialMarking: String(filters.materialMarking || ''),
          orderNumber: String(filters.orderNumber || ''),
          year: String(filters.year || ''),
          page: Number(page) || 1,
          limit: 50, // Уменьшили лимит для лучшей производительности
        }

        console.log('Sending filters:', cleanFilters)

        // Используем оптимизированный эндпоинт
        const response = await axios.post(
          `${API_BASE_URL}5005/app/statistics/orders-with-materials`,
          cleanFilters
        )
        const result = response.data

        if (page === 1) {
          // Первая страница - заменяем данные
          setData(result.result)
        } else {
          // Последующие страницы - добавляем к существующим, избегая дублирования
          setData((prevData) => {
            const existingOrderIds = new Set((prevData?.orders || []).map((order) => order.ORDERID))
            const newOrders = result.result.orders.filter(
              (order) => !existingOrderIds.has(order.ORDERID)
            )

            return {
              ...result.result,
              orders: [...(prevData?.orders || []), ...newOrders],
            }
          })
        }
        setCurrentPage(page)
      } catch (err) {
        setError(err.message)
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  // Загрузка статистики по материалам заказа
  const loadOrderMaterialsStats = useCallback(
    async (orderId) => {
      try {
        const cleanFilters = {
          startDate: String(filters.startDate || ''),
          endDate: String(filters.endDate || ''),
          orderStatus: String(filters.orderStatus || ''),
          stuffType: String(filters.stuffType || ''),
          materialName: String(filters.materialName || ''),
          materialMarking: String(filters.materialMarking || ''),
          orderNumber: String(filters.orderNumber || ''),
          year: String(filters.year || ''),
        }

        setLoadingMaterialsStats((prev) => new Set(prev).add(orderId))

        const response = await axios.post(
          `${API_BASE_URL}5005/app/statistics/order-materials/${orderId}`,
          cleanFilters
        )
        setOrderMaterialsStats((prev) => new Map(prev).set(orderId, response.data.result))
      } catch (err) {
        console.error('Error loading order materials stats:', err)
        setError('Ошибка загрузки статистики по материалам')
      } finally {
        setLoadingMaterialsStats((prev) => {
          const newSet = new Set(prev)
          newSet.delete(orderId)
          return newSet
        })
      }
    },
    [filters]
  )

  // Загрузка детальной информации по заказу
  const loadOrderDetails = useCallback(
    async (orderId) => {
      try {
        const cleanFilters = {
          startDate: String(filters.startDate || ''),
          endDate: String(filters.endDate || ''),
          orderStatus: String(filters.orderStatus || ''),
          stuffType: String(filters.stuffType || ''),
          materialName: String(filters.materialName || ''),
          materialMarking: String(filters.materialMarking || ''),
          orderNumber: String(filters.orderNumber || ''),
          year: String(filters.year || ''),
        }

        const response = await axios.post(
          `${API_BASE_URL}5005/app/statistics/order-details/${orderId}`,
          cleanFilters
        )
        return response.data.result
      } catch (err) {
        console.error('Order details error:', err)
        throw err
      }
    },
    [filters]
  )

  // Сброс фильтров
  const resetFilters = useCallback(() => {
    setFilters({
      startDate: '',
      endDate: '',
      orderStatus: '',
      stuffType: '',
      materialName: '',
      materialMarking: '',
      orderNumber: '',
      year: new Date().getFullYear().toString(),
    })
    setData(null)
    setError('')
    setCurrentPage(1)
  }, [])

  // Поиск заказов по номеру
  const searchOrders = useCallback(
    async (query) => {
      if (!query || query.trim().length < 2) {
        setOrderSearchResults([])
        return
      }

      try {
        setLoadingOrderSearch(true)
        const cleanFilters = {
          startDate: String(filters.startDate || ''),
          endDate: String(filters.endDate || ''),
          orderStatus: String(filters.orderStatus || ''),
          stuffType: String(filters.stuffType || ''),
          materialName: String(filters.materialName || ''),
          materialMarking: String(filters.materialMarking || ''),
          year: String(filters.year || ''),
        }

        const response = await axios.post(`${API_BASE_URL}5005/app/statistics/search-orders`, {
          ...cleanFilters,
          orderNumber: query.trim(),
        })

        setOrderSearchResults(response.data.result || [])
      } catch (err) {
        console.error('Error searching orders:', err)
        setOrderSearchResults([])
      } finally {
        setLoadingOrderSearch(false)
      }
    },
    [filters]
  )

  // Debounced поиск заказов
  const debouncedSearchOrders = useMemo(
    () =>
      debounce((query) => {
        searchOrders(query)
      }, 300),
    [searchOrders]
  )

  // Фильтр по конкретному заказу
  const filterByOrder = useCallback((orderNumber) => {
    setFilters((prev) => ({
      ...prev,
      orderNumber: orderNumber,
      materialName: '',
      materialMarking: '',
    }))
    setCurrentPage(1)
    setOrderSearchOpen(false)
    setOrderSearchQuery('')
    setOrderSearchResults([])
  }, [])

  // Переключение развернутости заказа
  const toggleOrderExpansion = useCallback(
    async (orderId) => {
      setExpandedOrders((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(orderId)) {
          newSet.delete(orderId)
        } else {
          newSet.add(orderId)
          // Загружаем детали заказа и статистику по материалам при первом раскрытии
          if (!orderDetails.has(orderId) && !loadingDetails.has(orderId)) {
            setLoadingDetails((prev) => new Set(prev).add(orderId))
            loadOrderDetails(orderId)
              .then((details) => {
                setOrderDetails((prev) => new Map(prev).set(orderId, details))
              })
              .catch((err) => {
                console.error('Failed to load order details:', err)
              })
              .finally(() => {
                setLoadingDetails((prev) => {
                  const newSet = new Set(prev)
                  newSet.delete(orderId)
                  return newSet
                })
              })
          }

          // Загружаем статистику по материалам заказа
          if (!orderMaterialsStats.has(orderId) && !loadingMaterialsStats.has(orderId)) {
            loadOrderMaterialsStats(orderId)
          }
        }
        return newSet
      })
    },
    [
      orderDetails,
      loadingDetails,
      loadOrderDetails,
      orderMaterialsStats,
      loadingMaterialsStats,
      loadOrderMaterialsStats,
    ]
  )

  // Переключение развернутости изделия
  const toggleItemExpansion = useCallback((itemId) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }, [])

  // Загрузка типов товаров при изменении года
  useEffect(() => {
    fetchStuffTypes()
  }, [fetchStuffTypes])

  // Статистика поиска
  const searchStats = useMemo(() => {
    if (!data) return null

    return {
      totals: data.totals,
      materials: data.materials,
      grouping: data.grouping,
    }
  }, [data])

  // Получение цвета статуса заказа
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

  // Получение текста статуса заказа
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

  return (
    <Box className="material-search-page">
      {/* Заголовок */}
      <Paper className="search-header" elevation={2} sx={{ py: 1.5 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <SearchIcon color="primary" />
          <Box>
            <Typography variant="h6" component="h1">
              Поиск материалов в заказах
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Найдите заказы и изделия по материалам, артикулам или номерам заказов
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Фильтры */}
      <Paper className="filters-section" elevation={1} sx={{ py: 1.5 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1.5}>
          <FilterListIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={500}>
            Фильтры поиска
          </Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Дата начала"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
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
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Статус заказа</InputLabel>
              <Select
                value={filters.orderStatus}
                onChange={(e) => setFilters((prev) => ({ ...prev, orderStatus: e.target.value }))}
                label="Статус заказа"
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="3">Закрыт</MenuItem>
                <MenuItem value="4">В производстве</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Тип товара</InputLabel>
              <Select
                value={filters.stuffType}
                onChange={(e) => setFilters((prev) => ({ ...prev, stuffType: e.target.value }))}
                label="Тип товара"
              >
                <MenuItem value="">Все</MenuItem>
                {stuffTypes.map((type) => (
                  <MenuItem key={type.ID} value={type.ID}>
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
              label="Год БД"
              value={filters.year}
              onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 1.5 }} />

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Наименование материала"
              placeholder="Введите название материала..."
              value={filters.materialName}
              onChange={(e) => setFilters((prev) => ({ ...prev, materialName: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Артикул материала"
              placeholder="Введите артикул..."
              value={filters.materialMarking}
              onChange={(e) => setFilters((prev) => ({ ...prev, materialMarking: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Номер заказа"
              placeholder="Введите номер заказа..."
              value={filters.orderNumber}
              onChange={(e) => setFilters((prev) => ({ ...prev, orderNumber: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" gap={1} alignItems="stretch">
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={() => searchMaterials(1)}
                disabled={loading}
                fullWidth
                sx={{
                  minHeight: '40px',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                {loading ? <CircularProgress size={20} /> : 'Поиск'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={resetFilters}
                disabled={loading}
                sx={{
                  minHeight: '40px',
                  fontSize: '14px',
                  fontWeight: 500,
                  minWidth: '100px',
                }}
              >
                Сброс
              </Button>
              <Button
                variant="outlined"
                startIcon={<SearchIcon />}
                onClick={() => setOrderSearchOpen(true)}
                disabled={loading}
                sx={{
                  minHeight: '40px',
                  fontSize: '14px',
                  fontWeight: 500,
                  minWidth: '120px',
                }}
              >
                Найти заказ
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Ошибка */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Статистика поиска */}
      {searchStats && (
        <Paper className="search-stats" elevation={1}>
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" mb={2}>
            <InfoIcon color="primary" />
            <Typography variant="h6">Результаты поиска:</Typography>
            <Chip label={`${searchStats.totals.totalOrders} заказов`} color="primary" />
            <Chip label={`${searchStats.totals.totalItems} изделий`} color="secondary" />
            <Chip label={`${searchStats.totals.totalMaterials} материалов`} color="info" />
            {searchStats.totals.totalQuantity && (
              <Chip
                label={`${searchStats.totals.totalQuantity.toFixed(2)} ед.`}
                color="warning"
                variant="outlined"
              />
            )}
            {searchStats.totals.totalCost && (
              <Chip
                label={`${searchStats.totals.totalCost.toFixed(2)} ₽`}
                color="success"
                variant="outlined"
              />
            )}
          </Box>

          {/* Детальная статистика по материалам */}
          {searchStats.materials && searchStats.materials.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {searchStats.grouping === 'by_material'
                  ? 'Статистика по материалам:'
                  : searchStats.grouping === 'by_type'
                  ? 'Статистика по типам материалов:'
                  : 'Общая статистика:'}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Тип материала</TableCell>
                      <TableCell>Материал</TableCell>
                      <TableCell>Артикул</TableCell>
                      <TableCell>Заказов</TableCell>
                      <TableCell>Изделий</TableCell>
                      <TableCell>Количество</TableCell>
                      <TableCell>Стоимость</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {searchStats.materials.slice(0, 10).map((material, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Chip label={material.STUFF_TYPE_NAME} size="small" />
                        </TableCell>
                        <TableCell>{material.MATERIAL_NAME || '-'}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {material.MATERIAL_MARKING || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>{material.ORDERS_COUNT}</TableCell>
                        <TableCell>{material.ITEMS_COUNT}</TableCell>
                        <TableCell>
                          {material.TOTAL_QUANTITY
                            ? `${material.TOTAL_QUANTITY.toFixed(2)} ${
                                material.MEASURE_UNIT || 'ед.'
                              }`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {material.TOTAL_COST ? `${material.TOTAL_COST.toFixed(2)} ₽` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {searchStats.materials.length > 10 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: 'block' }}
                >
                  Показано 10 из {searchStats.materials.length} материалов
                </Typography>
              )}
            </Box>
          )}
        </Paper>
      )}

      {/* Мини-окошко поиска заказов */}
      <Dialog
        open={orderSearchOpen}
        onClose={() => {
          setOrderSearchOpen(false)
          setOrderSearchQuery('')
          setOrderSearchResults([])
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <SearchIcon />
            Поиск заказов
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Номер заказа"
            value={orderSearchQuery}
            onChange={(e) => {
              const query = e.target.value
              setOrderSearchQuery(query)
              debouncedSearchOrders(query)
            }}
            placeholder="Введите номер заказа..."
            InputProps={{
              endAdornment: loadingOrderSearch ? <CircularProgress size={20} /> : <SearchIcon />,
            }}
            sx={{ mb: 2 }}
          />

          {orderSearchResults.length > 0 && (
            <List>
              {orderSearchResults.map((order) => (
                <ListItem
                  key={order.ORDERID}
                  button
                  onClick={() => filterByOrder(order.ORDERNO)}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <ListItemIcon>
                    <AssignmentIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`Заказ № ${order.ORDERNO}`}
                    secondary={`${format(new Date(order.DATECREATED), 'dd.MM.yyyy', {
                      locale: ru,
                    })} • ${getStatusText(order.ORDERSTATUS)}`}
                  />
                </ListItem>
              ))}
            </List>
          )}

          {orderSearchQuery.length >= 2 &&
            orderSearchResults.length === 0 &&
            !loadingOrderSearch && (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                Заказы не найдены
              </Typography>
            )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderSearchOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Результаты поиска */}
      {data && data.orders && (
        <Box
          className="results-section"
          sx={{
            height: 'calc(90vh - 500px)', // Вычитаем высоту шапки и фильтров
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
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#a8a8a8',
            },
          }}
        >
          {/* Пагинация сверху */}
          {data.pagination && data.pagination.hasMore && (
            <Box display="flex" justifyContent="center" mb={2}>
              <Button
                variant="outlined"
                onClick={() => searchMaterials(currentPage + 1)}
                disabled={loading}
                sx={{
                  minHeight: '44px',
                  fontSize: '15px',
                  fontWeight: 500,
                  px: 3,
                  py: 1.5,
                }}
              >
                {loading ? <CircularProgress size={20} /> : 'Загрузить еще'}
              </Button>
            </Box>
          )}

          {data.orders.map((order) => {
            const orderDetailsData = orderDetails.get(order.ORDERID)
            const isLoadingDetails = loadingDetails.has(order.ORDERID)

            return (
              <Accordion
                key={order.ORDERID}
                expanded={expandedOrders.has(order.ORDERID)}
                onChange={() => toggleOrderExpansion(order.ORDERID)}
                className="order-accordion"
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" gap={2} width="100%">
                    <AssignmentIcon color="primary" />
                    <Box flexGrow={1}>
                      <Typography variant="h6">Заказ № {order.ORDERNO}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {format(new Date(order.DATECREATED), 'dd.MM.yyyy', { locale: ru })} •
                        {order.items_count} изделий • {order.materials_count} материалов
                        {order.total_quantity && <> • {order.total_quantity.toFixed(2)} ед.</>}
                        {order.total_cost && <> • {order.total_cost.toFixed(2)} ₽</>}
                      </Typography>
                    </Box>
                    <Chip
                      label={getStatusText(order.ORDERSTATUS)}
                      color={getStatusColor(order.ORDERSTATUS)}
                      size="small"
                    />
                    <Tooltip title="Фильтр по заказу">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          filterByOrder(order.ORDERNO)
                        }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </AccordionSummary>

                <AccordionDetails>
                  {/* Статистика по материалам заказа */}
                  {(() => {
                    const materialsStats = orderMaterialsStats.get(order.ORDERID)
                    const isLoadingMaterialsStats = loadingMaterialsStats.has(order.ORDERID)

                    if (isLoadingMaterialsStats) {
                      return (
                        <Box display="flex" justifyContent="center" py={2}>
                          <CircularProgress size={24} />
                          <Typography variant="body2" sx={{ ml: 2 }}>
                            Загрузка статистики по материалам...
                          </Typography>
                        </Box>
                      )
                    }

                    if (materialsStats && materialsStats.materials.length > 0) {
                      return (
                        <Box mb={3}>
                          <Typography variant="subtitle2" gutterBottom>
                            Статистика по материалам заказа:
                          </Typography>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Тип материала</TableCell>
                                  <TableCell>Материал</TableCell>
                                  <TableCell>Артикул</TableCell>
                                  <TableCell>Изделий</TableCell>
                                  <TableCell>Количество</TableCell>
                                  <TableCell>Стоимость</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {materialsStats.materials.map((material, index) => (
                                  <TableRow key={index}>
                                    <TableCell>
                                      <Chip label={material.STUFF_TYPE_NAME} size="small" />
                                    </TableCell>
                                    <TableCell>{material.MATERIAL_NAME || '-'}</TableCell>
                                    <TableCell>
                                      <Typography variant="body2" fontFamily="monospace">
                                        {material.MATERIAL_MARKING || '-'}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>{material.ITEMS_COUNT}</TableCell>
                                    <TableCell>
                                      {material.TOTAL_QUANTITY
                                        ? `${material.TOTAL_QUANTITY.toFixed(2)} ${
                                            material.MEASURE_UNIT || 'ед.'
                                          }`
                                        : '-'}
                                    </TableCell>
                                    <TableCell>
                                      {material.TOTAL_COST
                                        ? `${material.TOTAL_COST.toFixed(2)} ₽`
                                        : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                          <Box display="flex" gap={2} mt={2}>
                            <Chip
                              label={`Итого: ${materialsStats.totals.totalItems} изделий`}
                              color="primary"
                              size="small"
                            />
                            <Chip
                              label={`${materialsStats.totals.totalMaterials} материалов`}
                              color="secondary"
                              size="small"
                            />
                            {materialsStats.totals.totalQuantity > 0 && (
                              <Chip
                                label={`${materialsStats.totals.totalQuantity.toFixed(2)} ед.`}
                                color="warning"
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {materialsStats.totals.totalCost > 0 && (
                              <Chip
                                label={`${materialsStats.totals.totalCost.toFixed(2)} ₽`}
                                color="success"
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                      )
                    }

                    return null
                  })()}

                  {isLoadingDetails ? (
                    <Box display="flex" justifyContent="center" py={2}>
                      <CircularProgress size={24} />
                      <Typography variant="body2" sx={{ ml: 2 }}>
                        Загрузка деталей заказа...
                      </Typography>
                    </Box>
                  ) : orderDetailsData ? (
                    <Box>
                      {orderDetailsData.items.map((item) => (
                        <Accordion
                          key={item.orderItemsId}
                          expanded={expandedItems.has(item.orderItemsId)}
                          onChange={() => toggleItemExpansion(item.orderItemsId)}
                          className="item-accordion"
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box display="flex" alignItems="center" gap={2} width="100%">
                              <BuildIcon color="secondary" />
                              <Box flexGrow={1}>
                                <Typography variant="subtitle1">{item.itemName}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {item.materials.length} материалов
                                </Typography>
                              </Box>
                              <Badge badgeContent={item.materials.length} color="primary">
                                <InventoryIcon />
                              </Badge>
                            </Box>
                          </AccordionSummary>

                          <AccordionDetails>
                            <TableContainer>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Тип</TableCell>
                                    <TableCell>Материал</TableCell>
                                    <TableCell>Артикул</TableCell>
                                    <TableCell>Цвет</TableCell>
                                    <TableCell>Размеры</TableCell>
                                    <TableCell>Количество</TableCell>
                                    <TableCell>Цена</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {item.materials.map((material, index) => (
                                    <TableRow key={index}>
                                      <TableCell>
                                        <Chip label={material.stuffType} size="small" />
                                      </TableCell>
                                      <TableCell>{material.materialName}</TableCell>
                                      <TableCell>
                                        <Typography variant="body2" fontFamily="monospace">
                                          {material.itemArt}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Box>
                                          <Typography variant="caption" display="block">
                                            Внутри: {material.itemColorIn}
                                          </Typography>
                                          <Typography variant="caption" display="block">
                                            Снаружи: {material.itemColorOut}
                                          </Typography>
                                        </Box>
                                      </TableCell>
                                      <TableCell>
                                        {material.width} × {material.height} × {material.length}
                                      </TableCell>
                                      <TableCell>
                                        <Box>
                                          <Typography variant="body2">
                                            {material.itemQty} {material.itemMesure}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            Объем: {material.itemTotQty?.toFixed(2)}
                                          </Typography>
                                        </Box>
                                      </TableCell>
                                      <TableCell>
                                        {material.itemPrice
                                          ? `${material.itemPrice.toFixed(2)} ₽`
                                          : '-'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      Нажмите для загрузки деталей заказа
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            )
          })}

          {/* Улучшенная пагинация */}
          {data.pagination && data.pagination.totalPages > 1 && (
            <Box display="flex" justifyContent="center" alignItems="center" gap={2} mt={3} p={2}>
              <Typography variant="body2" color="text.secondary">
                Страница {data.pagination.page} из {data.pagination.totalPages}(
                {data.pagination.totalCount} заказов)
              </Typography>
              <Pagination
                count={data.pagination.totalPages}
                page={data.pagination.page}
                onChange={(event, page) => {
                  setCurrentPage(page)
                  searchMaterials(page)
                }}
                color="primary"
                size="large"
                showFirstButton
                showLastButton
              />
            </Box>
          )}

          {/* Кнопка "Загрузить еще" для бесконечной прокрутки */}
          {data.pagination && data.pagination.hasMore && (
            <Box display="flex" justifyContent="center" mt={2}>
              <Button
                variant="outlined"
                onClick={() => {
                  const nextPage = currentPage + 1
                  setCurrentPage(nextPage)
                  searchMaterials(nextPage)
                }}
                disabled={loading}
                sx={{
                  minHeight: '44px',
                  fontSize: '15px',
                  fontWeight: 500,
                  px: 3,
                  py: 1.5,
                }}
              >
                {loading ? <CircularProgress size={20} /> : 'Загрузить еще'}
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Пустое состояние */}
      {data && data.orders && data.orders.length === 0 && (
        <Paper className="empty-state" elevation={1}>
          <Box textAlign="center" py={4}>
            <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Материалы не найдены
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Попробуйте изменить параметры поиска
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  )
}

export default MaterialSearchPage
