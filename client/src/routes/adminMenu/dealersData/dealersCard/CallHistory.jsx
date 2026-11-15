import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Pagination,
  CircularProgress,
  Divider,
  Avatar,
  Grid,
  Paper,
} from "@mui/material";
import {
  Phone,
  PhoneCallback,
  Email,
  CheckCircle,
  Schedule,
  Assignment,
  Person,
  Business,
  AccessTime,
  Description,
  Title,
} from "@mui/icons-material";
import { API_BASE_URL } from "../../../../../config";
import useUserStore from "../../../../store/userStore";
import "./callHistory.scss";

const talkMarkText = {
  short: "Короткий",
  long: "Длинный",
};

const CallPlayer = ({ callId, userId }) => {
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState("1");
  const src = `${API_BASE_URL}5004/api/calls/${callId}/recording?userId=${userId}`;

  return (
    <span className="call-player">
      <button type="button" onClick={() => setOpen((value) => !value)}>
        {open ? "Скрыть" : "Слушать"}
      </button>
      {open ? (
        <>
          <audio
            controls
            src={src}
            onLoadedMetadata={(event) => {
              event.currentTarget.playbackRate = Number(rate);
            }}
          />
          <select
            value={rate}
            aria-label="Скорость"
            onChange={(event) => {
              const next = event.target.value;
              setRate(next);
              const audio = event.target.parentElement.querySelector("audio");
              if (audio) audio.playbackRate = Number(next);
            }}
          >
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </>
      ) : null}
    </span>
  );
};

