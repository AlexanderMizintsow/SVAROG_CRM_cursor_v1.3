//taskHandlers.js
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import { getRandomColors } from '../../helpers/getRandomColors'
import { dangerousFormats } from '../../Boards/subcomponents/taskUtils'
import Toastify from 'toastify-js'
import { useCallback } from 'react'

export const useTaskHandlers = (state, setters) => {
  const { taskData, selectedTag } = state
  const {
    // Setters
    setTaskData,
    setSelectedTag,
    setSelectedFiles,
    setHasDangerousFiles,
    setIsTagSelected,
    setIsApprovingSelected,
    setIsViewersSelected,
    setIsImplementersSelected,
    setDbTags,
    setIsTagsManagerOpen,
    setCheckedComment,
  } = setters

  // Функция для загрузки тегов
  const fetchTags = () => {
    axios
      .get(`${API_BASE_URL}5000/api/tags`)
      .then((res) => {
        setDbTags(res.data)
      })
      .catch((err) => console.error('Ошибка загрузки тегов:', err))
  }

  // Обновляем теги при открытии списка
  const handleOpenDropdown = () => {
    fetchTags()
  }

  const handleFileChange = useCallback(
    (e) => {
      const files = Array.from(e.target.files)
      if (files.length === 0) return

      const dangerousFilesDetected = files.some((file) => dangerousFormats.includes(file.type))
      setHasDangerousFiles(dangerousFilesDetected)

      const newFiles = files.map((file) => ({
        file,
        name: file.name,
        type: file.type,
      }))

      setSelectedFiles((prevSelected) => [...prevSelected, ...newFiles])
    },
    [dangerousFormats, setHasDangerousFiles, setSelectedFiles]
  )

  // Функция для удаления файла из списка
  const removeFile = useCallback(
    (name) => {
      setSelectedFiles((prevSelected) => {
        const updatedFiles = prevSelected.filter((file) => file.name !== name)
        const hasRemainingDangerousFiles = updatedFiles.some((file) =>
          dangerousFormats.includes(file.type)
        )
        setHasDangerousFiles(hasRemainingDangerousFiles)
        return updatedFiles
      })
    },
    [dangerousFormats, setHasDangerousFiles, setSelectedFiles]
  )

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target
      setTaskData((prev) => ({ ...prev, [name]: value }))
    },
    [setTaskData]
  )

  const handleAddTag = useCallback(() => {
    if (!selectedTag?.trim()) return // Защита от undefined

    try {
      const { bg, text } = getRandomColors()
      const currentTags = taskData.tags ? JSON.parse(taskData.tags) : []

      setTaskData((prev) => ({
        ...prev,
        tags: JSON.stringify([...currentTags, { title: selectedTag.trim(), bg, text }]),
      }))
      setSelectedTag('')
      setIsTagSelected(false)
    } catch (error) {
      console.error('Error adding tag:', error)
    }
  }, [selectedTag, taskData.tags, setTaskData, setSelectedTag, setIsTagSelected])

  const handleRemoveTag = useCallback(
    (index) => {
      try {
        const currentTags = taskData.tags ? JSON.parse(taskData.tags) : []
        const updatedTags = currentTags.filter((_, i) => i !== index)
        setTaskData((prev) => ({
          ...prev,
          tags: JSON.stringify(updatedTags),
        }))
      } catch (error) {
        console.error('Error removing tag:', error)
      }
    },
    [taskData.tags, setTaskData]
  )

  const handleAddUser = useCallback(
    (roleKey, selectedUser, setSelectedUser) => {
      // Проверка, не выбран ли пользователь уже в другой роли
      if (
        (roleKey !== 'implementers' && taskData.implementers.includes(selectedUser)) ||
        (roleKey !== 'approvers' && taskData.approvers.includes(selectedUser)) ||
        (roleKey !== 'viewers' && taskData.viewers.includes(selectedUser))
      ) {
        Toastify({
          text: 'Пользователь уже выбран в другой роли',
          close: true,
          backgroundColor: 'linear-gradient(to right, #8B0000, #ff0000)',
        }).showToast()
        return
      }

      if (selectedUser && !taskData[roleKey].includes(selectedUser)) {
        setTaskData((prev) => ({
          ...prev,
          [roleKey]: [...prev[roleKey], selectedUser],
        }))
        setSelectedUser('')

        switch (roleKey) {
          case 'approvers':
            setIsApprovingSelected(false)
            break
          case 'viewers':
            setIsViewersSelected(false)
            break
          case 'implementers':
            setIsImplementersSelected(false)
            break
        }
      }
    },
    [taskData, setTaskData, setIsApprovingSelected, setIsViewersSelected, setIsImplementersSelected]
  )

  const handleRemoveUser = useCallback(
    (roleKey, userId) => {
      setTaskData((prev) => ({
        ...prev,
        [roleKey]: prev[roleKey].filter((id) => id !== userId),
      }))
    },
    [setTaskData]
  )

  const handlecheckedComment = useCallback(() => {
    setCheckedComment((prev) => !prev)
  }, [setCheckedComment])

  const handleOpenTagsManager = useCallback(() => {
    setIsTagsManagerOpen(true)
  }, [setIsTagsManagerOpen])

  const handleFocus = (e) => {
    if (!e.target.value) {
      const now = new Date()
      now.setMinutes(0)
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(
        2,
        '0'
      )}:${String(now.getMinutes()).padStart(2, '0')}`
      e.target.value = formattedDate
    }
  }

  const handleInputClick = (e) => {
    e.target.showPicker()
  }

  return {
    fetchTags,
    handleOpenDropdown,
    handleFileChange,
    removeFile,
    handleChange,
    handleAddTag,
    handleRemoveTag,
    handleAddUser,
    handleRemoveUser,
    handlecheckedComment,
    handleOpenTagsManager,
    handleFocus,
    handleInputClick,
  }
}
