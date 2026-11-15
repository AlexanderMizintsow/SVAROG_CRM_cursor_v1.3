import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../../config";
import "./placeCall.scss";

const digits = (value) => String(value || "").replace(/\D/g, "");

const PlaceCall = ({
  userId,
  companyId,
  phone,
  className,
  onResult,
  inlineNote = false,
  label = "Позвонить",
}) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const canCall = digits(phone).length > 5 && companyId;

  const finish = (text) => {
    if (inlineNote) setNote(text);
    if (onResult) onResult(text);
  };

  const call = async () => {
    if (!canCall || busy) return;
    if (!userId) {
      finish("Войдите в CRM, чтобы позвонить.");
      return;
    }
    setBusy(true);
    try {
      const response = await axios.post(`${API_BASE_URL}5004/api/call-originate`, {
        userId,
        companyId,
        phone,
      });
      finish(response.data.message || "Набор отправлен.");
    } catch (error) {
      finish(
        error.response?.data?.error ||
          "Не удалось попросить АТС набрать номер."
      );
    } finally {
      setBusy(false);
    }
  };

  const button = (
    <button
      type="button"
      className={className || "place-call"}
      disabled={!canCall || busy}
      onClick={call}
    >
      {busy ? "Набираем…" : label}
    </button>
  );

  if (!inlineNote) return button;

  return (
    <span className="place-call-wrap">
      {button}
      {note ? <span className="place-call-note">{note}</span> : null}
    </span>
  );
};

export default PlaceCall;