const CallHistory = ({ companyId }) => {
  const { user } = useUserStore();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });

  const fetchCalls = useCallback(
    async (page = 1) => {
      if (!companyId) return;
      setLoading(true);
      try {
        const viewer = user?.id ? `&userId=${user.id}` : "";
        const response = await fetch(
          `${API_BASE_URL}5004/api/company-calls/${companyId}?page=${page}&limit=${pagination.limit}${viewer}`
        );
        if (response.ok) {
          const data = await response.json();
          setCalls(data.data);
          setPagination((prev) => ({
            ...prev,
            page: data.page,
            total: data.total,
          }));
        } else {
          console.error("Ошибка при загрузке истории звонков");
        }
      } catch (error) {
        console.error("Ошибка при загрузке истории звонков:", error);
      } finally {
        setLoading(false);
      }
    },
    [companyId, pagination.limit, user?.id]
  );

  useEffect(() => {
    fetchCalls(pagination.page);
  }, [fetchCalls, pagination.page]);

  const handlePageChange = (event, newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const getOutcomeIcon = (outcome) => {
    switch (outcome) {
      case "success":
        return <CheckCircle style={{ color: "#4caf50" }} />;
      case "callback":
        return <PhoneCallback style={{ color: "#2196f3" }} />;
      case "send_info":
        return <Email style={{ color: "#9c27b0" }} />;
      default:
        return <Phone style={{ color: "#757575" }} />;
    }
  };

  const getOutcomeText = (outcome) => {
    switch (outcome) {
      case "success":
        return "Завершено";
      case "failed":
        return "Неудачно";
      case "postponed":
        return "Отложено";
      case "callback":
        return "Перезвонить";
      case "send_info":
        return "Создать задачу";
      default:
        return "Неизвестно";
    }
  };

  const getDirectionText = (direction) => {
    if (direction === "incoming") return "Входящий";
    if (direction === "outgoing") return "Исходящий";
    return "";
  };

  const formatTalk = (seconds) => {
    if (seconds === null || seconds === undefined || seconds === "") {
      return "нет данных";
    }
    const value = Number(seconds);
    if (!Number.isFinite(value)) return "нет данных";
    if (value < 60) return `${value} с`;
    const minutes = Math.floor(value / 60);
    const rest = value % 60;
    return rest ? `${minutes} мин ${rest} с` : `${minutes} мин`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "accepted":
        return "success";
      case "missed":
        return "error";
      case "processed":
        return "info";
      default:
        return "default";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "accepted":
        return "Принят";
      case "missed":
        return "Пропущен";
      case "processed":
        return "Обработан";
      default:
        return "Неизвестно";
    }
  };

  const getTaskStatusText = (status) => {
    switch (status) {
      case "pending":
        return "В ожидании";
      case "in_progress":
        return "В процессе";
      case "completed":
        return "Завершена";
      case "cancelled":
        return "Отменена";
      case "on_hold":
        return "Приостановлена";
      case "backlog":
        return "В очереди";
      default:
        return status || "Неизвестно";
    }
  };

  const formatDate = (dateString) => {
    // Parse the date string and create a Date object
    const date = new Date(dateString);

    // Add 4 hours to convert from UTC to Saratov time (UTC+4)
    const saratovTime = new Date(date.getTime() + 4 * 60 * 60 * 1000);

    // Format the date in Saratov timezone
    return saratovTime.toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Samara", // Use Samara timezone (UTC+4) for Saratov Oblast
    });
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (calls.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="h6" color="textSecondary">
          История звонков пуста
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Для этой компании пока нет звонков
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="call-history-container">
      <Typography variant="h5" gutterBottom className="call-history-title">
        История звонков
      </Typography>

      <Box className="calls-grid">
        {calls.map((call) => (
          <Card key={call.id} className="call-card" elevation={2}>
            <CardContent className="call-card-content">
              {/* Заголовок карточки */}
              <Box className="call-header">
                <Box className="call-info-main">
                  <Box className="call-number-info">
                    <Phone className="call-icon" />
                    <Typography variant="h6" className="call-number">
                      {call.external_number || call.caller_number}
                    </Typography>
                  </Box>

                  <Box className="call-meta">
                    {getDirectionText(call.direction) ? (
                      <span
                        className={`direction-mark direction-mark--${call.direction}`}
                      >
                        {getDirectionText(call.direction)}
                      </span>
                    ) : null}
                    <Chip
                      label={getStatusText(call.status)}
                      color={getStatusColor(call.status)}
                      size="small"
                      className="status-chip"
                    />
                    <Typography variant="caption" className="call-date">
                      {formatDate(call.accepted_at)}
                    </Typography>
                    <Typography variant="caption" className="call-duration">
                      {formatTalk(call.talk_seconds)}
                    </Typography>
                    {talkMarkText[call.talk_mark] ? (
                      <span className={`talk-mark talk-mark--${call.talk_mark}`}>
                        {talkMarkText[call.talk_mark]}
                      </span>
                    ) : null}
                    {call.can_play && user?.id ? (
                      <CallPlayer callId={call.id} userId={user.id} />
                    ) : call.has_recording ? (
                      <span
                        className="call-recording"
                        title="Файл лежит на АТС. Прослушивание откроется, когда папка записей доступна серверу CRM"
                      >
                        Запись есть
                      </span>
                    ) : null}
                  </Box>
                </Box>

                {/* Иконки напоминаний и задач */}
                <Box className="call-actions">
                  {call.reminder_id && (
                    <Tooltip
                      title={
                        <Box>
                          <Typography variant="body2">
                            <strong>Напоминание ID: {call.reminder_id}</strong>
                          </Typography>
                          <Typography variant="body2">
                            {call.reminder_title || "Без названия"}
                          </Typography>
                          <Typography variant="body2">
                            {call.reminder_comment || "Без описания"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Исполнитель:</strong>{" "}
                            {call.reminder_executor_name || "Не назначен"}
                          </Typography>
                          {call.reminder_date && (
                            <Typography variant="body2">
                              Дата: {formatDate(call.reminder_date)}
                            </Typography>
                          )}
                        </Box>
                      }
                      arrow
                    >
                      <IconButton size="small" className="reminder-icon">
                        <Schedule style={{ color: "#ff9800" }} />
                      </IconButton>
                    </Tooltip>
                  )}

                  {call.task_id && (
                    <Tooltip
                      title={
                        <Box>
                          <Typography variant="body2">
                            <strong>Задача ID: {call.task_id}</strong>
                          </Typography>
                          <Typography variant="body2">
                            {call.task_title || "Без названия"}
                          </Typography>
                          <Typography variant="body2">
                            {call.task_description || "Без описания"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Создатель:</strong>{" "}
                            {call.task_creator_name || "Неизвестно"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Исполнители:</strong>{" "}
                            {call.task_executors_names || "Не назначены"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Статус:</strong>{" "}
                            {getTaskStatusText(call.task_status)}
                          </Typography>
                        </Box>
                      }
                      arrow
                    >
                      <IconButton size="small" className="task-icon">
                        <Assignment style={{ color: "#4caf50" }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>

              <Divider className="call-divider" />

              {/* Основная информация о звонке */}
              <Box className="call-details">
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box className="caller-info">
                      <Box className="caller-header">
                        <Person className="caller-icon" />
                        <Typography
                          variant="subtitle2"
                          className="caller-label"
                        >
                          {call.direction === "outgoing"
                            ? "Менеджер:"
                            : "Звонящий:"}
                        </Typography>
                      </Box>
                      <Typography variant="body2" className="caller-name">
                        {call.caller_name ||
                          (call.direction === "outgoing"
                            ? "не указан"
                            : "Неизвестно")}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box className="receiver-info">
                      <Box className="receiver-header">
                        <Business className="receiver-icon" />
                        <Typography
                          variant="subtitle2"
                          className="receiver-label"
                        >
                          {call.direction === "outgoing"
                            ? "Контакт:"
                            : "Менеджер:"}
                        </Typography>
                      </Box>
                      <Typography variant="body2" className="receiver-name">
                        {call.receiver_name ||
                          (call.direction === "outgoing"
                            ? call.contact_name || "Неизвестно"
                            : "не указан")}
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Цель звонка */}
                  {call.purpose_name && (
                    <Grid item xs={12} sm={6}>
                      <Box className="purpose-info">
                        <Box className="purpose-header">
                          <Title className="purpose-icon" />
                          <Typography
                            variant="subtitle2"
                            className="purpose-label"
                          >
                            Цель:
                          </Typography>
                        </Box>
                        <Typography variant="body2" className="purpose-name">
                          {call.purpose_name}
                        </Typography>
                      </Box>
                    </Grid>
                  )}

                  {/* Итог звонка */}
                  {call.outcome && (
                    <Grid item xs={12} sm={6}>
                      <Box className="outcome-info">
                        <Box className="outcome-header">
                          {getOutcomeIcon(call.outcome)}
                          <Typography
                            variant="subtitle2"
                            className="outcome-label"
                          >
                            Итог:
                          </Typography>
                        </Box>
                        <Typography variant="body2" className="outcome-text">
                          {getOutcomeText(call.outcome)}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>

                {/* Описание звонка */}
                {call.description && (
                  <Box className="description-section">
                    <Box className="description-header">
                      <Description className="description-icon" />
                      <Typography
                        variant="subtitle2"
                        className="description-label"
                      >
                        Описание:
                      </Typography>
                    </Box>
                    <Typography variant="body2" className="description-text">
                      {call.description}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Пагинация */}
      {pagination.total > pagination.limit && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={Math.ceil(pagination.total / pagination.limit)}
            page={pagination.page}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};

export default CallHistory;
