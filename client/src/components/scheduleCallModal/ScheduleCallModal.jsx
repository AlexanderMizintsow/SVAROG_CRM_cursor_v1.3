import { useState, forwardRef, useEffect } from "react";
import DatePicker from "react-datepicker";
import { ru } from "date-fns/locale";
import axios from "axios";
import useKanbanStore from "../../store/useKanbanStore";
import { getRandomColors } from "../../routes/kanbanBoard/helpers/getRandomColors";
import "react-datepicker/dist/react-datepicker.css";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";

import Toastify from "toastify-js";
import { API_BASE_URL } from "../../../config";
import "./scheduleCallModal.scss";

const CustomDateInput = forwardRef(function CustomDateInput(
  { value, onClick },
  ref
) {
  return (
    <Button variant="outlined" onClick={onClick} ref={ref}>
      {value || "Выберите дату и время"}
    </Button>
  );
});

const ScheduleCallModal = ({
  isOpen,
  onClose,
  notificationId,
  typeReminders,
  notificationData,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [comment, setComment] = useState("");
  const { employeeList } = useKanbanStore(); // Получаем список сотрудников из Zustand
  const userData = JSON.parse(localStorage.getItem("userData")); // Данные текущего пользователя

  // Добавляем проверку на существование notificationData
  const safeNotificationData = notificationData || {
    callerName: "Неизвестный",
    callerNumber: "Неизвестный номер",
    id: notificationId || "unknown",
    status: "unknown",
    time: new Date().toLocaleString("ru-RU"),
  };

  const [infoComment] = useState(`

    НАПОМИНАНИЕ СОЗДАНО ДЛЯ:
    Имя звонящего: ${safeNotificationData.callerName?.trim() || "Неизвестный"}
    Номер звонящего: ${safeNotificationData.callerNumber || "Неизвестный номер"}
    ID: ${safeNotificationData.id || "Неизвестный ID"}
    Статус: ${safeNotificationData.status || "Неизвестный статус"} 
    Дата и время: ${
      safeNotificationData.time || new Date().toLocaleString("ru-RU")
    }
`);

  useEffect(() => {
    setSelectedEmployee(userData.id);
  }, [userData.id]);

  // Форматирование имени сотрудника в "Фамилия И.О."
  const formatEmployeeName = (lastName, firstName, middleName) => {
    const initials = `${firstName ? firstName[0] + "." : ""}${
      middleName ? middleName[0] + "." : ""
    }`;
    return `${lastName} ${initials}`;
  };
  // Формируем список сотрудников с форматированными именами
  const employees = employeeList.map((employee) => ({
    id: employee.user_id,
    name:
      employee.user_id === userData.id
        ? "Мое напоминание"
        : formatEmployeeName(
            employee.last_name,
            employee.first_name,
            employee.middle_name
          ),
  }));

  const formatDateForSQL = (date) => {
    const localDate = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    );
    return localDate.toISOString().slice(0, 19).replace("T", " ");
  };

  const handleSave = async () => {
    const formattedDate = formatDateForSQL(currentDate);

    if (!userData) {
      Toastify({
        text: "Ошибка: данные пользователя не найдены",
        close: true,
        style: {
          backgroundColor: "linear-gradient(to right, #ff0000, #ffcccc)",
        },
      }).showToast();
      return;
    }

    if (!selectedEmployee) {
      Toastify({
        text: "Ошибка: выберите сотрудника",
        close: true,
        style: {
          backgroundColor: "linear-gradient(to right, #ff0000, #ffcccc)",
        },
      }).showToast();
      return;
    }

    // Убеждаемся, что related_id является числом
    const relatedId = parseInt(notificationId || safeNotificationData.id, 10);

    const requestData = {
      related_id: relatedId,
      user_id: parseInt(selectedEmployee, 10),
      date_time: formattedDate,
      comment: `${comment}  ${infoComment}`,
      type_reminders: typeReminders,
      priority_notifications: "высокий",
      title: "Напоминание о звонке!",
      tags: [{ title: "CRM", ...getRandomColors() }],
    };

    console.log("Sending reminder data:", requestData);

    try {
      const response = await axios.post(
        `${API_BASE_URL}5004/api/reminders`,
        requestData
      );
      console.log("Reminder created successfully:", response.data);

      Toastify({
        text: "Напоминание успешно создано!",
        close: true,
        style: {
          backgroundColor: "linear-gradient(to right, #007BFF, #0056b3)",
        },
      }).showToast();
      onClose();
    } catch (error) {
      console.error(
        "Error creating reminder:",
        error.response?.data || error.message
      );

      Toastify({
        text: `Ошибка при сохранении напоминания: ${
          error.response?.data?.message || error.message
        }`,
        close: true,
        style: {
          backgroundColor: "linear-gradient(to right, #ff0000, #ffcccc)",
        },
      }).showToast();
    }
  };

  const handleDateChange = (date) => {
    setCurrentDate(date);
  };

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        "& .MuiDialog-paper": {
          width: "300px",
          height: "auto",
          backgroundColor: "rgba(155, 155, 155, 0.9)",
        },
      }}
    >
      <DialogContent>
        <div style={{ marginTop: "16px" }}>
          <TextField
            label="Информация о звонке"
            variant="outlined"
            fullWidth
            margin="normal"
            value={`${safeNotificationData.callerNumber} - ${safeNotificationData.callerName}`} // отобразить нужные поля
            InputProps={{
              readOnly: true, // делает это поле только для чтения
            }}
          />
          <DatePicker
            customInput={<CustomDateInput />}
            dateFormat="dd.MM.yyyy HH:mm:ss"
            showTimeInput
            timeIntervals={15}
            timeCaption="Время"
            selected={currentDate}
            onChange={handleDateChange}
            locale={ru}
            inline
          />
          {/* Разделительная полоса */}
          <hr
            style={{
              margin: "20px 0 5px 0", // отступы сверху и снизу
              border: "none", // убираем стандартное оформление
              height: "2px", // высота полосы
              backgroundColor: "#d3d3d3", // яркий серый цвет
              borderRadius: "5px", // скругление углов
            }}
          />
          <TextField
            label="Комментарий"
            variant="outlined"
            fullWidth
            margin="normal"
            className="light-text-field"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            multiline
            rows={4} // Устанавливаем количество строк по умолчанию
            placeholder="Введите ваш комментарий..."
          />
          {/* Разделительная полоса */}
          <hr
            style={{
              margin: "20px 0 5px 0",
              border: "none",
              height: "2px",
              backgroundColor: "#d3d3d3",
              borderRadius: "5px",
            }}
          />

          {/* Селект для выбора сотрудника */}
          <FormControl fullWidth margin="normal">
            <InputLabel id="employee-select-label">
              Выберите сотрудника
            </InputLabel>
            <Select
              labelId="employee-select-label"
              id="employee-select"
              value={selectedEmployee}
              label="Выберите сотрудника"
              onChange={(e) => setSelectedEmployee(e.target.value)}
              sx={{
                backgroundColor: "#fff",
                color: "#333",
              }}
            >
              {employees.map((employee) => (
                <MenuItem key={employee.id} value={employee.id}>
                  {employee.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error">
          Отмена
        </Button>
        <Button onClick={handleSave} color="primary">
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleCallModal;
//1
