import React from 'react'
import {
  Typography,
  Paper,
  Box,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Grid,
  Collapse,
  InputAdornment,
  Avatar,
} from '@mui/material'
import {
  Assignment,
  Schedule,
  CheckCircle,
  Warning,
  FilterList,
  ViewList,
  ViewModule,
  Search,
  HelpOutline, // Добавлена иконка для задач без срока
} from '@mui/icons-material'

const TaskFiltersHeader = ({
  stats,
  isFiltersOpen,
  setIsFiltersOpen,
  viewMode,
  setViewMode,
  searchTerm,
  setSearchTerm,
  selectedStatus,
  setSelectedStatus,
  selectedPriority,
  setSelectedPriority,
  sortBy,
  setSortBy,
  selectedAssignee,
  setSelectedAssignee,
  users,
  updatedTasks,
}) => {
  // Подсчет задач без срока
  const withoutDeadlineCount = updatedTasks.filter((task) => {
    const hasNoDeadline = task.deadline === null || task.deadline === 'Не указан'

    // Если выбран конкретный исполнитель, учитываем только его задачи
    if (selectedAssignee !== 'all') {
      return hasNoDeadline && task.assigned_user_ids.includes(parseInt(selectedAssignee))
    }

    return hasNoDeadline
  }).length

  // Подсчет задач для каждого исполнителя
  const getUserTaskCounts = (userId) => {
    return updatedTasks.filter((task) => {
      // Для задач без срока
      const hasNoDeadline = task.deadline === null || task.deadline === 'Не указан'

      if (userId === 'all') {
        return hasNoDeadline
      } else {
        return hasNoDeadline && task.assigned_user_ids.includes(userId)
      }
    }).length
  }

  return (
    <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 600, color: 'primary.main' }}
          >
            Управление задачами
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip
              icon={<Assignment />}
              label={`Всего: ${stats.total}`}
              size="small"
              variant="outlined"
            />
            <Chip
              icon={<Schedule />}
              label={`В ожидании: ${stats.pending}`}
              size="small"
              color="default"
            />
            <Chip
              icon={<Assignment />}
              label={`В работе: ${stats.doing}`}
              size="small"
              color="primary"
            />
            <Chip
              icon={<CheckCircle />}
              label={`Выполнено: ${stats.done}`}
              size="small"
              color="success"
            />
            {stats.overdue > 0 && (
              <Chip
                icon={<Warning />}
                label={`Просрочено: ${stats.overdue}`}
                size="small"
                color="error"
              />
            )}
            {withoutDeadlineCount > 0 && (
              <Chip
                icon={<HelpOutline />}
                label={`Без срока: ${withoutDeadlineCount}`}
                size="small"
                color="warning"
              />
            )}
          </Box>
        </Box>

        <Box display="flex" gap={2} alignItems="center">
          <IconButton
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            color={isFiltersOpen ? 'primary' : 'default'}
          >
            <FilterList />
          </IconButton>

          <Box display="flex" sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <IconButton
              onClick={() => setViewMode('cards')}
              color={viewMode === 'cards' ? 'primary' : 'default'}
              sx={{ borderRadius: 0 }}
            >
              <ViewModule />
            </IconButton>
            <IconButton
              onClick={() => setViewMode('list')}
              color={viewMode === 'list' ? 'primary' : 'default'}
              sx={{ borderRadius: 0 }}
            >
              <ViewList />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Фильтры исполнителей */}
      <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
        <Chip
          label={`Все исполнители (${stats.total})`}
          onClick={() => setSelectedAssignee('all')}
          color={selectedAssignee === 'all' ? 'primary' : 'default'}
          variant={selectedAssignee === 'all' ? 'filled' : 'outlined'}
        />
        {users.map((user) => {
          const userTaskCount = updatedTasks.filter((task) =>
            task.assigned_user_ids.includes(user.id)
          ).length

          const userWithoutDeadlineCount = getUserTaskCounts(user.id)

          if (userTaskCount === 0) return null

          return (
            <Chip
              key={user.id}
              avatar={
                <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                  {user.first_name.charAt(0)}
                </Avatar>
              }
              label={`${user.last_name} ${user.first_name.charAt(0)}. (${userTaskCount})`}
              onClick={() => setSelectedAssignee(user.id.toString())}
              color={selectedAssignee === user.id.toString() ? 'primary' : 'default'}
              variant={selectedAssignee === user.id.toString() ? 'filled' : 'outlined'}
            />
          )
        })}
      </Box>

      {/* Панель фильтров */}
      <Collapse in={isFiltersOpen}>
        <Paper sx={{ p: 2, mt: 2, backgroundColor: 'grey.50' }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Поиск задач..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                select
                size="small"
                label="Статус"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <MenuItem value="all">Все статусы</MenuItem>
                <MenuItem value="pending">В ожидании</MenuItem>
                <MenuItem value="doing">В работе</MenuItem>
                <MenuItem value="done">Выполнено</MenuItem>
                <MenuItem value="without_deadline">Без срока</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                select
                size="small"
                label="Приоритет"
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
              >
                <MenuItem value="all">Все приоритеты</MenuItem>
                <MenuItem value="Высокий">Высокий</MenuItem>
                <MenuItem value="Средний">Средний</MenuItem>
                <MenuItem value="Низкий">Низкий</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                select
                size="small"
                label="Сортировка"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <MenuItem value="deadline">По дедлайну</MenuItem>
                <MenuItem value="priority">По приоритету</MenuItem>
                <MenuItem value="created">По дате создания</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>
    </Paper>
  )
}

export default TaskFiltersHeader
