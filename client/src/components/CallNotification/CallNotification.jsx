import React, { useState, useEffect } from "react";
import {
  Modal,
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from "@mui/material";
import AddModal from "../../routes/kanbanBoard/Modals/AddModal";
import {
  Phone,
  PhoneDisabled,
  CallEnd,
  Person,
  Business,
  CheckCircle,
  Cancel,
  Schedule,
  PhoneCallback,
  Email,
} from "@mui/icons-material";
import Toastify from "toastify-js";
import { BsClock } from "react-icons/bs";
import ScheduleCallModal from "../scheduleCallModal/ScheduleCallModal";
import { API_BASE_URL } from "../../../config";
import "./CallNotification.scss";

const CallNotification = ({ callData, onClose }) => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [callPurposes, setCallPurposes] = useState([]);
  const [selectedPurpose, setSelectedPurpose] = useState("");
  const [description, setDescription] = useState("");
  const [outcome, setOutcome] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isDataSaved, setIsDataSaved] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [initialTaskData, setInitialTaskData] = useState(null);
  const [existingReminderId, setExistingReminderId] = useState(null);
  const [existingTaskId, setExistingTaskId] = useState(null);

  console.log("CallNotification render:", { callData, isActive, timeElapsed });

  // Загрузка целей звонков
  useEffect(() => {
    const fetchCallPurposes = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}5004/api/call-purposes`);
        if (response.ok) {
          const data = await response.json();
          setCallPurposes(data);
        }
      } catch (error) {
        console.error("Ошибка при загрузке целей звонков:", error);
      }
    };

    fetchCallPurposes();
  }, []);

  // Загрузка данных звонка при изменении callData
  useEffect(() => {
    console.log("callData изменился:", callData);

    // Проверяем различные возможные поля для ID звонка
    const callId = callData?.callId || callData?.id || callData?.call_id;

    if (callId) {
      console.log("Найден ID звонка:", callId);
      const fetchCallDetails = async () => {
        try {
          console.log("Загружаем детали звонка для ID:", callId);
          const response = await fetch(
            `${API_BASE_URL}5004/api/calls/${callId}/details`
          );
          console.log("Ответ от сервера:", response.status);

          if (response.ok) {
            const data = await response.json();
            console.log("Полученные данные звонка:", data);
            // Загружаем данные только если поля пустые, чтобы не перезаписывать введенные данные
            if (!selectedPurpose) setSelectedPurpose(data.purpose_id || "");
            if (!description) setDescription(data.description || "");
            if (!outcome) setOutcome(data.outcome || "");

            // Сохраняем существующие ID
            if (data.reminder_id) setExistingReminderId(data.reminder_id);
            if (data.task_id) setExistingTaskId(data.task_id);

            // Если данные уже есть в базе, считаем что они сохранены
            if (data.purpose_id || data.description || data.outcome) {
              setIsDataSaved(true);
            }

            // Если purpose_id установлен, но selectedPurpose пустой, проверяем не "Без цели" ли это
            if (data.purpose_id && !selectedPurpose) {
              const noPurpose = callPurposes.find(
                (p) => p.id === data.purpose_id && p.name === "Консультация"
              );
              if (noPurpose) {
                // Не устанавливаем selectedPurpose для "Без цели", чтобы пользователь мог выбрать реальную цель
                console.log(
                  "Найдена цель 'Консультация', оставляем поле пустым для выбора"
                );
              }
            }
          } else {
            console.error(
              "Ошибка при загрузке деталей звонка:",
              response.status
            );
          }
        } catch (error) {
          console.error("Ошибка при загрузке деталей звонка:", error);
        }
      };

      fetchCallDetails();
    } else {
      console.log("ID звонка не найден в callData");
    }
  }, [callData]);

  useEffect(() => {
    let timer = null;

    if (callData?.type === "incoming_call") {
      setIsActive(true);
      setTimeElapsed(0);
      timer = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    } else if (callData?.type === "call_started") {
      setIsActive(true);
      setTimeElapsed(0);
      timer = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    } else if (callData?.type === "call_ended") {
      setIsActive(false);
      // Останавливаем таймер при завершении звонка
      setTimeElapsed(0);
      if (timer) {
        clearInterval(timer);
      }
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [callData?.type]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getCallerIcon = () => {
    if (callData?.callerType === "user") {
      return <Person fontSize="medium" />;
    } else if (callData?.callerType === "dealer") {
      return <Business fontSize="medium" />;
    }
    return <Phone fontSize="medium" />;
  };

  const getCallerTypeText = () => {
    if (callData?.callerType === "user") {
      return "Сотрудник";
    } else if (callData?.callerType === "dealer") {
      return "Дилер";
    }
    return "Неизвестный";
  };

  const getNotificationTitle = () => {
    switch (callData?.type) {
      case "incoming_call":
        return "Входящий звонок";
      case "call_started":
        return "Активный звонок";
      case "call_ended":
        return "Вызов завершен";
      default:
        return "Звонок";
    }
  };

  const getNotificationMessage = () => {
    switch (callData?.type) {
      case "incoming_call":
        return "Необходимо взять трубку";
      case "call_started":
        return "Разговор активен";
      case "call_ended":
        return "Вызов завершен";
      default:
        return "";
    }
  };

  const getStatusColor = () => {
    switch (callData?.type) {
      case "incoming_call":
        return "warning";
      case "call_started":
        return "success";
      case "call_ended":
        return "default";
      default:
        return "primary";
    }
  };

  const handleScheduleModalOpen = () => {
    setScheduleModalOpen(true);
  };

  const handleScheduleModalClose = (reminderId) => {
    setScheduleModalOpen(false);

    // Если получен ID напоминания, обновляем звонок
    if (reminderId) {
      updateCallWithReminderId(reminderId);
    }
  };

  // Сохранение данных звонка
  const handleSaveCallData = async () => {
    console.log("Начинаем сохранение данных звонка...");
    console.log("callData:", callData);
    console.log("selectedPurpose:", selectedPurpose);
    console.log("description:", description);
    console.log("outcome:", outcome);

    // Проверяем различные возможные поля для ID звонка
    const callId = callData?.callId || callData?.id || callData?.call_id;

    if (!callId) {
      console.error("ID звонка не найден в callData");
      alert("Ошибка: ID звонка не найден");
      return;
    }

    setIsLoading(true);
    try {
      // Если итог выбран, но цель не выбрана, автоматически устанавливаем "Без цели"
      let finalPurposeId = selectedPurpose;
      if (outcome && !selectedPurpose) {
        // Находим ID цели "Без цели"
        const noPurpose = callPurposes.find((p) => p.name === "Без цели");
        if (noPurpose) {
          finalPurposeId = noPurpose.id;
        }
      }

      const requestBody = {
        purpose_id: finalPurposeId || null,
        description: description || "",
        outcome: outcome || null,
        reminder_id: existingReminderId, // Сохраняем существующий reminder_id
        task_id: existingTaskId, // Сохраняем существующий task_id
      };

      console.log("Отправляем запрос:", {
        url: `${API_BASE_URL}5004/api/calls/${callId}`,
        method: "PUT",
        body: requestBody,
      });
      console.log(
        "Существующие ID - reminder_id:",
        existingReminderId,
        "task_id:",
        existingTaskId
      );

      const response = await fetch(`${API_BASE_URL}5004/api/calls/${callId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Получен ответ:", response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log("Данные звонка успешно сохранены:", result);
        setIsDataSaved(true);
        Toastify({
          text: `Информация о звонке успешно сохранена!`,
          duration: 5000,
          close: true,
          style: {
            background: "linear-gradient(to right, #800080, #DA70D6)",
          },
        }).showToast();

        // Если итог "Перезвонить", автоматически открываем модальное окно для назначения времени
        if (outcome === "callback") {
          setScheduleModalOpen(true);
        }

        // Если итог "Создать задачу", автоматически открываем AddModal
        if (outcome === "send_info") {
          // Получаем название цели звонка
          const purposeName =
            callPurposes.find((p) => p.id === finalPurposeId)?.name ||
            "Неизвестная цель";

          // Подготавливаем данные для предзаполнения задачи
          const taskData = {
            title: `Входящий звонок - ${purposeName}`,
            description: description || "",
          };

          setInitialTaskData(taskData);
          setIsAddModalOpen(true);
        }
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Неизвестная ошибка" }));
        console.error("Ошибка при сохранении данных звонка:", errorData);
        Toastify({
          text: `Ошибка при сохранении: ${
            errorData.error || "Неизвестная ошибка"
          }`,
          duration: 5000,
          close: true,
          style: {
            background:
              "linear-gradient(to right,rgb(128, 0, 64),rgb(218, 112, 153))",
          },
        }).showToast();
      }
    } catch (error) {
      console.error("Ошибка при сохранении данных звонка:", error);
      alert(`Ошибка сети: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для обработки закрытия AddModal
  const handleAddModalClose = (taskId) => {
    console.log("=== AddModal закрыт ===");
    console.log("Получен taskId:", taskId);
    console.log("Тип taskId:", typeof taskId);
    console.log("taskId === null:", taskId === null);
    console.log("taskId === undefined:", taskId === undefined);
    console.log("taskId === 0:", taskId === 0);
    console.log("Boolean(taskId):", Boolean(taskId));

    setIsAddModalOpen(false);
    setInitialTaskData(null);

    // Если задача была создана, обновляем звонок с ID задачи
    if (taskId && taskId !== null && taskId !== undefined && taskId !== 0) {
      console.log("✅ Обновляем звонок с ID задачи:", taskId);
      updateCallWithTaskId(taskId);
    } else {
      console.log(
        "❌ ID задачи не получен или невалиден, обновление не требуется"
      );
      console.log("Возможные причины:");
      console.log("- Пользователь закрыл модальное окно без создания задачи");
      console.log("- Произошла ошибка при создании задачи");
      console.log("- taskId равен 0, null или undefined");
    }
  };

  // Функция для обновления звонка с ID задачи
  const updateCallWithTaskId = async (taskId) => {
    console.log("=== updateCallWithTaskId вызвана ===");
    console.log("Полученный taskId:", taskId);
    console.log("Тип taskId:", typeof taskId);

    const callId = callData?.callId || callData?.id || callData?.call_id;
    console.log("callId:", callId);

    if (!callId) {
      console.error("❌ ID звонка не найден для обновления task_id");
      return;
    }

    try {
      const updateData = {
        purpose_id: selectedPurpose || null,
        description: description || "",
        outcome: outcome || null,
        task_id: taskId,
        reminder_id: existingReminderId, // Сохраняем существующий reminder_id
      };

      console.log("🔄 Обновляем звонок с ID задачи:", taskId);
      console.log("📤 Данные для обновления:", updateData);

      const response = await fetch(`${API_BASE_URL}5004/api/calls/${callId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Звонок успешно обновлен с ID задачи:", taskId);
        console.log("📥 Ответ сервера:", result);
        setExistingTaskId(taskId); // Обновляем состояние
        Toastify({
          text: "Задача успешно создана и связана со звонком!",
          duration: 5000,
          close: true,
          style: {
            background: "linear-gradient(to right, #10b981, #34d399)",
          },
        }).showToast();
      } else {
        const errorText = await response.text();
        console.error("❌ Ошибка при обновлении звонка с ID задачи");
        console.error("Статус:", response.status);
        console.error("Ответ:", errorText);
      }
    } catch (error) {
      console.error("Ошибка при обновлении звонка с ID задачи:", error);
    }
  };

  // Функция для обновления звонка с ID напоминания
  const updateCallWithReminderId = async (reminderId) => {
    console.log("=== updateCallWithReminderId вызвана ===");
    console.log("Полученный reminderId:", reminderId);
    console.log("Тип reminderId:", typeof reminderId);

    const callId = callData?.callId || callData?.id || callData?.call_id;
    console.log("callId:", callId);

    if (!callId) {
      console.error("❌ ID звонка не найден для обновления reminder_id");
      return;
    }

    try {
      const updateData = {
        purpose_id: selectedPurpose || null,
        description: description || "",
        outcome: outcome || null,
        reminder_id: reminderId,
        task_id: existingTaskId, // Сохраняем существующий task_id
      };

      console.log("🔄 Обновляем звонок с ID напоминания:", reminderId);
      console.log("📤 Данные для обновления:", updateData);

      const response = await fetch(`${API_BASE_URL}5004/api/calls/${callId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Звонок успешно обновлен с ID напоминания:", reminderId);
        console.log("📥 Ответ сервера:", result);
        setExistingReminderId(reminderId); // Обновляем состояние
      } else {
        const errorText = await response.text();
        console.error("❌ Ошибка при обновлении звонка с ID напоминания");
        console.error("Статус:", response.status);
        console.error("Ответ:", errorText);
      }
    } catch (error) {
      console.error("Ошибка при обновлении звонка с ID напоминания:", error);
    }
  };

  // Подготавливаем данные для ScheduleCallModal в нужном формате
  const getNotificationDataForSchedule = () => {
    // Извлекаем числовой ID из callData
    let numericId = null;

    // Пытаемся получить числовой ID из различных возможных полей
    if (callData?.callId && !isNaN(callData.callId)) {
      numericId = parseInt(callData.callId, 10);
    } else if (callData?.id && !isNaN(callData.id)) {
      numericId = parseInt(callData.id, 10);
    } else if (callData?.call_id && !isNaN(callData.call_id)) {
      numericId = parseInt(callData.call_id, 10);
    }

    // Если не удалось получить числовой ID, используем timestamp как fallback
    if (!numericId) {
      numericId = Math.floor(Date.now() / 1000); // Используем timestamp в секундах
    }

    // Получаем название выбранной цели звонка
    const selectedPurposeName =
      callPurposes.find((p) => p.id === selectedPurpose)?.name || "";

    // Формируем комментарий с информацией о цели и описании
    const callInfoComment = `Цель звонка: ${selectedPurposeName}\n\nОписание звонка:\n${
      description || "Описание не указано"
    }`;

    const notificationData = {
      id: numericId,
      callerName: callData?.callerName || "Неизвестный",
      callerNumber: callData?.callerNumber || "Неизвестный номер",
      status:
        callData?.type === "call_started"
          ? "active"
          : callData?.type === "call_ended"
          ? "ended"
          : "incoming",
      time: new Date().toLocaleString("ru-RU"),
      callInfoComment: callInfoComment, // Добавляем информацию о цели и описании
    };

    console.log("Notification data for schedule:", notificationData);
    return notificationData;
  };

  return (
    <>
      <Modal
        open={!!callData}
        onClose={(event, reason) => {
          // Закрываем модальное окно только если звонок завершен или нажата клавиша Escape
          if (reason === "escapeKeyDown" && callData?.type === "call_ended") {
            onClose();
          }
          // Не закрываем при клике вне окна (backdropClick)
        }}
        className="call-notification-modal"
        disableEscapeKeyDown={callData?.type !== "call_ended"}
      >
        <Box
          className={`call-notification-content ${
            isActive ? "active-call" : ""
          }`}
        >
          <div className="call-header">
            <Typography variant="h6" className="call-title">
              {getNotificationTitle()}
            </Typography>
            {isActive && (
              <Chip
                label={formatTime(timeElapsed)}
                color={getStatusColor()}
                size="small"
                className="call-timer"
              />
            )}
          </div>

          <div className="call-info">
            <div className="caller-info">
              <div className="caller-icon">{getCallerIcon()}</div>
              <div className="caller-details">
                <Typography variant="body1" className="caller-name">
                  {callData?.callerName || "Неизвестный"}
                </Typography>
                <Typography variant="body2" className="caller-type">
                  {getCallerTypeText()}
                </Typography>
                <Typography variant="body2" className="caller-number">
                  {callData?.callerNumber}
                </Typography>
              </div>
            </div>

            <div className="call-message">
              <Typography variant="body1" className="message-text">
                {getNotificationMessage()}
              </Typography>
            </div>

            {callData?.type === "call_ended" && (
              <div className="call-summary">
                <Typography variant="body2" className="duration">
                  Длительность: {formatTime(callData?.duration || 0)}
                </Typography>
                <Typography variant="body2" className="timestamp">
                  {new Date(callData?.timestamp).toLocaleString("ru-RU")}
                </Typography>
              </div>
            )}

            {/* Форма для выбора цели звонка и описания */}
            {(callData?.type === "call_started" ||
              callData?.type === "call_ended" ||
              selectedPurpose ||
              description ||
              outcome) && (
              <div className="call-form" style={{ marginTop: "16px" }}>
                <Typography variant="h6" style={{ marginBottom: "12px" }}>
                  Информация о звонке
                  {(selectedPurpose || description || outcome) && (
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#10b981",
                        marginLeft: "8px",
                        fontWeight: "normal",
                      }}
                    >
                      (заполнено)
                    </span>
                  )}
                </Typography>

                {/* Выбор цели звонка */}
                <FormControl fullWidth style={{ marginBottom: "12px" }}>
                  <InputLabel>Цель звонка</InputLabel>
                  <Select
                    value={selectedPurpose}
                    onChange={(e) => {
                      setSelectedPurpose(e.target.value);
                      setIsDataSaved(false);
                    }}
                    label="Цель звонка"
                  >
                    <MenuItem value="">
                      <em>Выберите цель</em>
                    </MenuItem>
                    {callPurposes.map((purpose) => (
                      <MenuItem key={purpose.id} value={purpose.id}>
                        {purpose.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Поле для описания */}
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Описание звонка"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setIsDataSaved(false);
                  }}
                  placeholder="Введите описание звонка..."
                  style={{ marginBottom: "12px" }}
                />

                {/* Выбор итога звонка */}
                <FormControl fullWidth style={{ marginBottom: "12px" }}>
                  <InputLabel>
                    Итог звонка <span style={{ color: "#ef4444" }}>*</span>
                  </InputLabel>
                  <Select
                    value={outcome}
                    onChange={(e) => {
                      setOutcome(e.target.value);
                      setIsDataSaved(false);
                    }}
                    label="Итог звонка"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderColor: !outcome ? "#ef4444" : undefined,
                        "&:hover": {
                          borderColor: !outcome ? "#dc2626" : undefined,
                        },
                        "&.Mui-focused": {
                          borderColor: !outcome ? "#dc2626" : undefined,
                        },
                      },
                    }}
                  >
                    <MenuItem value="">
                      <em>Выберите итог</em>
                    </MenuItem>
                    <MenuItem value="success">
                      <CheckCircle
                        style={{ marginRight: 8, color: "#10b981" }}
                      />
                      Завершено
                    </MenuItem>
                    <MenuItem value="callback">
                      <PhoneCallback
                        style={{ marginRight: 8, color: "#3b82f6" }}
                      />
                      Перезвонить
                    </MenuItem>
                    <MenuItem value="send_info">
                      <Email style={{ marginRight: 8, color: "#8b5cf6" }} />
                      Создать задачу
                    </MenuItem>
                  </Select>
                </FormControl>

                {/* Кнопка сохранения */}
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveCallData}
                  disabled={isLoading || !outcome}
                  fullWidth
                  style={{ marginBottom: "12px" }}
                >
                  {isLoading ? "Сохранение..." : "Сохранить информацию"}
                </Button>
              </div>
            )}
          </div>

          <div className="call-actions">
            {/* Кнопка "Назначить время для перезвона" для активного и завершенного звонка */}
            {(callData?.type === "call_started" ||
              callData?.type === "call_ended" ||
              selectedPurpose ||
              description ||
              outcome) && (
              <Button
                variant="outlined"
                color="primary"
                onClick={handleScheduleModalOpen}
                startIcon={<BsClock />}
                style={{ marginBottom: "8px" }}
                fullWidth
              >
                Назначить время для перезвона
              </Button>
            )}

            {callData?.type === "call_ended" && (
              <Button
                variant="contained"
                color="primary"
                onClick={onClose}
                disabled={!outcome || !isDataSaved}
                fullWidth
              >
                {!outcome
                  ? "Выберите итог звонка"
                  : !isDataSaved
                  ? "Сохраните информацию"
                  : "Закрыть"}
              </Button>
            )}
          </div>
        </Box>
      </Modal>

      {/* Модальное окно для назначения времени перезвона */}
      {isScheduleModalOpen && (
        <ScheduleCallModal
          isOpen={isScheduleModalOpen}
          onClose={handleScheduleModalClose}
          notificationId={getNotificationDataForSchedule().id}
          typeReminders="call"
          notificationData={getNotificationDataForSchedule()}
        />
      )}

      {/* Модальное окно для создания задачи */}
      <AddModal
        isOpen={isAddModalOpen}
        onClose={handleAddModalClose}
        setOpen={setIsAddModalOpen}
        userId={callData?.userId || 1} // Используем ID пользователя из callData или дефолтное значение
        initialTaskData={initialTaskData}
      />
    </>
  );
};

export default CallNotification;
