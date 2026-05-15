import React from 'react'
import { Box, Typography, Tooltip } from '@mui/material'
import { TbUserCheck, TbUserScreen } from 'react-icons/tb'
import { getUserNames } from '../../../../../Task/utils/taskUtils'
import styles from '../../taskListManager.module.scss'

const TaskCardParticipants = ({ task, users }) => {
  const viewers = (task.visibility_user_ids || []).filter(Boolean)
  const approvers = Array.isArray(task.approver_user_ids) ? task.approver_user_ids : []

  if (viewers.length === 0 && approvers.length === 0) return null

  const pendingIds = approvers.filter((a) => !a.is_approved).map((a) => a.approver_id)
  const approvedIds = approvers.filter((a) => a.is_approved).map((a) => a.approver_id)

  return (
    <Box className={styles.taskCardParticipants} mb={1.5}>
      {viewers.length > 0 && (
        <Tooltip title={getUserNames(viewers, users)} placement="top" arrow>
          <Box className={styles.taskCardParticipantsRow}>
            <TbUserScreen className={styles.taskCardParticipantsIcon} aria-hidden />
            <Typography variant="caption" color="text.secondary" component="span">
              <span className={styles.taskCardParticipantsLabel}>Зрители:</span>{' '}
              {getUserNames(viewers, users)}
            </Typography>
          </Box>
        </Tooltip>
      )}

      {approvers.length > 0 && (
        <Box className={styles.taskCardParticipantsApprovers}>
          <Typography variant="caption" color="text.secondary" className={styles.taskCardParticipantsLabel}>
            Утверждающие:
          </Typography>
          <Box className={styles.taskCardParticipantsApproverList}>
            {approvers.map((approver) => (
              <Tooltip
                key={approver.approver_id}
                title={
                  approver.is_approved
                    ? `${getUserNames([approver.approver_id], users)} — утвердил`
                    : `${getUserNames([approver.approver_id], users)} — ожидает утверждения`
                }
                placement="top"
                arrow
              >
                <span className={styles.taskCardParticipantsApproverItem}>
                  <TbUserCheck
                    className={styles.taskCardParticipantsIcon}
                    style={{ color: approver.is_approved ? '#2e7d32' : '#d32f2f' }}
                    aria-hidden
                  />
                  <Typography variant="caption" component="span">
                    {getUserNames([approver.approver_id], users)}
                  </Typography>
                </span>
              </Tooltip>
            ))}
          </Box>
          {pendingIds.length > 0 && (
            <Typography variant="caption" className={styles.taskCardParticipantsPending}>
              Ожидает утверждения: {getUserNames(pendingIds, users)}
            </Typography>
          )}
          {approvedIds.length > 0 && pendingIds.length > 0 && (
            <Typography variant="caption" className={styles.taskCardParticipantsApproved}>
              Утвердили: {getUserNames(approvedIds, users)}
            </Typography>
          )}
          {pendingIds.length === 0 && approvers.length > 0 && (
            <Typography variant="caption" className={styles.taskCardParticipantsAllDone}>
              Все утверждающие подтвердили
            </Typography>
          )}
        </Box>
      )}
    </Box>
  )
}

export default TaskCardParticipants
