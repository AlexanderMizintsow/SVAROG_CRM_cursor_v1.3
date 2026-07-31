import React, { useEffect, useState } from 'react'
import { Modal, Box, Typography, Button, TextField, MenuItem } from '@mui/material'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import ConfirmationDialog from '../../../../../../../components/confirmationDialog/ConfirmationDialog'
import SubTaskHierarchy from '../../../../../Task/subcomponents/subTaskHierarchy/SubTaskHierarchy'
import { getUserNames } from '../../../../../Task/utils/taskUtils'
import { getAbsenceLabel } from '../../../../../../../utils/userAbsenceUtils'
import { ReactFlowProvider } from 'react-flow-renderer'
import EditorToolbar from '../../../../../../../components/EditorToolbar/EditorToolbar'
import useThemeStore from '../../../../../../../store/themeStore'
import useUserStore from '../../../../../../../store/userStore'
import KnowledgeLinkPicker from '../../../../../../knowledgeBase/KnowledgeLinkPicker'
import { buildKnowledgeAnchorHtml } from '../../../../../../knowledgeBase/knowledgeLinkUtils'

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
  absencesMap = {},
}) => {
  const { theme } = useThemeStore()
  const { user } = useUserStore()
  const userId = user?.id
  const isDarkTheme = theme === 'dark'
  const modalBg = isDarkTheme ? '#1f2430' : 'background.paper'
  const modalPaperClass = `task-list-modal-paper ${theme}`
  const [kbLinkPickerOpen, setKbLinkPickerOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'kb-link' },
      }),
    ],
    content: newDescription || '',
    onUpdate: ({ editor: ed }) => {
      setNewDescription(ed.getHTML())
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
            className={modalPaperClass}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              maxWidth: 700,
              bgcolor: modalBg,
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

            <EditorToolbar
              editor={editor}
              onKnowledgeLinkClick={() => setKbLinkPickerOpen(true)}
            />

            <Box
              sx={{
                flex: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                minHeight: 200,
                overflow: 'auto',
                '& a.kb-link, & a[href*="knowledge-base"]': {
                  color: '#2563eb',
                  fontWeight: 600,
                  textDecoration: 'underline',
                },
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

      <KnowledgeLinkPicker
        open={kbLinkPickerOpen}
        userId={userId}
        onClose={() => setKbLinkPickerOpen(false)}
        onPick={(item) => {
          if (!editor || !item) return
          const html = buildKnowledgeAnchorHtml({
            documentId: item.documentId,
            fileId: item.fileId,
            label: item.label,
          })
          editor.chain().focus().insertContent(html).run()
        }}
      />

      {/* Иерархия подзадач */}
      {isHierarchyModalOpen && (
        <Modal
          open={isHierarchyModalOpen}
          onClose={handleCloseHierarchy}
          aria-labelledby="hierarchy-modal-title"
          aria-describedby="hierarchy-modal-description"
        >
          <Box
            className={modalPaperClass}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              maxWidth: '800px',
              bgcolor: modalBg,
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
        maxDate={deadlineDialogProps.maxDate}
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
            className={modalPaperClass}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 400,
              bgcolor: modalBg,
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
                .filter(
                  (user) =>
                    !selectedTaskForReplacement?.assigned_user_ids?.includes(user.id) &&
                    String(user.role_name || '').trim() !== 'Директор'
                )
                .map((user) => {
                  const absenceLabel = getAbsenceLabel(absencesMap[Number(user.id)])
                  return (
                    <MenuItem key={user.id} value={user.id}>
                      {`${user.last_name} ${user.first_name} ${user.middle_name || ''}`}
                      {absenceLabel ? ` — ${absenceLabel}` : ''}
                    </MenuItem>
                  )
                })}
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
