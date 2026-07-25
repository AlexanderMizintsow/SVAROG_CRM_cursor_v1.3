import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../../config";
import { Suspense } from "react";
import Quill from "quill";
import Toastify from "toastify-js";
import { useTaskHandlers } from "./subcomponents/taskHandlers";
import FileUploaderTask from "./subcomponents/FileUploaderTask";
import TagManagerSectionTask from "./subcomponents/TagManagerSectionTask";
import UserRoleSectionTask from "./subcomponents/UserRoleSectionTask";
const TagsManager = React.lazy(() =>
  import("../../../components/tagsManager/TagsManager")
);
import "quill/dist/quill.snow.css";
import styles from "./AddModal.module.scss";
import {
  getAddModalDraftKey,
  loadAddModalDraft,
  saveAddModalDraft,
  clearAddModalDraft,
  hasAddModalDraftContent,
  buildEmptyTaskData,
} from "./addModalDraft";
import { useActiveAbsences } from "../../../utils/useActiveAbsences";
import {
  getAbsenceChoicesAtSave,
  findAbsenceChoicesFromAssignees,
  getAbsenceEndDate,
  isDeadlineAfterAbsence,
  normalizeDateOnly,
  refreshAbsenceMetaNotes,
} from "../../../utils/userAbsenceUtils";
import AbsenceAssigneeChoiceModal from "../../../components/absenceAssigneeChoice/AbsenceAssigneeChoiceModal";

