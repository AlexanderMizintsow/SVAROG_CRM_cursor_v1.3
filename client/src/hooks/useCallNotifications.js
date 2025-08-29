import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../../config";
import useUserStore from "../store/userStore";

const useCallNotifications = () => {
  const [currentCall, setCurrentCall] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useUserStore();

  const connectToCallServer = useCallback(() => {
    if (!user?.id) return null;

    const socket = io(`${API_BASE_URL}5004`, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("Подключен к серверу уведомлений о звонках");
      console.log("Аутентифицируем пользователя с ID:", user.id);
      setIsConnected(true);
      // Аутентифицируем пользователя
      socket.emit("authenticate", user.id);
    });

    socket.on("disconnect", () => {
      console.log("Отключен от сервера уведомлений о звонках");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Ошибка подключения к серверу уведомлений:", error);
      setIsConnected(false);
    });

    // Обработка входящих звонков
    socket.on("incoming_call", (callData) => {
      console.log("Получено уведомление о входящем звонке:", callData);
      console.log("Устанавливаем currentCall:", callData);
      setCurrentCall(callData);
    });

    // Обработка начала разговора
    socket.on("call_started", (callData) => {
      console.log("Получено уведомление о начале разговора:", callData);
      console.log("Устанавливаем currentCall для активного звонка:", callData);
      setCurrentCall(callData);
    });

    // Обработка завершения звонка
    socket.on("call_ended", (callData) => {
      console.log("=== ПОЛУЧЕНО УВЕДОМЛЕНИЕ О ЗАВЕРШЕНИИ ЗВОНКА ===");
      console.log("callData:", callData);
      console.log("Текущий currentCall перед обновлением:", currentCall);
      console.log(
        "Устанавливаем currentCall для завершенного звонка:",
        callData
      );
      // Устанавливаем данные завершенного звонка - модальное окно не закрывается автоматически
      // Пользователь должен закрыть его вручную после внесения необходимых записей
      setCurrentCall(callData);
      console.log("currentCall обновлен на завершенный звонок");
    });

    return socket;
  }, [user?.id]);

  const closeCallNotification = useCallback(() => {
    setCurrentCall(null);
  }, []);

  useEffect(() => {
    const socket = connectToCallServer();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [connectToCallServer]);

  return {
    currentCall,
    isConnected,
    closeCallNotification,
  };
};

export default useCallNotifications;
