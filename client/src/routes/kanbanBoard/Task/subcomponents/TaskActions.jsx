import { SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material'
import { IoIosChatboxes } from 'react-icons/io'
import { FaFileMedical } from 'react-icons/fa6'
import { PiNotebookFill } from 'react-icons/pi'
import { TbSubtask } from 'react-icons/tb'
import { useState } from 'react'
import AddModal from '../../Modals/AddModal'

const TaskActions = ({
  hasUnreadMessages,
  onChatClick,
  onAddFileClick,
  onNotesClick,
  open,
  setOpen,
  task,
  currentUser,
}) => {
  const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false)

  // Функция для создания связанной подзадачи
  const handleCreateSubtask = () => {
    setIsSubtaskModalOpen(true)
  }

  const actions = [
    {
      icon: <IoIosChatboxes size={21} style={{ color: hasUnreadMessages ? 'green' : 'inherit' }} />,
      name: 'Чат',
      onClick: onChatClick,
    },
    {
      icon: <FaFileMedical size={21} />,
      name: 'Добавить файл',
      onClick: onAddFileClick,
    },
    {
      icon: <PiNotebookFill size={21} />,
      name: 'Заметки',
      onClick: onNotesClick,
    },
    {
      icon: <TbSubtask size={21} />,
      name: 'Создать связанную подзадачу',
      onClick: handleCreateSubtask,
    },
  ]

  return (
    <>
      <SpeedDial
        ariaLabel="SpeedDial with custom icons"
        icon={<SpeedDialIcon />}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        open={open}
        sx={{
          zIndex: 1,
          position: 'absolute',
          bottom: 25,
          right: -15,
          '& .MuiFab-root': {
            width: 40,
            height: 40,
            minHeight: 'unset',
            borderRadius: '50%',
          },
          '& .MuiSpeedDialIcon-icon': {
            fontSize: '24px',
          },
          '& .MuiSpeedDialIcon-openIcon': {
            fontSize: '24px',
          },
        }}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.onClick}
          />
        ))}
      </SpeedDial>

      {isSubtaskModalOpen && (
        <AddModal
          isOpen={isSubtaskModalOpen}
          onClose={() => setIsSubtaskModalOpen(false)}
          userId={currentUser}
          parentTaskId={task.id}
          rootTaskId={task.root_id || task.id}
          setOpen={setIsSubtaskModalOpen}
        />
      )}
    </>
  )
}

export default TaskActions
