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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Phone,
  PhoneDisabled,
  CallEnd,
  Person,
  Business,
  Add,
  CheckCircle,
  Cancel,
  Schedule,
  PhoneCallback,
  Email,
} from "@mui/icons-material";
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
  const [isAddPurposeDialogOpen, setIsAddPurposeDialogOpen] = useState(false);
  const [newPurposeName, setNewPurposeName] = useState("");
  const [newPurposeDescription, setNewPurposeDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDataSaved, setIsDataSaved] = useState(false);

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
            // Если данные уже есть в базе, считаем что они сохранены
            if (data.purpose_id || data.description || data.outcome) {
              setIsDataSaved(true);
            }

            // Если purpose_id установлен, но selectedPurpose пустой, проверяем не "Без цели" ли это
            if (data.purpose_id && !selectedPurpose) {
              const noPurpose = callPurposes.find(
                (p) => p.id === data.purpose_id && p.name === "Без цели"
              );
              if (noPurpose) {
                // Не устанавливаем selectedPurpose для "Без цели", чтобы пользователь мог выбрать реальную цель
                console.log(
                  "Найдена цель 'Без цели', оставляем поле пустым для выбора"
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

  const handleScheduleModalClose = () => {
    setScheduleModalOpen(false);
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
      };

      console.log("Отправляем запрос:", {
        url: `${API_BASE_URL}5004/api/calls/${callId}`,
        method: "PUT",
        body: requestBody,
      });

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
        alert("Информация о звонке успешно сохранена!");
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Неизвестная ошибка" }));
        console.error("Ошибка при сохранении данных звонка:", errorData);
        alert(
          `Ошибка при сохранении: ${errorData.error || "Неизвестная ошибка"}`
        );
      }
    } catch (error) {
      console.error("Ошибка при сохранении данных звонка:", error);
      alert(`Ошибка сети: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Добавление новой цели звонка
  const handleAddPurpose = async () => {
    if (!newPurposeName.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}5004/api/call-purposes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newPurposeName.trim(),
          description: newPurposeDescription.trim(),
        }),
      });

      if (response.ok) {
        const newPurpose = await response.json();
        setCallPurposes([...callPurposes, newPurpose]);
        setSelectedPurpose(newPurpose.id);
        setNewPurposeName("");
        setNewPurposeDescription("");
        setIsAddPurposeDialogOpen(false);
      } else {
        const error = await response.json();
        alert(error.error || "Ошибка при добавлении цели");
      }
    } catch (error) {
      console.error("Ошибка при добавлении цели:", error);
      alert("Ошибка при добавлении цели");
    } finally {
      setIsLoading(false);
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

                {/* Кнопка добавления новой цели */}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => setIsAddPurposeDialogOpen(true)}
                  style={{ marginBottom: "12px" }}
                  fullWidth
                >
                  Добавить новую цель
                </Button>

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
                      Успешно
                    </MenuItem>
                    <MenuItem value="failed">
                      <Cancel style={{ marginRight: 8, color: "#ef4444" }} />
                      Неудачно
                    </MenuItem>
                    <MenuItem value="postponed">
                      <Schedule style={{ marginRight: 8, color: "#f59e0b" }} />
                      Отложено
                    </MenuItem>
                    <MenuItem value="callback">
                      <PhoneCallback
                        style={{ marginRight: 8, color: "#3b82f6" }}
                      />
                      Перезвонить
                    </MenuItem>
                    <MenuItem value="send_info">
                      <Email style={{ marginRight: 8, color: "#8b5cf6" }} />
                      Отправить информацию
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

      {/* Модальное окно для добавления новой цели звонка */}
      <Dialog
        open={isAddPurposeDialogOpen}
        onClose={() => setIsAddPurposeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Добавить новую цель звонка</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Название цели"
            fullWidth
            value={newPurposeName}
            onChange={(e) => setNewPurposeName(e.target.value)}
            style={{ marginBottom: "15px" }}
          />
          <TextField
            margin="dense"
            label="Описание (необязательно)"
            fullWidth
            multiline
            rows={3}
            value={newPurposeDescription}
            onChange={(e) => setNewPurposeDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddPurposeDialogOpen(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleAddPurpose}
            disabled={!newPurposeName.trim() || isLoading}
            variant="contained"
          >
            {isLoading ? "Добавление..." : "Добавить"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CallNotification;
