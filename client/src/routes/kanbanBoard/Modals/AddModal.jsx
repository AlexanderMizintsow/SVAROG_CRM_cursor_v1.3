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

const AddModal = ({
  isOpen,
  onClose,
  setOpen,
  userId,
  globalTaskId,
  parentTaskId,
  rootTaskId,
}) => {
  const initialTaskData = {
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
    parentTaskId, // Добавляем parentTaskId
    rootTaskId,
  };

  const [taskData, setTaskData] = useState(initialTaskData);
  const [users, setUsers] = useState([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedImplementer, setSelectedImplementer] = useState("");
  const [selectedApprover, setSelectedApprover] = useState("");
  const [selectedViewer, setSelectedViewer] = useState("");
  const [quillInstance, setQuillInstance] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [hasDangerousFiles, setHasDangerousFiles] = useState(false);
  const [isTagSelected, setIsTagSelected] = useState(false);
  const [isApprovingSelected, setIsApprovingSelected] = useState(false);
  const [isViewersSelected, setIsViewersSelected] = useState(false);
  const [isImplementersSelected, setIsImplementersSelected] = useState(false);
  const [checkedComment, setCheckedComment] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTagsManagerOpen, setIsTagsManagerOpen] = useState(false);
  const [dbTags, setDbTags] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [fileComments, setFileComments] = useState({});

  const quillRef = useRef(null);

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
    },
    {
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
    }
  );

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

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setTaskData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const closeModal = () => {
    setOpen(false);
    onClose();
    setTaskData(initialTaskData);
    setSelectedTemplate(null);
  };

  const handleSubmitWithComments = useCallback(async () => {
    if (taskData.implementers.length === 0) {
      Toastify({
        text: "Необходимо указать ИСПОЛНИТЕЛЯ",
        close: true,
        backgroundColor: "linear-gradient(to right, #8B0000, #ff0000)",
      }).showToast();
      return;
    }

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

      try {
        setIsLoading(true);
        const taskIds = [];

        // Создаем задачи для каждого исполнителя
        for (const implementer of taskData.implementers) {
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

          const response = await axios.post(
            `${API_BASE_URL}5000/api/tasks/create`,
            taskToSubmit
          );
          const taskId = response.data.id;
          taskIds.push(taskId);

          await axios.post(`${API_BASE_URL}5000/api/tasks/assignment/add`, {
            task_id: taskId,
            user_id: implementer,
          });
        }

        // Добавляем согласующих
        for (const approver of taskData.approvers) {
          for (const taskId of taskIds) {
            await axios.post(`${API_BASE_URL}5000/api/tasks/approval/add`, {
              task_id: taskId,
              approver_id: approver,
            });
          }
        }

        // Добавляем наблюдателей
        for (const viewer of taskData.viewers) {
          for (const taskId of taskIds) {
            await axios.post(`${API_BASE_URL}5000/api/tasks/visibility/add`, {
              task_id: taskId,
              user_id: viewer,
            });
          }
        }

        // Обработка вложений
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

          // Для каждого файла создаем вложение для каждой задачи
          for (let i = 0; i < fileUrls.length; i++) {
            const file = selectedFiles[i];
            const comment = checkedComment ? fileComments[file.name] || "" : "";

            for (const taskId of taskIds) {
              await axios.post(`${API_BASE_URL}5000/api/tasks/attachment/add`, {
                task_id: taskId,
                file_url: fileUrls[i],
                file_type: file.type,
                comment_file: comment,
                name_file: file.name,
                uploaded_by: userId,
              });
            }
          }
        }

        // Отправляем уведомление через сокет
        await axios.post(`${API_BASE_URL}5000/api/tasks/socket`, {
          id: taskIds,
          createdBy: userId,
          assignedUsers: taskData.implementers,
          approvers: taskData.approvers,
          viewers: taskData.viewers,
        });

        Toastify({
          text: "Задачи успешно добавлены",
          close: true,
          backgroundColor: "linear-gradient(to right, #006400, #00FF00)",
        }).showToast();
        quillInstance.root.innerHTML = "";
        closeModal();
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
  }, [
    taskData,
    quillInstance,
    selectedFiles,
    checkedComment,
    userId,
    parentTaskId,
    rootTaskId,
    fileComments,
  ]);

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
      if (selectedTemplate) {
        quill.root.innerHTML = selectedTemplate.description;
      }
      quill.on("text-change", () => {
        setTaskData((prev) => ({ ...prev, description: quill.root.innerHTML }));
      });
      return () => {
        quill.off("text-change");
      };
    }
  }, [quillInstance, selectedTemplate]);

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
        (user) =>
          !taskData[roleKey].includes(user.id) &&
          user.id !== taskData.created_by
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
          />

          <div className={styles.editorContainer}>
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
            </label>
            <input
              type="datetime-local"
              id="deadline"
              name="deadline"
              onChange={handleChange}
              onClick={handleInputClick} // Обработчик клика
              onFocus={handleFocus} // Обработчик фокуса
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
            isTagSelected={isTagSelected}
            setIsTagSelected={setIsTagSelected}
            handleOpenDropdown={handleOpenDropdown}
            handleAddTag={() => handleAddTag()}
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
            isSelected={isImplementersSelected}
            setIsSelected={setIsImplementersSelected}
            taskData={taskData}
            users={users}
            remainingUsersForRole={remainingUsersForRole}
            handleAddUser={handleAddUser}
            handleRemoveUser={handleRemoveUser}
          />
          {/* Добавить зрителя*/}
          <UserRoleSectionTask
            title="Добавить зрителя"
            roleKey="viewers"
            selectedUser={selectedViewer}
            setSelectedUser={setSelectedViewer}
            isSelected={isViewersSelected}
            setIsSelected={setIsViewersSelected}
            taskData={taskData}
            users={users}
            remainingUsersForRole={remainingUsersForRole}
            handleAddUser={handleAddUser}
            handleRemoveUser={handleRemoveUser}
          />
          {/*Добавить утверждающих*/}
          <UserRoleSectionTask
            title="Добавить утверждающих"
            roleKey="approvers"
            selectedUser={selectedApprover}
            setSelectedUser={setSelectedApprover}
            isSelected={isApprovingSelected}
            setIsSelected={setIsApprovingSelected}
            taskData={taskData}
            users={users}
            remainingUsersForRole={remainingUsersForRole}
            handleAddUser={handleAddUser}
            handleRemoveUser={handleRemoveUser}
          />
        </div>
      </div>
      {isTagsManagerOpen && (
        <Suspense fallback={<div>Loading tags manager...</div>}>
          <TagsManager onClose={() => setIsTagsManagerOpen(false)} />
        </Suspense>
      )}
      {showCommentModal && (
        <div className={styles.commentModal}>
          <div className={styles.commentModalContent}>
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
