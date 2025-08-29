import React from "react";
import { Chip, Tooltip } from "@mui/material";
import { Phone, PhoneDisabled } from "@mui/icons-material";
import "./CallStatusIndicator.scss";

const CallStatusIndicator = ({ isConnected, currentCall }) => {
  const getStatusColor = () => {
    if (currentCall) {
      return "success";
    }
    return isConnected ? "primary" : "error";
  };

  const getStatusIcon = () => {
    if (currentCall) {
      return <Phone fontSize="small" />;
    }
    return isConnected ? (
      <Phone fontSize="small" />
    ) : (
      <PhoneDisabled fontSize="small" />
    );
  };

  const getStatusText = () => {
    if (currentCall) {
      switch (currentCall.type) {
        case "incoming_call":
          return "Входящий звонок";
        case "call_started":
          return "Активный звонок";
        case "call_ended":
          return "Звонок завершен";
        default:
          return "Звонок";
      }
    }
    return isConnected ? "Звонки активны" : "Звонки недоступны";
  };

  const getTooltipText = () => {
    if (currentCall) {
      return `Звонок от ${currentCall.callerName} (${currentCall.callerNumber})`;
    }
    return isConnected
      ? "Система уведомлений о звонках активна"
      : "Нет подключения к системе звонков";
  };

  return (
    <Tooltip title={getTooltipText()} placement="bottom">
      <Chip
        icon={getStatusIcon()}
        label={getStatusText()}
        color={getStatusColor()}
        size="small"
        className={`call-status-indicator ${
          isConnected ? "connected" : "disconnected"
        } ${currentCall ? "active-call" : ""}`}
      />
    </Tooltip>
  );
};

export default CallStatusIndicator;
