// Сторонние библиотеки
import { RouterProvider } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import Toastify from "toastify-js";
import "@fortawesome/fontawesome-free/css/all.min.css";
// Локальные библиотеки
import { createRouter } from "./config/routes.jsx";
import { API_BASE_URL } from "../config.js";
import { setupNotifications } from "./notifications";
import useUserStore from "./store/userStore";
import useRemindersStore from "./store/useRemindersStore";
import callsNotificationStore from "./store/callsNotificationStore";
import useKanbanStore from "./store/useKanbanStore.js";
import ActivityTracker from "./utils/activityTracker.js";
import { getSeasonBackground } from "./utils/backgroundSelector.js";
import {
  requestNotificationPermission,
  sendBrowserNotification,
} from "./utils/browserNotifications.js";
// Статические ресурсы
import logo_windows from "../src/assets/img/logo_windows.png";
import useTasksStore from "./store/useTasksStore.js";
import useWebSocket from "./routes/kanbanBoard/Boards/subcomponents/useWebSocket.js";
import AlertBanner from "./components/alertBanner/AlertBanner.jsx";
import useTasksManageStore from "./store/useTasksManageStore.js";
import "./index.scss";
import CallNotification from "./components/CallNotification/CallNotification";
import useCallNotifications from "./hooks/useCallNotifications";

