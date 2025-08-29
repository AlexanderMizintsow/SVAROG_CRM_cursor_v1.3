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
import useUserStore from '../../../../../../store/userStore'
import useTaskStateTracker from '../../../../../../store/useTaskStateTracker'
import Tooltip from '@mui/material/Tooltip'
import { stripHtmlTags, getStatusLabel, getChipStyles } from '../../taskUtils'
import { getUserNames } from '../../../../Task/utils/taskUtils'
import { FcApproval, FcCancel } from 'react-icons/fc'
import styles from '../taskListManager.module.scss'

const ApproverTaskList = ({ tasks, approvalStatus, userId, onApproval }) => {
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
                      {task.approver_user_ids && (
                        <Typography
                          variant="body2"
                          className={styles.approvalStatus}
                        >
                          Статус:{' '}
                          {approvalStatus[task.task_id] ? (
                            <span style={{ color: 'green' }}>
                              Утверждено{' '}
                              <FcApproval style={{ fontSize: '24px' }} />
                            </span>
                          ) : (
                            <span style={{ color: 'red' }}>
                              Не утверждено{' '}
                              <Tooltip
                                title="Нажмите, чтобы утвердить задачу, требуется Ваше одобрение"
                                arrow
                                placement="top"
                                PopperProps={{
                                  modifiers: [
                                    {
                                      name: 'offset',
                                      options: {
                                        offset: [0, 20], // Измените 10 на нужное вам значение для отступа по вертикали
                                      },
                                    },
                                  ],
                                }}
                              >
                                <span>
                                  <FcCancel
                                    className={`${styles.icon} ${styles.neonPulse}`}
                                    onClick={() => {
                                      useTaskStateTracker
                                        .getState()
                                        .setApproval(task.task_id, userId, true)
                                      onApproval(
                                        task.task_id,
                                        userId,
                                        approvalStatus[task.task_id]
                                      )
                                    }}
                                  />
                                </span>
                              </Tooltip>
                            </span>
                          )}
                        </Typography>
                      )}
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

export default ApproverTaskList
