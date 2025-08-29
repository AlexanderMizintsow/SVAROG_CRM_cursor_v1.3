import React from 'react'
import {
  List,
  ListItem,
  ListItemText,
  Typography,
  Divider,
  Paper,
  Box,
  Chip,
} from '@mui/material'
import { getChipStyles, getStatusLabel, stripHtmlTags } from '../../taskUtils'
import { getUserNames } from '../../../../Task/utils/taskUtils'
import useUserStore from '../../../../../../store/userStore'
import styles from '../taskListManager.module.scss'

const VisibleTaskList = ({ tasks }) => {
  const { users } = useUserStore()

  return (
    <Box className={styles.taskList}>
      <Paper className={styles.paper}>
        <List>
          {tasks.map((task) => (
            <React.Fragment key={task.task_id}>
              <ListItem className={styles.listItem}>
                <ListItemText
                  primary={
                    <Typography
                      variant="subtitle1"
                      className={styles.primaryText}
                    >
                      {task.title}
                    </Typography>
                  }
                  secondary={
                    <>
                      <Typography
                        variant="body2"
                        className={styles.secondaryText}
                      >
                        {stripHtmlTags(task.description)}
                      </Typography>
                      <Typography variant="caption" className={styles.deadline}>
                        Дедлайн:{' '}
                        {task.deadline
                          ? new Date(task.deadline).toLocaleDateString()
                          : 'Не указан'}
                      </Typography>
                      <div>
                        {' '}
                        <Typography
                          variant="caption"
                          className={styles.deadline}
                        >
                          Исполнитель:{' '}
                          {getUserNames(task.assigned_user_ids, users)}
                        </Typography>
                      </div>
                      <Box mt={1}>
                        <Chip
                          label={`Приоритет: ${task.priority}`}
                          size="small"
                          sx={getChipStyles(task.priority)}
                        />

                        <Chip
                          label={`Статус: ${getStatusLabel(task.status)}`}
                          size="small"
                          color={
                            task.status === 'doing'
                              ? 'primary'
                              : task.status === 'done'
                              ? 'success'
                              : 'default'
                          }
                          sx={{ ml: 1 }}
                        />
                      </Box>
                    </>
                  }
                />
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  )
}

export default VisibleTaskList
