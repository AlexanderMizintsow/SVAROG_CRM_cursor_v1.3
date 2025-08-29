import React, { useRef, useEffect } from 'react'
import { Modal, Box, Typography, Button, TextField, MenuItem, Stack } from '@mui/material'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link' // если понадобится гиперссылка
import ConfirmationDialog from '../../../../../../../components/confirmationDialog/ConfirmationDialog'
import SubTaskHierarchy from '../../../../../Task/subcomponents/subTaskHierarchy/SubTaskHierarchy'
import { getUserNames } from '../../../../../Task/utils/taskUtils'
import { ReactFlowProvider } from 'react-flow-renderer'
import EditorToolbar from '../../../../../../../components/EditorToolbar/EditorToolbar'

const TaskModals = ({
  // Состояния для редактирования описания
  isEditing,
  setIsEditing,
  newDescription,
  setNewDescription,
  currentTaskId,
  assignedUserIds,
  handleSaveDescription,

  // Остальные пропсы...
  openConfirmationDialog,
  setOpenConfirmationDialog,
  handleConfirmation,
  isHierarchyModalOpen,
  setIsHierarchyModalOpen,
  currentHierarchyTaskId,
  handleCloseHierarchy,
  openDeadlineDialog,
  setOpenDeadlineDialog,
  deadlineDialogProps,
  setDeadlineDialogProps,
  handleUpdateDeadline,
  openReplaceUserModal,
  setOpenReplaceUserModal,
  selectedTaskForReplacement,
  selectedNewUserId,
  setSelectedNewUserId,
  handleConfirmReplaceUser,
  users,
}) => {
  const editor = useEditor({
    extensions: [StarterKit /*, Link, и др.*/],
    content: newDescription || '',
    onUpdate: ({ editor }) => {
      setNewDescription(editor.getHTML())
    },
  })

  // Обновление содержимого редактора при изменении newDescription
  useEffect(() => {
    if (editor && newDescription !== editor.getHTML()) {
      editor.commands.setContent(newDescription || '')
    }
  }, [newDescription, editor])

  // Очистка редактора при закрытии
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy()
      }
    }
  }, [editor])

  return (
    <>
      {/* Диалог подтверждения */}
      <ConfirmationDialog
        open={openConfirmationDialog}
        onClose={() => setOpenConfirmationDialog(false)}
        onConfirm={handleConfirmation}
        title="Подтверждение действия"
        message="Введите комментарий для возвращения задачи на доработку:"
        btn1="Отмена"
        btn2="Подтвердить"
        comment={true}
      />

      {/* Модальное окно редактирования c Toolbar */}
      {isEditing && (
        <Modal open={isEditing} onClose={() => setIsEditing(false)}>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              maxWidth: 700,
              bgcolor: 'background.paper',
              boxShadow: 24,
              p: 2,
              borderRadius: 2,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography variant="h6" gutterBottom>
              Редактировать описание задачи
            </Typography>

            {/* Toolbar с кнопками форматирования */}
            <EditorToolbar editor={editor} />

            {/* Контейнер для редактора */}
            <Box
              sx={{
                flex: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                minHeight: 200,
                overflow: 'auto',
              }}
            >
              <EditorContent editor={editor} />
            </Box>

            {/* Кнопки сохранения/отмены */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined" onClick={() => setIsEditing(false)}>
                Отменить
              </Button>
              <Button variant="contained" onClick={() => handleSaveDescription(assignedUserIds)}>
                Сохранить
              </Button>
            </Box>
          </Box>
        </Modal>
      )}

      {/* Иерархия подзадач */}
      {isHierarchyModalOpen && (
        <Modal
          open={isHierarchyModalOpen}
          onClose={handleCloseHierarchy}
          aria-labelledby="hierarchy-modal-title"
          aria-describedby="hierarchy-modal-description"
        >
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              maxWidth: '800px',
              bgcolor: 'background.paper',
              boxShadow: 24,
              p: 4,
              maxHeight: '90vh',
              overflow: 'auto',
              borderRadius: 2,
            }}
          >
            <ReactFlowProvider>
              <SubTaskHierarchy taskId={currentHierarchyTaskId} onClose={handleCloseHierarchy} />
            </ReactFlowProvider>
          </Box>
        </Modal>
      )}

      {/* Диалог изменения дедлайна */}
      <ConfirmationDialog
        open={openDeadlineDialog}
        onClose={() => {
          setOpenDeadlineDialog(false)
          setDeadlineDialogProps((prev) => ({ ...prev, open: false }))
        }}
        onConfirm={(comment, newDeadline) => {
          handleUpdateDeadline(comment, newDeadline)
          setOpenDeadlineDialog(false)
          setDeadlineDialogProps((prev) => ({ ...prev, open: false }))
        }}
        title="Изменить срок выполнения задачи"
        message="Укажите новый срок выполнения:"
        btn1="Отмена"
        btn2="Подтвердить"
        comment={true}
        dateInput={true}
        actionType="updateDeadlineTask"
        initialDate={deadlineDialogProps.initialDate}
      />

      {/* Модальное окно замены исполнителя */}
      {openReplaceUserModal && (
        <Modal
          open={openReplaceUserModal}
          onClose={() => setOpenReplaceUserModal(false)}
          aria-labelledby="replace-user-modal-title"
          aria-describedby="replace-user-modal-description"
        >
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 400,
              bgcolor: 'background.paper',
              boxShadow: 24,
              p: 4,
              borderRadius: 2,
            }}
          >
            <Typography id="replace-user-modal-title" variant="h6" gutterBottom>
              Замена исполнителя
            </Typography>
            <Typography variant="body2" gutterBottom>
              Текущий исполнитель:{' '}
              {getUserNames(selectedTaskForReplacement?.assigned_user_ids, users)}
            </Typography>

            <TextField
              select
              fullWidth
              label="Новый исполнитель"
              value={selectedNewUserId}
              onChange={(e) => setSelectedNewUserId(e.target.value)}
              variant="outlined"
              size="small"
              sx={{ mt: 2 }}
            >
              <MenuItem value="" disabled>
                Выберите нового исполнителя
              </MenuItem>
              {users
                .filter((user) => !selectedTaskForReplacement?.assigned_user_ids?.includes(user.id))
                .map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {`${user.last_name} ${user.first_name} ${user.middle_name || ''}`}
                  </MenuItem>
                ))}
            </TextField>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined" onClick={() => setOpenReplaceUserModal(false)}>
                Отмена
              </Button>
              <Button
                variant="contained"
                onClick={handleConfirmReplaceUser}
                disabled={!selectedNewUserId}
              >
                Подтвердить
              </Button>
            </Box>
          </Box>
        </Modal>
      )}
    </>
  )
}

export default TaskModals