// Внутри компонента App:
function App() {
  const { setUser, setUsers, user } = useUserStore();
  const { fetchTasks } = useTasksStore();
  const setMissedCount = callsNotificationStore(
    (state) => state.setMissedCount
  );
  const { appRestart, missedCallFilters } = callsNotificationStore();
  const [showEmployee, setShowEmployee] = useState(true);
  const setReminders = useRemindersStore((state) => state.setReminders);
  const setGroupCounts = useRemindersStore((state) => state.setGroupCounts);
  const { reminders } = useRemindersStore();
  const [lastNotificationCount, setLastNotificationCount] = useState(0);
  const { fetchEmployees, setSelectedEmployeeId } = useKanbanStore();
  const prevRemindersRef = useRef();
  const [isConnectBD, setIsConnectBD] = useState(null);
  const { fetchTasksManager } = useTasksManageStore();
  const roleAdministrator = user?.role_name === "Администратор" ? true : false;
  const bgSeason = getSeasonBackground();
  const electronAPI = window.electronAPI || null;

  const router = useMemo(
    () => createRouter(bgSeason, roleAdministrator, isConnectBD),
    [bgSeason, roleAdministrator, isConnectBD]
  );

  const userData = JSON.parse(localStorage.getItem("userData"));
  const userId = user?.id;

  // Интеграция системы уведомлений о звонках
  const { currentCall, isConnected, closeCallNotification } =
    useCallNotifications();

  // Подключаем WebSocket
  useWebSocket(userId);
  useEffect(() => {
    if (userId) {
      fetchTasksManager(userId);
    }
  }, [userId]);

  const sendNotification = (title, text) => {
    if (electronAPI && typeof electronAPI.sendNotification === "function") {
      electronAPI.sendNotification(title, text);
    } else {
      console.log("Electron API недоступен");
    }
  };

  // Получить всех пользователей из таблицы
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/users`);
        setUsers(response.data);
      } catch (error) {
        console.error("Ошибка при загрузке пользователей:", error);
      }
    };
    fetchUsers();
  }, [setUsers]);

  // Функция для проверки соединения с базой данных
  const checkDatabaseConnection = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}5000/api/check-db-connection`
      );
      setIsConnectBD(response.data);
    } catch (error) {
      console.error("Ошибка при проверке соединения с базой данных:", error);
    }
  };

  useEffect(() => {
    const socket = io(`${API_BASE_URL}5000`);

    const fetchGroupCounts = async () => {
      if (!userId) return;

      try {
        const response = await axios.get(
          `${API_BASE_URL}5000/api/group-counts/${userId}`
        );
        // console.log('Полученные данные:', response.data)
        setGroupCounts(response.data); // в Zustand
      } catch (error) {
        console.error("Ошибка при получении количества групп:", error);
      }
    };

    socket.on("groupCreated", () => {
      setTimeout(() => {
        fetchGroupCounts();
      }, 700); // 700 миллисекунд
    });

    fetchGroupCounts();

    return () => {
      socket.off("groupCreated");
      socket.disconnect();
    };
  }, [setGroupCounts]);

  // Слушаем событие изменения статуса пользователя онлайн или офлайн
  useEffect(() => {
    const socket = io(`${API_BASE_URL}5000`);
    socket.on("userStatusUpdated", () => {
      fetchEmployees(userId);
    });
    return () => {
      socket.off("userStatusUpdated");
      socket.disconnect();
    };
  }, [fetchEmployees, userId]);
  // Получение всех подчиненных сотрудников, их id списком
  useEffect(() => {
    if (userId) {
      setSelectedEmployeeId(userId);
      fetchEmployees(userId); // Загружаем сотрудников при первом запуске
    }
  }, [userId, fetchEmployees]);

  useEffect(() => {
    requestNotificationPermission(); // useEffect для запроса разрешения на уведомления
    checkDatabaseConnection(); // useEffect для проверки соединения при первом рендере и при обновлении компонента
  }, []);

  // useEffect для показа уведомления при добавлении нового
  useEffect(() => {
    const userReminders = reminders.filter(
      (reminder) => reminder.user_id === userId
    );

    // Храним предыдущее состояние
    const prevReminders = prevRemindersRef.current || [];

    if (
      userReminders.length > lastNotificationCount &&
      userReminders.length !== prevReminders.length // Проверка на новое
    ) {
      const newReminder = userReminders[userReminders.length - 1];
      // Показать уведомление о новом напоминании
      Toastify({
        text: `Необходимо выполнить: ${
          newReminder.comment || "Нет комментария"
        }`,
        duration: 5000,
        close: true,
        style: {
          background: "linear-gradient(to right, #800080, #DA70D6)",
        },
      }).showToast();
      // Отправить уведомление в браузере
      sendNotification(
        "Дилер",
        `Необходимо выполнить: ${newReminder.comment || "Нет комментария"}`
      );
      //  sendBrowserNotification(newReminder)
      setLastNotificationCount(userReminders.length);
    }

    // Обновляем предыдущее значение
    prevRemindersRef.current = userReminders;
  }, [reminders, lastNotificationCount]);

  // useEffect для проверки наличия уведомлений
  useEffect(() => {
    const timer = setInterval(() => {
      const userReminders = reminders.filter(
        (reminder) => reminder.user_id === userId
      );
      const checkMessage = `У вас имеются необработанные уведомления: ${userReminders.length} шт! Перейдите в менеджер задач!`;

      if (userReminders.length > 0) {
        if (Notification.permission === "granted") {
          new Notification("Новое напоминание!", {
            body: checkMessage,
            icon: logo_windows,
          });
        }
        Toastify({
          text: checkMessage,
          duration: 7000,
          close: true,
          style: {
            background: "linear-gradient(to right, #FF5733, #C70039)",
          },
        }).showToast();
      }
    }, 9000000); // Проверка каждые 2.5 часа

    return () => {
      clearInterval(timer); // Очистка таймера при размонтировании
    };
  }, [reminders]);

  /* useEffect(() => {
    const fetchUserSettings = async () => {
      if (userId) {
        const socket = io(`${API_BASE_URL}5004`)

        socket.on('reminders', (newReminders) => {
          setReminders(newReminders) // Добавляем новые напоминания в Zustand
        })

        try {
          const response = await axios.get(
            `${API_BASE_URL}5004/api/calls-settings-missed/${userId}`
          )
          setShowEmployee(response.data.showMissedCallsEmployee) // Получение настройки
        } catch (error) {
          console.error('Ошибка получения настроек пользователя:', error)
        }
      }
    }

    const fetchInitialMissedCount = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}5004/api/calls?status=missed`
        )
        const calls = response.data

        // Фильтрация в соответствии с настройками
        const filteredCalls = calls.filter((call) => {
          const callerNumber = parseInt(call.caller_number, 10)
          return showEmployee || callerNumber < 0 || callerNumber > 999
        })

        const missedCount = filteredCalls.length // Обновляем счетчик
        setMissedCount(missedCount) // Обновляем состояние в Zustand
      } catch (error) {
        console.error(
          'Ошибка при получении начального количества пропущенных звонков:',
          error
        )
      }
    }

    fetchUserSettings() // Загружаем настройки пользователя
    fetchInitialMissedCount() // Получаем начальную сумму пропущенных звонков

    const socket = io(`${API_BASE_URL}5004`)
    socket.on('new_call', async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}5004/api/calls?status=missed`
        )
        const calls = response.data

        // Фильтрация в соответствии с настройками
        const filteredCalls = calls.filter((call) => {
          const callerNumber = parseInt(call.caller_number, 10)
          return showEmployee || callerNumber < 0 || callerNumber > 999
        })

        const missedCount = filteredCalls.length // Обновляем счетчик
        setMissedCount(missedCount) // Обновляем состояние в Zustand
      } catch (error) {
        console.error(
          'Ошибка при получении количества пропущенных звонков:',
          error
        )
      }
    })

    if (userData) {
      try {
        if (userData && typeof userData === 'object' && userData.id) {
          setUser(userData)

          // Отправляем запрос на сервер для аутентификации пользователя
          ;(async () => {
            try {
              await axios.post(`${API_BASE_URL}5001/emailAuth`, {
                userId: userData.id, // Отправляем ID пользователя
              })
              await axios.post(
                `${API_BASE_URL}5004/api/check-create-user`,

                {
                  userId: userData.id, // Отправляем ID пользователя
                }
              )
            } catch (error) {
              console.error('Ошибка при отправке запроса emailAuth:', error)
            }
          })()

          // Настраиваем уведомления только после установки пользователя
          const cleanupNotifications = setupNotifications()
          return () => {
            cleanupNotifications()
          }
        } else {
          console.error('Данные пользователя не содержат id')
        }
      } catch (error) {
        console.error('Ошибка при парсинге данных пользователя:', error)
      }
    } else {
      console.error('Данные пользователя отсутствуют в localStorage')
    }

    return () => {
      socket.off('new_call')
      socket.off('reminders')
      socket.disconnect() // Отсоединяем WebSocket при размонтировании
    }
  }, [setUser, userId, setMissedCount, showEmployee, appRestart, setReminders])*/

  useEffect(() => {
    const socket = io(`${API_BASE_URL}5004`);

    const fetchUserSettings = async () => {
      if (userId) {
        socket.on("reminders", (newReminders) => {
          setReminders(newReminders); // Добавляем новые напоминания в Zustand
        });

        try {
          const response = await axios.get(
            `${API_BASE_URL}5004/api/calls-settings-missed/${userId}`
          );
          setShowEmployee(response.data.showMissedCallsEmployee); // Получение настройки
        } catch (error) {
          console.error("Ошибка получения настроек пользователя:", error);
        }
      }
    };

    /* const fetchInitialMissedCount = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5004/api/calls?status=missed`)
        const calls = response.data

        // Фильтрация в соответствии с настройками
        const filteredCalls = calls.filter((call) => {
          const callerNumber = parseInt(call.caller_number, 10)
          return showEmployee || callerNumber < 0 || callerNumber > 999
        })

        const missedCount = filteredCalls.length // Обновляем счетчик
        setMissedCount(missedCount) // Обновляем состояние в Zustand
      } catch (error) {
        console.error('Ошибка при получении начального количества пропущенных звонков:', error)
      }
    }*/
    const fetchInitialMissedCount = async () => {
      try {
        // Формируем параметры запроса с учетом фильтров
        const params = {
          status: "missed",
          limit: 1000, // Берем большое количество для точного подсчета
        };

        // Если есть информация о пользователе и его правах
        if (missedCallFilters.userInfo) {
          const { userInfo } = missedCallFilters;

          // Если пользователь может видеть все звонки
          if (userInfo.canViewAllCalls) {
            params.canViewAllCalls = true;

            // Если это руководитель отдела, добавляем фильтр по отделу
            if (userInfo.isDepartmentHead && userInfo.department_id) {
              params.departmentId = userInfo.department_id;
            }

            // Если выбран конкретный сотрудник
            if (
              missedCallFilters.selectedEmployee &&
              missedCallFilters.selectedEmployee !== "undefined"
            ) {
              params.employeeId = missedCallFilters.selectedEmployee;
            }

            // Фильтр по неопределенным сотрудникам
            if (missedCallFilters.selectedUnassignedEmployee) {
              params.unassigned = true;
            }
          } else {
            // Обычный пользователь - видит только свои звонки
            params.userId = user?.id;
          }
        }

        const response = await axios.get(`${API_BASE_URL}5004/api/calls`, {
          params,
        });
        const { total } = response.data;

        setMissedCount(total);
      } catch (error) {
        console.error(
          "Ошибка при получении начального количества пропущенных звонков:",
          error
        );
      }
    };

    const handleNewCall = async () => {
      // Вызываем ту же функцию для обновления счетчика
      await fetchInitialMissedCount();
    };

    socket.on("new_call", handleNewCall); // Устанавливаем слушатель для новых звонков

    fetchUserSettings(); // Загружаем настройки пользователя
    fetchInitialMissedCount(); // Получаем начальную сумму пропущенных звонков

    if (userData) {
      try {
        if (userData && typeof userData === "object" && userData.id) {
          setUser(userData);

          // Отправляем запрос на сервер для аутентификации пользователя
          (async () => {
            try {
              await axios.post(`${API_BASE_URL}5001/emailAuth`, {
                userId: userData.id, // Отправляем ID пользователя
              });
              await axios.post(`${API_BASE_URL}5004/api/check-create-user`, {
                userId: userData.id, // Отправляем ID пользователя
              });
            } catch (error) {
              console.error("Ошибка при отправке запроса emailAuth:", error);
            }
          })();

          // Настраиваем уведомления только после установки пользователя
          const cleanupNotifications = setupNotifications();
          return () => {
            cleanupNotifications();
          };
        } else {
          console.error("Данные пользователя не содержат id");
        }
      } catch (error) {
        console.error("Ошибка при парсинге данных пользователя:", error);
      }
    } else {
      console.error("Данные пользователя отсутствуют в localStorage");
    }

    return () => {
      socket.off("new_call", handleNewCall); // Убираем слушатель для новых звонков
      socket.off("reminders"); // Убираем слушатель для напоминаний
      socket.disconnect(); // Отключаем WebSocket при размонтировании
    };
  }, [
    setUser,
    userId,
    setMissedCount,
    showEmployee,
    appRestart,
    setReminders,
    missedCallFilters,
  ]);

  useEffect(() => {
    if (userId) {
      fetchTasks(userId);
    }
  }, [userId, fetchTasks]);

  return (
    <>
      <AlertBanner />
      <RouterProvider router={router} />
      <ActivityTracker />

      {/* Компонент уведомлений о звонках */}
      {currentCall && (
        <CallNotification
          callData={currentCall}
          onClose={closeCallNotification}
        />
      )}
    </>
  );
}

export default App;
