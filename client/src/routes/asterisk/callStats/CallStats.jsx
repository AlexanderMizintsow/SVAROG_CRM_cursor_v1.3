import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../../config";
import useUserStore from "../../../store/userStore";
import "./callStats.scss";

const isoDay = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const talkLabel = (seconds) => {
  const value = Number(seconds) || 0;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  if (!minutes) return `${rest} сек`;
  return `${minutes} мин ${rest} сек`;
};

const daysLabel = (days) => {
  if (days === null || days === undefined) return "звонков не было";
  if (days === 0) return "сегодня";
  return `${days} дн.`;
};

const CallStats = () => {
  const { user } = useUserStore();
  const today = isoDay(new Date());
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const [from, setFrom] = useState(isoDay(start));
  const [to, setTo] = useState(today);
  const [stats, setStats] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(
        `${API_BASE_URL}5004/api/call-stats/${user.id}`,
        { params: { from, to } }
      );
      setStats(response.data);
      setAccess({ canView: true });
    } catch (loadError) {
      if (loadError.response?.status === 403) {
        setAccess({ canView: false });
        setStats(null);
      } else {
        setError(loadError.response?.data?.error || "Не удалось собрать статистику");
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user?.id) {
    return <p className="call-stats-empty">Войдите в CRM, чтобы открыть статистику.</p>;
  }

  if (loading && !stats && access === null) {
    return <p className="call-stats-empty">Считаем…</p>;
  }

  if (access && !access.canView) {
    return (
      <div className="call-stats">
        <h1>Статистика звонков</h1>
        <p className="call-stats-empty">
          Экран открыт руководителю отдела. Другому человеку его включают галочкой
          в настройках телефонии.
        </p>
      </div>
    );
  }

  if (error) {
    return <p className="call-stats-empty">{error}</p>;
  }

  if (!stats) {
    return <p className="call-stats-empty">Считаем…</p>;
  }

  const cards = [
    { label: "Компаний без звонка дольше срока", value: stats.silentCount },
    { label: "Пропущенных с истёкшим сроком", value: stats.overdueCount },
    { label: "Звонков за период", value: stats.callCount },
    { label: "Средний разговор", value: talkLabel(stats.averageTalkSeconds) },
  ];

  return (
    <div className="call-stats">
      <h1>Статистика звонков</h1>
      <p className="call-stats-lead">
        {stats.scope === "all"
          ? "Все компании с менеджером."
          : "Компании отдела."}{" "}
        Срок молчания берётся у менеджера компании, общий запасной — {stats.silenceDefault} дн.
        Пропущенный виден после {stats.missedMinutes} мин.
      </p>
      <form
        className="call-stats-period"
        onSubmit={(event) => {
          event.preventDefault();
          load();
        }}
      >
        <label>
          С
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          по
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Считаем…" : "Показать"}
        </button>
      </form>
      <div className="call-stats-cards">
        {cards.map((card) => (
          <article key={card.label}>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
          </article>
        ))}
      </div>
      <div className="call-stats-columns">
        <section>
          <h2>Компании за период</h2>
          {stats.companies.length === 0 ? (
            <p className="call-stats-empty">Звонков не было</p>
          ) : (
            stats.companies.map((row) => (
              <p key={row.companyId}>
                <span>{row.name}</span>
                <b>{row.count}</b>
              </p>
            ))
          )}
        </section>
        <section>
          <h2>Менеджеры за период</h2>
          {stats.managers.length === 0 ? (
            <p className="call-stats-empty">По добавочным звонков не видно</p>
          ) : (
            stats.managers.map((row) => (
              <p key={row.name}>
                <span>{row.name}</span>
                <b>{row.count}</b>
              </p>
            ))
          )}
        </section>
      </div>
      <section className="call-stats-list">
        <h2>Пропущенные, срок вышел</h2>
        {stats.overdue.length === 0 ? (
          <p className="call-stats-empty">Нет</p>
        ) : (
          stats.overdue.map((row) => (
            <p key={row.companyId}>
              <span>{row.companyName}</span>
              <span>{row.managerName || "менеджер не указан"}</span>
            </p>
          ))
        )}
      </section>
      <section className="call-stats-list">
        <h2>Давно не звонили</h2>
        {stats.silent.length === 0 ? (
          <p className="call-stats-empty">Нет</p>
        ) : (
          stats.silent.map((row) => (
            <p key={row.companyId}>
              <span>{row.companyName}</span>
              <span>{daysLabel(row.daysSilent)}</span>
            </p>
          ))
        )}
      </section>
    </div>
  );
};

export default CallStats;
