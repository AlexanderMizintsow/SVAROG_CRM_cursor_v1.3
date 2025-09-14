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

  // Поиск материалов
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
          limit: 100,
        }

        console.log('Sending filters:', cleanFilters)

        // Используем новый оптимизированный эндпоинт - только заказы без материалов
        const response = await axios.post(
          `${API_BASE_URL}5005/app/statistics/full-orders-data`,
          cleanFilters
        )
        const result = response.data

        if (page === 1) {
          // Первая страница - заменяем данные
          setData(result.result)
        } else {
          // Последующие страницы - добавляем к существующим, избегая дублирования
          setData((prevData) => {
            const existingOrderIds = new Set((prevData?.orders || []).map((order) => order.orderId))
            const newOrders = result.result.orders.filter(
              (order) => !existingOrderIds.has(order.orderId)
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

  // Фильтр по конкретному заказу
  const filterByOrder = useCallback((orderNumber) => {
    setFilters((prev) => ({
      ...prev,
      orderNumber: orderNumber,
      materialName: '',
      materialMarking: '',
    }))
    setCurrentPage(1)
  }, [])

  // Функция для загрузки материалов конкретного заказа
  const loadOrderMaterials = useCallback(
    async (orderId) => {
      try {
        setLoading(true)
        console.log(`Loading materials for order ${orderId}`)
        console.log('Sending filters:', filters)

        // Передаем текущие фильтры для правильной фильтрации материалов
        const response = await axios.post(
          `${API_BASE_URL}5005/app/statistics/order-materials/${orderId}`,
          filters
        )

        console.log('Response received:', response.data)

        if (response.data.success) {
          const orderData = response.data.data
          console.log('Order data:', orderData)

          // Обновляем данные заказа с загруженными материалами
          setData((prevData) => {
            if (!prevData?.orders) return prevData

            const updatedOrders = prevData.orders.map((order) => {
              if (order.orderId === orderId) {
                return {
                  ...order,
                  items: orderData ? orderData.items : [],
                  materialsLoaded: true,
                  filteredItemsCount: orderData ? orderData.filteredItemsCount : 0,
                  filteredMaterialsCount: orderData ? orderData.filteredMaterialsCount : 0,
                  filteredCost: orderData ? orderData.filteredCost : 0,
                  filteredQuantity: orderData ? orderData.filteredQuantity : 0,
                }
              }
              return order
            })

            return {
              ...prevData,
              orders: updatedOrders,
            }
          })
        }
      } catch (error) {
        console.error('Error loading order materials:', error)
        console.error('Error response:', error.response?.data)
        console.error('Error status:', error.response?.status)
        setError(`Ошибка при загрузке материалов заказа: ${error.message}`)
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  // Переключение развернутости заказа
  const toggleOrderExpansion = useCallback(
    (orderId) => {
      setExpandedOrders((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(orderId)) {
          newSet.delete(orderId)
        } else {
          newSet.add(orderId)
          // Загружаем материалы при раскрытии заказа
          const order = data?.orders?.find((o) => o.orderId === orderId)
          if (order && !order.materialsLoaded) {
            console.log(`Expanding order ${orderId}, loading materials...`)
            loadOrderMaterials(orderId)
          }
        }
        return newSet
      })
    },
    [data?.orders, loadOrderMaterials]
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

  // Копирование номера заказа
  const copyOrderNumber = useCallback((orderNumber) => {
    navigator.clipboard
      .writeText(orderNumber)
      .then(() => {
        // Можно добавить уведомление об успешном копировании
        console.log('Номер заказа скопирован:', orderNumber)
      })
      .catch((err) => {
        console.error('Ошибка копирования:', err)
      })
  }, [])

  // Загрузка типов товаров при изменении года
  useEffect(() => {
    fetchStuffTypes()
  }, [fetchStuffTypes])

  // Автоматический поиск при загрузке компонента с базовыми фильтрами
  useEffect(() => {
    // Автоматически выполняем поиск только если есть базовые фильтры (даты и статус)
    if (filters.startDate && filters.endDate && filters.orderStatus) {
      searchMaterials(1)
    }
  }, [filters.startDate, filters.endDate, filters.orderStatus, searchMaterials])

  // Статистика поиска
  const searchStats = useMemo(() => {
    if (!data) return null

    return {
      totalOrders: data.totalOrders,
      totalItems: data.totalItems,
      totalMaterials: data.totalMaterials,
      totalCost: data.totalCost,
      totalQuantity: data.totalQuantity,
      materialsStats: data.materialsStats,
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
          <Box flex={1}>
            <Typography variant="h6" component="h1">
              Поиск материалов в заказах
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Найдите заказы и изделия по материалам, артикулам или номерам заказов
            </Typography>
          </Box>
          {loading && (
            <Box display="flex" alignItems="center" gap={1}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Загрузка...
              </Typography>
            </Box>
          )}
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
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    orderStatus: e.target.value,
                  }))
                }
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
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  materialName: e.target.value,
                }))
              }
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Артикул материала"
              placeholder="Введите артикул..."
              value={filters.materialMarking}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  materialMarking: e.target.value,
                }))
              }
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
          <Box>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <InfoIcon color="primary" />
              <Typography variant="h6">Результаты поиска:</Typography>
              <Chip label={`${searchStats.totalOrders} заказов`} color="primary" />
              <Chip label={`${searchStats.totalItems} изделий`} color="secondary" />
              <Chip label={`${searchStats.totalMaterials} единиц материала`} color="info" />
            </Box>

            {searchStats.totalCost > 0 && (
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="body2" color="text.secondary">
                  Общая стоимость:
                </Typography>
                <Chip
                  label={`${searchStats.totalCost.toFixed(2)} ₽`}
                  color="success"
                  variant="outlined"
                />
                {searchStats.totalQuantity > 0 && (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Количество:
                    </Typography>
                    <Chip
                      label={`${searchStats.totalQuantity.toFixed(2)}`}
                      color="warning"
                      variant="outlined"
                    />
                  </>
                )}
              </Box>
            )}
          </Box>
        </Paper>
      )}

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

          {data.orders.map((order) => (
            <Accordion
              key={order.orderId}
              expanded={expandedOrders.has(order.orderId)}
              onChange={() => toggleOrderExpansion(order.orderId)}
              className="order-accordion"
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={2} width="100%">
                  <AssignmentIcon color="primary" />
                  <Box flexGrow={1}>
                    <Typography variant="h6">Заказ № {order.orderNumber}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {format(new Date(order.dateCreated), 'dd.MM.yyyy', {
                        locale: ru,
                      })}{' '}
                      •
                      {order.materialsLoaded ? (
                        <>
                          {order.filteredItemsCount || 0} изделий с искомым материалом •{' '}
                          {order.filteredMaterialsCount || 0} материалов
                          {order.filteredCost > 0 && (
                            <>
                              {' '}
                              • {order.filteredCost.toFixed(2)} ₽
                              {order.filteredQuantity > 0 && (
                                <> • {order.filteredQuantity.toFixed(2)}</>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <>{order.itemsWithMaterial || 0} изделий с искомым материалом</>
                      )}
                    </Typography>
                  </Box>
                  <Chip
                    label={getStatusText(order.orderStatus)}
                    color={getStatusColor(order.orderStatus)}
                    size="small"
                  />
                  <Tooltip title="Копировать номер заказа">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyOrderNumber(order.orderNumber)
                      }}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Фильтр по заказу">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        filterByOrder(order.orderNumber)
                      }}
                    >
                      <FilterListIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </AccordionSummary>

              <AccordionDetails>
                <Box>
                  {!order.materialsLoaded ? (
                    <Box display="flex" justifyContent="center" alignItems="center" p={3}>
                      <CircularProgress size={24} />
                      <Typography variant="body2" color="text.secondary" ml={2}>
                        Загрузка материалов...
                      </Typography>
                    </Box>
                  ) : (
                    order.items.map((item) => (
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
                                {item.filteredMaterialsCount || item.materials.length} материалов с
                                искомым материалом
                                {item.filteredCost > 0 && (
                                  <>
                                    {' '}
                                    • {item.filteredCost.toFixed(2)} ₽
                                    {item.filteredQuantity > 0 && (
                                      <> • {item.filteredQuantity.toFixed(2)}</>
                                    )}
                                  </>
                                )}
                              </Typography>
                            </Box>
                            <Badge
                              badgeContent={item.filteredMaterialsCount || item.materials.length}
                              color="primary"
                            >
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
                    ))
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
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