const formatDateRuLocal = (dateStr) => {
  const normalized = normalizeDateOnly(dateStr);
  if (!normalized) return "";
  const parts = normalized.split("-");
  if (parts.length !== 3) return normalized;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

const buildAssignmentPlan = (taskData, absenceMeta, decisions = {}) => {
  const plan = { implementers: [], approvers: [], viewers: [] };
  for (const roleKey of ["implementers", "approvers", "viewers"]) {
    const ids = Array.isArray(taskData[roleKey]) ? taskData[roleKey] : [];
    for (const id of ids) {
      const meta = (absenceMeta || []).find(
        (entry) =>
          entry.roleKey === roleKey && String(entry.effectiveId) === String(id)
      );
      if (!meta) {
        plan[roleKey].push({ userId: id, skip: false });
        continue;
      }
      const decision = decisions[`${roleKey}:${id}`];
      if (meta.substituted && decision === "original") {
        plan[roleKey].push({ userId: meta.originalId, skip: true });
      } else if (meta.needsSkipSubstitution) {
        plan[roleKey].push({ userId: id, skip: true });
      } else {
        plan[roleKey].push({ userId: id, skip: false });
      }
    }
  }
  return plan;
};

const AddModal = ({
  isOpen,
  onClose,
  setOpen,
  userId,
  globalTaskId,
  parentTaskId,
  rootTaskId,
  initialTaskData: externalInitialTaskData,
  businessProcessInstanceId,
}) => {
  const initialTaskData = useMemo(
    () => ({
      title: "",
      description: "",
      deadline: "",
      priority: "низкий",
      status: "",
      notification_status: false,
      tags: "",
      created_by: userId,
      implementers: [],
      approvers: [],
      viewers: [],
      file_url: "",
      file_type: "",
      comment_file: "",
      name_file: "",
      global_task_id: globalTaskId,
      parentTaskId,
      rootTaskId,
      ...(externalInitialTaskData || {}),
    }),
    [externalInitialTaskData, userId, globalTaskId, parentTaskId, rootTaskId]
  );

  const draftKey = useMemo(
    () => getAddModalDraftKey(userId, globalTaskId, parentTaskId, rootTaskId),
    [userId, globalTaskId, parentTaskId, rootTaskId]
  );

  const resolveInitialTaskData = useCallback(() => {
    const saved = loadAddModalDraft(draftKey);
    if (saved?.taskData && hasAddModalDraftContent(saved.taskData)) {
      return {
        ...buildEmptyTaskData(userId, globalTaskId, parentTaskId, rootTaskId),
        ...saved.taskData,
        global_task_id: globalTaskId,
        parentTaskId,
        rootTaskId,
        created_by: userId,
      };
    }
    return initialTaskData;
  }, [draftKey, userId, globalTaskId, parentTaskId, rootTaskId, initialTaskData]);

  const [taskData, setTaskData] = useState(() => resolveInitialTaskData());
  const [users, setUsers] = useState([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedImplementer, setSelectedImplementer] = useState("");
  const [selectedApprover, setSelectedApprover] = useState("");
  const [selectedViewer, setSelectedViewer] = useState("");
  const [quillInstance, setQuillInstance] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [hasDangerousFiles, setHasDangerousFiles] = useState(false);
  const [checkedComment, setCheckedComment] = useState(() => {
    const saved = loadAddModalDraft(
      getAddModalDraftKey(userId, globalTaskId, parentTaskId, rootTaskId)
    );
    return !!saved?.checkedComment;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTagsManagerOpen, setIsTagsManagerOpen] = useState(false);
  const [dbTags, setDbTags] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [fileComments, setFileComments] = useState(() => {
    const saved = loadAddModalDraft(
      getAddModalDraftKey(userId, globalTaskId, parentTaskId, rootTaskId)
    );
    return saved?.fileComments && typeof saved.fileComments === 'object'
      ? saved.fileComments
      : {};
  });
  const [projectDeadline, setProjectDeadline] = useState(null);
  const [absenceMeta, setAbsenceMeta] = useState([]);
  const [choiceQueue, setChoiceQueue] = useState([]);
  const [currentChoice, setCurrentChoice] = useState(null);
  const { absencesMap } = useActiveAbsences(isOpen);

  const quillRef = useRef(null);
  const initialDataAppliedRef = useRef(false);
  const quillInitialSetRef = useRef(false);
  const prevIsOpenRef = useRef(false);
  const prevDraftKeyRef = useRef(draftKey);
  const choiceDecisionsRef = useRef({});
  const choiceEntriesRef = useRef([]);

  const {
    handleFileChange,
    removeFile,
    handleAddTag,
    handleRemoveTag,
    handleAddUser,
    handleRemoveUser,
    handlecheckedComment,
    handleOpenTagsManager,
    handleFocus,
    handleInputClick,
    handleOpenDropdown,
  } = useTaskHandlers(
    {
      taskData,
      selectedTag,
      absencesMap,
      users,
    },
    {
      setTaskData,
      setSelectedTag,
      setSelectedFiles,
      setHasDangerousFiles,
      setDbTags,
      setIsTagsManagerOpen,
      setCheckedComment,
      setAbsenceMeta,
    }
  );

  /** Актуальное описание из Quill (источник истины для черновика). */
  const getTaskDataForDraft = useCallback(() => {
    const description =
      (quillInstance?.root && quillInstance.root.innerHTML) ||
      taskData.description ||
      "";
    return { ...taskData, description };
  }, [quillInstance, taskData]);

  const tagOptions = useMemo(() => {
    return dbTags.map((tag) => tag.name); // получаем массив строк названий
  }, [dbTags]);

  useEffect(() => {
    if (userId && users.length) {
      const currentUser = users.find((user) => user.id === userId);
      if (currentUser) {
        setTaskData((prev) => ({ ...prev, created_by: currentUser.id }));
      }
    }
  }, [userId, users]);

  // Подгрузка черновика при смене контекста (доска / проект / подзадача)
  useEffect(() => {
    if (prevDraftKeyRef.current === draftKey) return;
    prevDraftKeyRef.current = draftKey;
    const saved = loadAddModalDraft(draftKey);
    if (saved?.taskData && hasAddModalDraftContent(saved.taskData)) {
      const restored = {
        ...buildEmptyTaskData(userId, globalTaskId, parentTaskId, rootTaskId),
        ...saved.taskData,
        global_task_id: globalTaskId,
        parentTaskId,
        rootTaskId,
        created_by: userId,
      };
      setTaskData(restored);
      if (quillInstance?.root && restored.description) {
        quillInstance.root.innerHTML = restored.description;
      }
      if (saved.checkedComment) setCheckedComment(!!saved.checkedComment);
      if (saved.fileComments && typeof saved.fileComments === 'object') {
        setFileComments(saved.fileComments);
      }
      initialDataAppliedRef.current = true;
      return;
    }
    setTaskData(initialTaskData);
    initialDataAppliedRef.current = !!externalInitialTaskData;
  }, [
    draftKey,
    userId,
    globalTaskId,
    parentTaskId,
    rootTaskId,
    initialTaskData,
    externalInitialTaskData,
    quillInstance,
  ]);

  // Шаблон из BPE — только если нет сохранённого черновика
  useEffect(() => {
    if (!isOpen || !externalInitialTaskData || initialDataAppliedRef.current) return;
    const saved = loadAddModalDraft(draftKey);
    if (saved?.taskData && hasAddModalDraftContent(saved.taskData)) {
      initialDataAppliedRef.current = true;
      return;
    }
    setTaskData(initialTaskData);
    initialDataAppliedRef.current = true;
  }, [isOpen, externalInitialTaskData, draftKey, initialTaskData]);

  // Принудительная активация Quill редактора при открытии модального окна
  useEffect(() => {
    if (isOpen && quillInstance) {
      // Небольшая задержка для корректной инициализации
      setTimeout(() => {
        if (quillInstance && quillInstance.root) {
          quillInstance.root.focus();
        }
      }, 100);
    }
  }, [isOpen, quillInstance]);

  // Синхронизация Quill при открытии модалки (после закрытия без сохранения задачи)
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    if (!justOpened || !quillInstance) return;

    const saved = loadAddModalDraft(draftKey);
    const html =
      taskData.description ||
      saved?.taskData?.description ||
      "";
    const quillPlain = (quillInstance.root.innerHTML || "")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (html) {
      if (quillInstance.root.innerHTML !== html) {
        quillInstance.root.innerHTML = html;
      }
      if (!taskData.description) {
        setTaskData((prev) => ({ ...prev, description: html }));
      }
    } else if (!quillPlain) {
      quillInstance.root.innerHTML = "";
    }

    quillInitialSetRef.current = true;
  }, [isOpen, quillInstance, taskData.description, draftKey]);

  // Автосохранение черновика в sessionStorage пока форма открыта
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => {
      saveAddModalDraft(draftKey, {
        taskData: getTaskDataForDraft(),
        checkedComment,
        fileComments,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    draftKey,
    taskData,
    checkedComment,
    fileComments,
    quillInstance,
    getTaskDataForDraft,
  ]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/users`);
        setUsers(response.data);
      } catch (error) {
        console.error("Ошибка при получении пользователей:", error);
      }
    };
    fetchUsers();
  }, []);

  // Дедлайн проекта — ограничивает срок задачи при создании из проекта
  useEffect(() => {
    if (!isOpen || !globalTaskId) {
      setProjectDeadline(null);
      return;
    }
    const fetchProject = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}`
        );
        const deadline = response.data?.deadline ?? null;
        setProjectDeadline(deadline || null);
      } catch (err) {
        setProjectDeadline(null);
      }
    };
    fetchProject();
  }, [isOpen, globalTaskId]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setTaskData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const resetAuxiliaryFormState = useCallback(() => {
    setSelectedTag("");
    setSelectedImplementer("");
    setSelectedApprover("");
    setSelectedViewer("");
    setSelectedFiles([]);
    setHasDangerousFiles(false);
    setCheckedComment(false);
    setCommentInput("");
    setShowCommentModal(false);
    setCurrentFileIndex(0);
    setFileComments({});
    setSelectedTemplate(null);
    setAbsenceMeta([]);
    setChoiceQueue([]);
    setCurrentChoice(null);
    choiceDecisionsRef.current = {};
    choiceEntriesRef.current = [];
  }, []);

  // Обновляем пометки по отсутствию при смене срока задачи
  useEffect(() => {
    setAbsenceMeta((prev) =>
      refreshAbsenceMetaNotes(prev, taskData.deadline, users, absencesMap)
    );
  }, [taskData.deadline, users, absencesMap]);

  const persistDraft = useCallback(() => {
    const dataForDraft = getTaskDataForDraft();
    setTaskData(dataForDraft);
    saveAddModalDraft(draftKey, {
      taskData: dataForDraft,
      checkedComment,
      fileComments,
    });
    return dataForDraft;
  }, [draftKey, getTaskDataForDraft, checkedComment, fileComments]);

  /** После успешного создания задачи — пустая форма и удаление черновика. */
  const resetFormAfterSuccessfulCreate = useCallback(() => {
    clearAddModalDraft(draftKey);
    setTaskData(buildEmptyTaskData(userId, globalTaskId, parentTaskId, rootTaskId));
    resetAuxiliaryFormState();
    if (quillInstance?.root) {
      quillInstance.root.innerHTML = "";
    }
    quillInitialSetRef.current = false;
    initialDataAppliedRef.current = false;
  }, [
    draftKey,
    userId,
    globalTaskId,
    parentTaskId,
    rootTaskId,
    quillInstance,
    resetAuxiliaryFormState,
  ]);

  /** Закрытие без создания — данные формы и черновик сохраняются. */
  const closeModal = useCallback(() => {
    persistDraft();
    setOpen(false);
    if (typeof onClose === "function") {
      onClose();
    }
  }, [persistDraft, setOpen, onClose]);

  const createTasksWithPlan = useCallback(
    async (assignmentPlan) => {
      if (quillInstance) {
        const description = quillInstance.root.innerHTML;
        const textOnly = description.replace(/<[^>]+>/g, "");

        if (!textOnly) {
          Toastify({
            text: "Необходимо указать ОПИСАНИЕ ЗАДАЧИ",
            close: true,
            backgroundColor: "linear-gradient(to right, #8B0000, #ff0000)",
          }).showToast();
          return;
        }

        if (globalTaskId && projectDeadline && taskData.deadline) {
          const taskD = new Date(taskData.deadline);
          const projD = new Date(projectDeadline);
          if (
            !Number.isNaN(taskD.getTime()) &&
            !Number.isNaN(projD.getTime()) &&
            taskD.getTime() > projD.getTime()
          ) {
            Toastify({
              text: "Срок задачи не может быть позже срока проекта",
              close: true,
              backgroundColor: "linear-gradient(to right, #8B0000, #ff0000)",
            }).showToast();
            return;
          }
        }

        try {
          setIsLoading(true);
          const taskIds = [];
          const implementers = assignmentPlan.implementers || [];

          for (const implementer of implementers) {
            const taskToSubmit = {
              ...taskData,
              description,
              created_at: new Date().toISOString(),
              status: "backlog",
              tags: taskData.tags ? taskData.tags : [],
              created_by: userId,
              parent_id: parentTaskId || null,
              root_id: rootTaskId || parentTaskId || null,
            };
            if (businessProcessInstanceId) {
              taskToSubmit.business_process_instance_id = businessProcessInstanceId;
            }

            const response = await axios.post(
              `${API_BASE_URL}5000/api/tasks/create`,
              taskToSubmit
            );
            const taskId = response.data.id;
            taskIds.push(taskId);

            await axios.post(`${API_BASE_URL}5000/api/tasks/assignment/add`, {
              task_id: taskId,
              user_id: implementer.userId,
              ...(implementer.skip ? { skip_absence_substitution: true } : {}),
            });
          }

          for (const approver of assignmentPlan.approvers || []) {
            for (const taskId of taskIds) {
              await axios.post(`${API_BASE_URL}5000/api/tasks/approval/add`, {
                task_id: taskId,
                approver_id: approver.userId,
                ...(approver.skip ? { skip_absence_substitution: true } : {}),
              });
            }
          }

          for (const viewer of assignmentPlan.viewers || []) {
            for (const taskId of taskIds) {
              await axios.post(`${API_BASE_URL}5000/api/tasks/visibility/add`, {
                task_id: taskId,
                user_id: viewer.userId,
                ...(viewer.skip ? { skip_absence_substitution: true } : {}),
              });
            }
          }

          if (selectedFiles.length > 0) {
            const formData = new FormData();
            selectedFiles.forEach(({ file }) => {
              formData.append("files", file);
            });

            const uploadResponse = await axios.post(
              `${API_BASE_URL}5000/api/upload`,
              formData,
              {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
              }
            );

            const fileUrls = uploadResponse.data.fileUrls;

            for (let i = 0; i < fileUrls.length; i++) {
              const file = selectedFiles[i];
              const comment = checkedComment ? fileComments[file.name] || "" : "";

              for (const taskId of taskIds) {
                await axios.post(`${API_BASE_URL}5000/api/tasks/attachment/add`, {
                  task_id: taskId,
                  file_url: fileUrls[i],
                  file_type: file.type || "application/octet-stream",
                  comment_file: comment,
                  name_file: file.name,
                  uploaded_by: userId,
                });
              }
            }
          }

          await axios.post(`${API_BASE_URL}5000/api/tasks/socket`, {
            id: taskIds,
            createdBy: userId,
            assignedUsers: implementers.map((item) => item.userId),
            approvers: (assignmentPlan.approvers || []).map((item) => item.userId),
            viewers: (assignmentPlan.viewers || []).map((item) => item.userId),
          });

          Toastify({
            text: "Задачи успешно добавлены",
            close: true,
            backgroundColor: "linear-gradient(to right, #006400, #00FF00)",
          }).showToast();

          resetFormAfterSuccessfulCreate();
          setOpen(false);

          if (onClose && typeof onClose === "function") {
            onClose(taskIds[0]);
          }
        } catch (error) {
          console.error("Ошибка при создании задачи:", error);
          Toastify({
            text: error.response?.data?.error || "Ошибка при создании задачи",
            close: true,
            backgroundColor: "linear-gradient(to right, #8B0000, #ff0000)",
          }).showToast();
        } finally {
          setIsLoading(false);
        }
      }
    },
    [
      taskData,
      quillInstance,
      selectedFiles,
      checkedComment,
      userId,
      parentTaskId,
      rootTaskId,
      fileComments,
      globalTaskId,
      projectDeadline,
      businessProcessInstanceId,
      resetFormAfterSuccessfulCreate,
      onClose,
      setOpen,
    ]
  );

  const handleSubmitWithComments = useCallback(async () => {
    if (taskData.implementers.length === 0) {
      Toastify({
        text: "Необходимо указать ИСПОЛНИТЕЛЯ",
        close: true,
        backgroundColor: "linear-gradient(to right, #8B0000, #ff0000)",
      }).showToast();
      return;
    }

    if (!String(taskData.title || "").trim()) {
      Toastify({
        text: "Необходимо указать НАИМЕНОВАНИЕ ЗАДАЧИ",
        close: true,
        backgroundColor: "linear-gradient(to right, #8B0000, #ff0000)",
      }).showToast();
      return;
    }

    const invalidSkip = (absenceMeta || []).find(
      (entry) =>
        entry.needsSkipSubstitution &&
        entry.absence &&
        !isDeadlineAfterAbsence(taskData.deadline, entry.absence)
    );
    if (invalidSkip) {
      const endDay = getAbsenceEndDate(invalidSkip.absence);
      Toastify({
        text: endDay
          ? `Срок задачи должен быть после ${formatDateRuLocal(endDay)}, либо удалите отсутствующего сотрудника без замещающего.`
          : "Измените срок задачи или удалите отсутствующего сотрудника без замещающего.",
        close: true,
        backgroundColor: "linear-gradient(to right, #8B0000, #ff0000)",
      }).showToast();
      return;
    }

    const choicesFromMeta = getAbsenceChoicesAtSave(
      absenceMeta,
      taskData.deadline,
      absencesMap
    );
    const choiceKeys = new Set(
      choicesFromMeta.map((c) => `${c.roleKey}:${c.effectiveId}`)
    );
    const choices = [...choicesFromMeta];
    for (const roleKey of ["implementers", "approvers", "viewers"]) {
      const fallback = findAbsenceChoicesFromAssignees(
        taskData[roleKey],
        taskData.deadline,
        absencesMap,
        roleKey
      );
      fallback.forEach((entry) => {
        const key = `${entry.roleKey}:${entry.effectiveId}`;
        if (!choiceKeys.has(key)) {
          choiceKeys.add(key);
          choices.push(entry);
        }
      });
    }
    if (choices.length > 0) {
      choiceEntriesRef.current = choices;
      choiceDecisionsRef.current = {};
      setAbsenceMeta((prev) => {
        const next = [...(prev || [])];
        choices.forEach((entry) => {
          const exists = next.some(
            (e) =>
              e.roleKey === entry.roleKey &&
              String(e.effectiveId) === String(entry.effectiveId)
          );
          if (!exists) next.push(entry);
        });
        return refreshAbsenceMetaNotes(next, taskData.deadline, users, absencesMap);
      });
      setChoiceQueue(choices);
      setCurrentChoice(choices[0]);
      return;
    }

    choiceEntriesRef.current = [];
    const plan = buildAssignmentPlan(taskData, absenceMeta, {});
    await createTasksWithPlan(plan);
  }, [taskData, absenceMeta, createTasksWithPlan, absencesMap, users]);

  const finishAbsenceChoice = useCallback(
    (decision) => {
      if (!currentChoice) return;
      const key = `${currentChoice.roleKey}:${currentChoice.effectiveId}`;
      choiceDecisionsRef.current = {
        ...choiceDecisionsRef.current,
        [key]: decision,
      };
      const rest = choiceQueue.slice(1);
      if (rest.length > 0) {
        setChoiceQueue(rest);
        setCurrentChoice(rest[0]);
        return;
      }
      setChoiceQueue([]);
      setCurrentChoice(null);

      const mergedMeta = [...(absenceMeta || [])];
      ;(choiceEntriesRef.current || []).forEach((entry) => {
        const exists = mergedMeta.some(
          (e) =>
            e.roleKey === entry.roleKey &&
            String(e.effectiveId) === String(entry.effectiveId)
        );
        if (!exists) mergedMeta.push(entry);
      });

      const plan = buildAssignmentPlan(
        taskData,
        mergedMeta,
        choiceDecisionsRef.current
      );
      choiceEntriesRef.current = [];
      createTasksWithPlan(plan);
    },
    [currentChoice, choiceQueue, taskData, absenceMeta, createTasksWithPlan]
  );

  const cancelAbsenceChoice = useCallback(() => {
    setChoiceQueue([]);
    setCurrentChoice(null);
    choiceDecisionsRef.current = {};
    choiceEntriesRef.current = [];
  }, []);

  const handleCommentSubmit = () => {
    const currentFile = selectedFiles[currentFileIndex];
    setFileComments((prev) => ({
      ...prev,
      [currentFile.name]: commentInput,
    }));

    if (currentFileIndex < selectedFiles.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1);
      setCommentInput("");
    } else {
      setShowCommentModal(false);
      setCommentInput("");
      handleSubmitWithComments();
    }
  };

  useEffect(() => {
    if (quillRef.current && !quillInstance) {
      const quill = new Quill(quillRef.current, {
        theme: "snow",
        modules: {
          toolbar: [
            [{ header: [1, 2, false] }],
            ["bold", "italic", "underline"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["clean"],
            /* {
              ['link', 'image'],
            },*/
          ],
        },
      });
      setQuillInstance(quill);

      const initialDescription =
        taskData.description ||
        (externalInitialTaskData && externalInitialTaskData.description) ||
        (selectedTemplate && selectedTemplate.description) ||
        '';
      if (initialDescription) {
        quill.root.innerHTML = initialDescription;
      }

      quill.on("text-change", () => {
        setTaskData((prev) => ({ ...prev, description: quill.root.innerHTML }));
      });
      return () => {
        quill.off("text-change");
      };
    }
  }, [quillInstance, selectedTemplate, externalInitialTaskData, taskData.description]);

  const availableTags = useMemo(() => {
    let existingTags = [];
    try {
      existingTags = taskData.tags
        ? JSON.parse(taskData.tags).map((tag) => tag.title)
        : [];
    } catch (error) {
      existingTags = [];
    }
    return tagOptions.filter((tag) => !existingTags.includes(tag));
  }, [taskData.tags, tagOptions]);

  const remainingUsersForRole = useCallback(
    (roleKey) => {
      return users.filter(
        (user) => !taskData[roleKey].includes(user.id)
        // user.id !== taskData.created_by // ДАННУЮ ЛОГИКУ УДАЛЯТЬ НЕЛЬЗЯ! Запрещает создателю задачи назначать себя исполнителем/зрителем/утверждающим
      );
    },
    [users, taskData]
  );

  return (
    <div className={`${styles.modal} ${isOpen ? "" : styles.hidden} `}>
      <div className={styles.overlay} onClick={closeModal}></div>
      <div className={styles.content}>
        <div className={styles.left}>
          <input
            type="text"
            name="title"
            value={taskData.title}
            onChange={handleChange}
            placeholder="Наименование задачи"
            required
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            style={{
              pointerEvents: "auto",
              position: "relative",
              zIndex: 100001,
            }}
          />

          <div
            className={styles.editorContainer}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
          >
            <div ref={quillRef} className="ql-editor" />
          </div>

          <select
            name="priority"
            onChange={handleChange}
            value={taskData.priority}
          >
            <option value="">Приоритет</option>
            <option style={{ color: "green" }} value="низкий">
              Низкий
            </option>
            <option style={{ color: "blue" }} value="средний">
              Средний
            </option>
            <option style={{ color: "red" }} value="высокий">
              Высокий
            </option>
          </select>

          <div>
            <label htmlFor="deadline" style={{ fontWeight: "bold" }}>
              Срок исполнения задачи
              {projectDeadline && (
                <span style={{ fontSize: "0.8em", color: "#6b7280", fontWeight: "normal", marginLeft: 6 }}>
                  (не позже срока проекта)
                </span>
              )}
            </label>
            <input
              type="datetime-local"
              id="deadline"
              name="deadline"
              onChange={handleChange}
              value={taskData.deadline || ""}
              onClick={handleInputClick}
              onFocus={handleFocus}
              max={
                projectDeadline
                  ? (() => {
                      const d = new Date(projectDeadline);
                      if (Number.isNaN(d.getTime())) return undefined;
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, "0");
                      const day = String(d.getDate()).padStart(2, "0");
                      const h = String(d.getHours()).padStart(2, "0");
                      const min = String(d.getMinutes()).padStart(2, "0");
                      return `${y}-${m}-${day}T${h}:${min}`;
                    })()
                  : undefined
              }
            />
          </div>

          <FileUploaderTask
            checkedComment={checkedComment}
            handlecheckedComment={handlecheckedComment}
            handleFileChange={handleFileChange}
            selectedFiles={selectedFiles}
            removeFile={removeFile}
            hasDangerousFiles={hasDangerousFiles}
            isLoading={isLoading}
          />

          <button
            className={`${styles["submit-button"]} ${
              hasDangerousFiles || isLoading
                ? styles["submit-button-disabled"]
                : ""
            } ${styles["button-add-task"]}`}
            onClick={() => {
              if (checkedComment && selectedFiles.length > 0) {
                setShowCommentModal(true);
                setCurrentFileIndex(0);
                setCommentInput("");
              } else {
                handleSubmitWithComments();
              }
            }}
            disabled={hasDangerousFiles || isLoading}
          >
            {hasDangerousFiles
              ? "В целях безопасности исполняемый файл отправить невозможно"
              : isLoading
              ? "Отправка задачи..."
              : "Отправить задачу"}
          </button>
        </div>

        <div className={styles.right}>
          {/*   Добавить тег*/}
          <TagManagerSectionTask
            taskData={taskData}
            selectedTag={selectedTag}
            setSelectedTag={setSelectedTag}
            handleOpenDropdown={handleOpenDropdown}
            handleAddTag={handleAddTag}
            handleRemoveTag={handleRemoveTag}
            availableTags={availableTags}
            handleOpenTagsManager={handleOpenTagsManager}
          />

          {/*  Добавить исполнителя*/}
          <UserRoleSectionTask
            title="Добавить исполнителя"
            roleKey="implementers"
            selectedUser={selectedImplementer}
            setSelectedUser={setSelectedImplementer}
            taskData={taskData}
            users={users}
            remainingUsersForRole={remainingUsersForRole}
            handleAddUser={handleAddUser}
            handleRemoveUser={handleRemoveUser}
            absencesMap={absencesMap}
            absenceMeta={absenceMeta}
          />
          {/* Добавить зрителя*/}
          <UserRoleSectionTask
            title="Добавить зрителя"
            roleKey="viewers"
            selectedUser={selectedViewer}
            setSelectedUser={setSelectedViewer}
            taskData={taskData}
            users={users}
            remainingUsersForRole={remainingUsersForRole}
            handleAddUser={handleAddUser}
            handleRemoveUser={handleRemoveUser}
            absencesMap={absencesMap}
            absenceMeta={absenceMeta}
          />
          {/*Добавить утверждающих*/}
          <UserRoleSectionTask
            title="Добавить утверждающих"
            roleKey="approvers"
            selectedUser={selectedApprover}
            setSelectedUser={setSelectedApprover}
            taskData={taskData}
            users={users}
            remainingUsersForRole={remainingUsersForRole}
            handleAddUser={handleAddUser}
            handleRemoveUser={handleRemoveUser}
            absencesMap={absencesMap}
            absenceMeta={absenceMeta}
          />
        </div>
      </div>
      <AbsenceAssigneeChoiceModal
        open={Boolean(currentChoice)}
        entry={currentChoice}
        users={users}
        deadline={taskData.deadline}
        onKeepSubstitute={() => finishAbsenceChoice("substitute")}
        onAssignOriginal={() => finishAbsenceChoice("original")}
        onCancel={cancelAbsenceChoice}
      />
      {isTagsManagerOpen && (
        <Suspense fallback={<div>Loading tags manager...</div>}>
          <TagsManager onClose={() => setIsTagsManagerOpen(false)} />
        </Suspense>
      )}
      {showCommentModal && (
        <div
          className={styles.commentModal}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCommentModal(false);
          }}
        >
          <div
            className={styles.commentModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>
              Комментарий для файла: {selectedFiles[currentFileIndex]?.name}
            </h3>
            <textarea
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Введите комментарий к файлу"
              className={styles.commentTextarea}
            />
            <div className={styles.commentModalButtons}>
              <button
                type="button"
                onClick={() => {
                  setShowCommentModal(false);
                  setCommentInput("");
                  setCurrentFileIndex(0);
                  setFileComments({});
                }}
                className={styles.commentCancelButton}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCommentSubmit}
                className={styles.commentSubmitButton}
              >
                {currentFileIndex < selectedFiles.length - 1
                  ? "Следующий файл"
                  : "Завершить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddModal;
