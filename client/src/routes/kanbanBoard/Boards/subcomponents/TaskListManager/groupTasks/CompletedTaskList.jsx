import React, { useEffect, useState } from 'react'
import {
  List,
  ListItem,
  ListItemText,
  Typography,
  Divider,
  Paper,
  Box,
  FormControlLabel,
  Checkbox,
} from '@mui/material'
import useUserStore from '../../../../../../store/userStore'
import { stripHtmlTags } from '../../taskUtils'
import { getUserNames } from '../../../../Task/utils/taskUtils'
import styles from '../taskListManager.module.scss'

const CompletedTaskList = ({ tasks }) => {
  const { users, user } = useUserStore()
  const [showMyTasks, setShowMyTasks] = useState(true)

  useEffect(() => {
    // Загружаем состояние галочки из локального хранилища
    const savedShowMyTasks = localStorage.getItem('showMyTasks')
    if (savedShowMyTasks !== null) {
      setShowMyTasks(JSON.parse(savedShowMyTasks))
    }
  }, [])

  const handleCheckboxChange = (event) => {
    const isChecked = event.target.checked
    setShowMyTasks(isChecked)
    // Сохраняем состояние галочки в локальное хранилище
    localStorage.setItem('showMyTasks', JSON.stringify(isChecked))
  }

  // Фильтруем задачи в зависимости от состояния галочки
  const filteredTasks = showMyTasks
    ? tasks.filter((task) => task.assigned_user_ids.includes(user.id))
    : tasks

  return (
    <Box className={styles.taskList}>
      <Paper className={styles.paper}>
        <FormControlLabel
          control={
            <Checkbox
              checked={showMyTasks}
              onChange={handleCheckboxChange}
              color="primary"
            />
          }
          label="Показывать только мои выполненные задачи"
        />
        <List>
          {filteredTasks.map((task) => (
            <React.Fragment key={task.task_id}>
              <ListItem className={styles.listItem}>
                <ListItemText
                  className={
                    task.assigned_user_ids.includes(user.id)
                      ? styles.myTask
                      : ''
                  }
                  primary={
                    <>
                      <Typography
                        variant="subtitle1"
                        className={styles.primaryText}
                      >
                        {task.title}
                      </Typography>
                    </>
                  }
                  secondary={
                    <>
                      <Typography
                        variant="body2"
                        className={styles.secondaryText}
                      >
                        {stripHtmlTags(task.description)}
                      </Typography>
                      <div>
                        <Typography
                          variant="caption"
                          className={styles.deadline}
                        >
                          Исполнитель:{' '}
                          {getUserNames(task.assigned_user_ids, users)}
                        </Typography>
                      </div>
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

export default CompletedTaskList
