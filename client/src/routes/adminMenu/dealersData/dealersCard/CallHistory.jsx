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
import "./callHistory.scss";

const CallHistory = ({ companyId }) => {
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
        const response = await fetch(
          `${API_BASE_URL}5004/api/company-calls/${companyId}?page=${page}&limit=${pagination.limit}`
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
    [companyId, pagination.limit]
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
      case "callback":
        return "Перезвонить";
      case "send_info":
        return "Создать задачу";
      default:
        return "Неизвестно";
    }
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
      default:
        return status || "Неизвестно";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
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
          Для этой компании пока нет звонков с описанием
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
                      {call.caller_number}
                    </Typography>
                  </Box>

                  <Box className="call-meta">
                    <Chip
                      label={getStatusText(call.status)}
                      color={getStatusColor(call.status)}
                      size="small"
                      className="status-chip"
                    />
                    <Typography variant="caption" className="call-date">
                      {formatDate(call.accepted_at)}
                    </Typography>
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
                  {/* Звонящий */}
                  <Grid item xs={12} sm={6}>
                    <Box className="caller-info">
                      <Box className="caller-header">
                        <Person className="caller-icon" />
                        <Typography
                          variant="subtitle2"
                          className="caller-label"
                        >
                          Звонящий:
                        </Typography>
                      </Box>
                      <Typography variant="body2" className="caller-name">
                        {call.caller_name || "Неизвестно"}
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Получатель */}
                  <Grid item xs={12} sm={6}>
                    <Box className="receiver-info">
                      <Box className="receiver-header">
                        <Business className="receiver-icon" />
                        <Typography
                          variant="subtitle2"
                          className="receiver-label"
                        >
                          Получатель:
                        </Typography>
                      </Box>
                      <Typography variant="body2" className="receiver-name">
                        {call.receiver_name || "Неизвестно"}
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
