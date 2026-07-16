//taskHandlers.js
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import { getRandomColors } from '../../helpers/getRandomColors'
import { dangerousFormats } from '../../Boards/subcomponents/taskUtils'
import Toastify from 'toastify-js'
import { useCallback } from 'react'
import { resolveUserSelection } from '../../../../utils/userAbsenceUtils'

const showToast = (text, isError = false) => {
  Toastify({
    text,
    close: true,
    duration: 6000,
    backgroundColor: isError
      ? 'linear-gradient(to right, #8B0000, #ff0000)'
      : 'linear-gradient(to right, #f7971e, #ffd200)',
  }).showToast()
}

export const useTaskHandlers = (state, setters) => {
  const { taskData, selectedTag, absencesMap, users } = state
  const {
    setTaskData,
    setSelectedTag,
    setSelectedFiles,
    setHasDangerousFiles,
    setDbTags,
    setIsTagsManagerOpen,
    setCheckedComment,
    setAbsenceMeta,
  } = setters

  const fetchTags = () => {
    axios
      .get(`${API_BASE_URL}5000/api/tags`)
      .then((res) => {
        setDbTags(res.data)
      })
      .catch((err) => console.error('Ошибка загрузки тегов:', err))
  }

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
    [setHasDangerousFiles, setSelectedFiles]
  )

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
    [setHasDangerousFiles, setSelectedFiles]
  )

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target
      setTaskData((prev) => ({ ...prev, [name]: value }))
    },
    [setTaskData]
  )

  const handleAddTag = useCallback(
    (explicitTag) => {
      const tagToAdd =
        explicitTag !== undefined && explicitTag !== null && String(explicitTag).trim() !== ''
          ? String(explicitTag).trim()
          : String(selectedTag || '').trim()
      if (!tagToAdd) return

      try {
        const { bg, text } = getRandomColors()
        const currentTags = taskData.tags ? JSON.parse(taskData.tags) : []

        setTaskData((prev) => ({
          ...prev,
          tags: JSON.stringify([...currentTags, { title: tagToAdd, bg, text }]),
        }))
        setSelectedTag('')
      } catch (error) {
        console.error('Error adding tag:', error)
      }
    },
    [selectedTag, taskData.tags, setTaskData, setSelectedTag]
  )

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
      const userIdStr = String(selectedUser)

      if (
        (roleKey !== 'implementers' && taskData.implementers.includes(userIdStr)) ||
        (roleKey !== 'approvers' && taskData.approvers.includes(userIdStr)) ||
        (roleKey !== 'viewers' && taskData.viewers.includes(userIdStr))
      ) {
        showToast('Пользователь уже выбран в другой роли', true)
        return
      }

      const resolution = resolveUserSelection(selectedUser, absencesMap || {}, users || [], {
        deadline: taskData.deadline || null,
      })

      if (resolution.message) {
        showToast(resolution.message, resolution.blocked)
      }

      if (!resolution.added || resolution.effectiveId == null) {
        setSelectedUser('')
        return
      }

      const effectiveIdStr = String(resolution.effectiveId)

      if (taskData[roleKey].includes(effectiveIdStr)) {
        showToast(
          resolution.substituted ? 'Замещающий уже добавлен в эту роль' : 'Пользователь уже добавлен',
          true
        )
        setSelectedUser('')
        return
      }

      if (
        (roleKey !== 'implementers' && taskData.implementers.includes(effectiveIdStr)) ||
        (roleKey !== 'approvers' && taskData.approvers.includes(effectiveIdStr)) ||
        (roleKey !== 'viewers' && taskData.viewers.includes(effectiveIdStr))
      ) {
        showToast(
          resolution.substituted
            ? 'Замещающий уже выбран в другой роли'
            : 'Пользователь уже выбран в другой роли',
          true
        )
        setSelectedUser('')
        return
      }

      setTaskData((prev) => ({
        ...prev,
        [roleKey]: [...prev[roleKey], effectiveIdStr],
      }))

      if (typeof setAbsenceMeta === 'function') {
        const absence = (absencesMap || {})[Number(resolution.originalId)]
        setAbsenceMeta((prev) => {
          const next = (prev || []).filter(
            (entry) =>
              !(
                entry.roleKey === roleKey &&
                String(entry.effectiveId) === effectiveIdStr
              )
          )
          if (
            resolution.substituted ||
            resolution.needsSkipSubstitution ||
            resolution.note
          ) {
            next.push({
              roleKey,
              effectiveId: effectiveIdStr,
              originalId: String(resolution.originalId),
              substituted: Boolean(resolution.substituted),
              needsSkipSubstitution: Boolean(resolution.needsSkipSubstitution),
              choiceAtSavePossible: Boolean(resolution.choiceAtSavePossible),
              note: resolution.note || null,
              absence: absence || null,
            })
          }
          return next
        })
      }

      setSelectedUser('')
    },
    [taskData, setTaskData, absencesMap, users, setAbsenceMeta]
  )

  const handleRemoveUser = useCallback(
    (roleKey, userId) => {
      setTaskData((prev) => ({
        ...prev,
        [roleKey]: prev[roleKey].filter((id) => id !== userId),
      }))
      if (typeof setAbsenceMeta === 'function') {
        setAbsenceMeta((prev) =>
          (prev || []).filter(
            (entry) =>
              !(entry.roleKey === roleKey && String(entry.effectiveId) === String(userId))
          )
        )
      }
    },
    [setTaskData, setAbsenceMeta]
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
