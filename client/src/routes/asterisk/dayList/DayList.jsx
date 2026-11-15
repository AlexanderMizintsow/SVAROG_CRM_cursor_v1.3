import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../../config";
import useUserStore from "../../../store/userStore";
import PlaceCall from "../placeCall/PlaceCall";
import "./dayList.scss";

const daysLabel = (days) => {
  if (days === null || days === undefined) return "звонков не было";
  if (days === 0) return "сегодня";
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return `${days} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${days} дня`;
  }
  return `${days} дней`;
};

const formatWhen = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const DayRow = ({ row, extra, userId, onResult }) => (
  <article className="day-row">
    <div className="day-row-main">
      <strong>{row.companyName || "Компания не найдена"}</strong>
      <span>{row.phone || "номер не указан"}</span>
      {extra ? <span className="day-row-extra">{extra}</span> : null}
    </div>
    <span className="day-row-silence">{daysLabel(row.daysSilent)}</span>
    <PlaceCall
      className="day-row-call"
      userId={userId}
      companyId={row.companyId}
      phone={row.phone}
      onResult={onResult}
    />
  </article>
);

const silenceSourceLabel = {
  user: "ваш срок",
  department: "срок отдела",
  default: "общий срок",
};

const SilenceForm = ({
  label,
  hint,
  value,
  onChange,
  onSubmit,
  saving,
  onReset,
}) => (
  <form className="day-sla" onSubmit={onSubmit}>
    <label>
      {label}
      <input
        type="number"
        min="1"
        max="365"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
    <button type="submit" disabled={saving}>
      {saving ? "Сохраняем…" : "Сохранить"}
    </button>
    {onReset ? (
      <button
        type="button"
        className="day-sla-reset"
        onClick={onReset}
        disabled={saving}
      >
        Сбросить
      </button>
    ) : null}
    {hint ? <span>{hint}</span> : null}
  </form>
);

const workSourceLabel = {
  department: "окно отдела",
  default: "общее окно",
};

const WorkHoursForm = ({
  label,
  hint,
  start,
  end,
  onStart,
  onEnd,
  onSubmit,
  saving,
  onReset,
}) => (
  <form className="day-sla" onSubmit={onSubmit}>
    <label>
      {label}
      <input
        className="day-time"
        type="time"
        value={start}
        onChange={(event) => onStart(event.target.value)}
      />
      <input
        className="day-time"
        type="time"
        value={end}
        onChange={(event) => onEnd(event.target.value)}
      />
    </label>
    <button type="submit" disabled={saving}>
      {saving ? "Сохраняем…" : "Сохранить"}
    </button>
    {onReset ? (
      <button
        type="button"
        className="day-sla-reset"
        onClick={onReset}
        disabled={saving}
      >
        Сбросить
      </button>
    ) : null}
    {hint ? <span>{hint}</span> : null}
  </form>
);

const DayList = () => {
  const { user } = useUserStore();
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [minutes, setMinutes] = useState("15");
  const [shortSeconds, setShortSeconds] = useState("30");
  const [longSeconds, setLongSeconds] = useState("180");
  const [savingMinutes, setSavingMinutes] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);
  const [ownDays, setOwnDays] = useState("");
  const [defaultDays, setDefaultDays] = useState("14");
  const [departments, setDepartments] = useState([]);
  const [savingSilence, setSavingSilence] = useState(false);
  const [defaultWorkStart, setDefaultWorkStart] = useState("09:00");
  const [defaultWorkEnd, setDefaultWorkEnd] = useState("18:00");
  const [workDepartments, setWorkDepartments] = useState([]);
  const [savingWork, setSavingWork] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(
        `${API_BASE_URL}5004/api/call-day/${user.id}`
      );
      setDay(response.data);
      if (response.data.missedMinutes) {
        setMinutes(String(response.data.missedMinutes));
      }
      setShortSeconds(String(response.data.shortSeconds || 30));
      setLongSeconds(String(response.data.longSeconds || 180));
      setOwnDays(
        response.data.ownSilenceDays == null
          ? ""
          : String(response.data.ownSilenceDays)
      );
      setDefaultDays(String(response.data.silenceDefaultDays || 14));
      setDepartments(response.data.silenceDepartments || []);
      setDefaultWorkStart(response.data.workDefaultStart || "09:00");
      setDefaultWorkEnd(response.data.workDefaultEnd || "18:00");
      setWorkDepartments(response.data.workDepartments || []);
    } catch (loadError) {
      console.error(loadError);
      setError("Не удалось собрать список дел");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onResult = (text) => {
    setNotice(text);
  };

  const saveSilence = async (scope, silenceDays, departmentId) => {
    setSavingSilence(true);
    try {
      await axios.put(`${API_BASE_URL}5004/api/telephony-silence`, {
        userId: user.id,
        scope,
        silenceDays: silenceDays === "" ? null : Number(silenceDays),
        departmentId,
      });
      const saved = silenceDays === "" || silenceDays == null ? "сброшен" : `${silenceDays} дн.`;
      setNotice(`Срок «пора позвонить»: ${saved}`);
      await load();
    } catch (saveError) {
      setNotice(saveError.response?.data?.error || "Не удалось сохранить срок");
    } finally {
      setSavingSilence(false);
    }
  };

  const saveWorkHours = async (scope, start, end, departmentId) => {
    const clearing = scope === "department" && !start && !end;
    if (!clearing && (!start || !end || end <= start)) {
      setNotice("Укажите окно: конец позже начала");
      return;
    }
    setSavingWork(true);
    try {
      await axios.put(`${API_BASE_URL}5004/api/telephony-work-hours`, {
        userId: user.id,
        scope,
        departmentId,
        workStart: clearing ? null : start,
        workEnd: clearing ? null : end,
      });
      setNotice(
        clearing ? "Рабочие часы отдела сброшены" : `Рабочие часы: ${start}–${end}`
      );
      await load();
    } catch (saveError) {
      setNotice(saveError.response?.data?.error || "Не удалось сохранить рабочие часы");
    } finally {
      setSavingWork(false);
    }
  };

  const saveMinutes = async (event) => {
    event.preventDefault();
    setSavingMinutes(true);
    try {
      await axios.put(`${API_BASE_URL}5004/api/telephony-day-settings`, {
        userId: user.id,
        missedMinutes: Number(minutes),
      });
      setNotice(`Срок на пропущенный: ${minutes} мин.`);
      await load();
    } catch (saveError) {
      setNotice(
        saveError.response?.data?.error || "Не удалось сохранить срок"
      );
    } finally {
      setSavingMinutes(false);
    }
  };

  const saveMarks = async (event) => {
    event.preventDefault();
    setSavingMarks(true);
    try {
      await axios.put(`${API_BASE_URL}5004/api/telephony-talk-marks`, {
        userId: user.id,
        shortSeconds: Number(shortSeconds),
        longSeconds: Number(longSeconds),
      });
      setNotice(`Короткий до ${shortSeconds} сек, длинный от ${longSeconds} сек.`);
      await load();
    } catch (saveError) {
      setNotice(saveError.response?.data?.error || "Не удалось сохранить порог");
    } finally {
      setSavingMarks(false);
    }
  };

  if (!user?.id) {
    return <p className="day-list-empty">Войдите в CRM, чтобы увидеть дела на день.</p>;
  }

  if (loading) {
    return <p className="day-list-empty">Собираем список…</p>;
  }

  if (error) {
    return <p className="day-list-empty">{error}</p>;
  }

  const groups = [
    {
      key: "missed",
      title: "Пропущенные без перезвона",
      rows: day.missed,
      extra: (row) =>
        [
          row.missedAt ? `пропущен ${formatWhen(row.missedAt)}` : "",
          row.overdue ? "срок вышел" : "ещё в сроке",
        ]
          .filter(Boolean)
          .join(" · "),
    },
    {
      key: "reminders",
      title: "Перезвонить",
      rows: day.reminders,
      extra: (row) =>
        [formatWhen(row.dateTime), row.title, row.comment]
          .filter(Boolean)
          .join(" · "),
    },
    {
      key: "silence",
      title: `Пора позвонить · ${day.silenceDays} дн., ${
        silenceSourceLabel[day.silenceSource] || "общий срок"
      }`,
      rows: day.silence,
      extra: (row) => {
        if (!row.lastCallAt) return "звонков не было";
        if (row.lastDirection === "incoming") return "последний входящий";
        if (row.lastDirection === "outgoing") return "последний исходящий";
        return "последний разговор";
      },
    },
  ];

  return (
    <div className="day-list">
      <h1>Дела на день</h1>
      <p className="day-list-lead">
        Компании, где вы региональный менеджер, МПП, МПР или замещающий.
      </p>
      {notice ? <p className="day-list-notice">{notice}</p> : null}
      {day.canEditMissedMinutes ? (
        <form className="day-sla" onSubmit={saveMinutes}>
          <label>
            Срок на пропущенный, минут
            <input
              type="number"
              min="1"
              max="1440"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </label>
          <button type="submit" disabled={savingMinutes}>
            {savingMinutes ? "Сохраняем…" : "Сохранить"}
          </button>
          <span>Пока срок не вышел, пропущенный только у менеджера компании.</span>
        </form>
      ) : null}
      {day.canEditMissedMinutes ? (
        <form className="day-sla" onSubmit={saveMarks}>
          <label>
            Короткий разговор, до секунд
            <input
              type="number"
              min="1"
              max="3600"
              value={shortSeconds}
              onChange={(event) => setShortSeconds(event.target.value)}
            />
          </label>
          <label>
            Длинный разговор, от секунд
            <input
              type="number"
              min="2"
              max="7200"
              value={longSeconds}
              onChange={(event) => setLongSeconds(event.target.value)}
            />
          </label>
          <button type="submit" disabled={savingMarks}>
            {savingMarks ? "Сохраняем…" : "Сохранить"}
          </button>
          <span>Отметка ставится сама по длительности разговора, без гудков.</span>
        </form>
      ) : null}
      {day.canEditSilenceDefault ? (
        <SilenceForm
          label="Общий срок «пора позвонить», дней"
          hint="Его берут отделы и менеджеры, у которых свой срок не задан."
          value={defaultDays}
          onChange={setDefaultDays}
          saving={savingSilence}
          onSubmit={(event) => {
            event.preventDefault();
            saveSilence("default", defaultDays);
          }}
        />
      ) : null}
      {departments.map((department) => (
        <SilenceForm
          key={department.id}
          label={`Срок отдела «${department.name}», дней`}
          hint="Пустое поле — снова общий срок. Свой срок менеджера важнее."
          value={department.silenceDays == null ? "" : String(department.silenceDays)}
          onChange={(value) =>
            setDepartments((current) =>
              current.map((item) =>
                item.id === department.id
                  ? { ...item, silenceDays: value === "" ? null : value }
                  : item
              )
            )
          }
          saving={savingSilence}
          onSubmit={(event) => {
            event.preventDefault();
            saveSilence(
              "department",
              department.silenceDays == null ? "" : department.silenceDays,
              department.id
            );
          }}
          onReset={
            department.silenceDays == null
              ? null
              : () => saveSilence("department", "", department.id)
          }
        />
      ))}
      <SilenceForm
        label="Мой срок «пора позвонить», дней"
        hint="Считаются входящие и исходящие. Пустое поле — срок отдела или общий."
        value={ownDays}
        onChange={setOwnDays}
        saving={savingSilence}
        onSubmit={(event) => {
          event.preventDefault();
          saveSilence("user", ownDays);
        }}
        onReset={
          day.ownSilenceDays == null ? null : () => saveSilence("user", "")
        }
      />
      <p className="day-list-lead">
        Напоминания о звонках: {day.workStart}–{day.workEnd},{" "}
        {workSourceLabel[day.workSource] || "общее окно"}. Ночью они ждут начала окна.
      </p>
      {day.canEditWorkDefault ? (
        <WorkHoursForm
          label="Общие рабочие часы"
          hint="Их берут отделы, у которых своё окно не задано."
          start={defaultWorkStart}
          end={defaultWorkEnd}
          onStart={setDefaultWorkStart}
          onEnd={setDefaultWorkEnd}
          saving={savingWork}
          onSubmit={(event) => {
            event.preventDefault();
            saveWorkHours("default", defaultWorkStart, defaultWorkEnd);
          }}
        />
      ) : null}
      {workDepartments.map((department) => (
        <WorkHoursForm
          key={`hours-${department.id}`}
          label={`Рабочие часы отдела «${department.name}»`}
          hint="Пустые поля — снова общее окно."
          start={department.workStart || ""}
          end={department.workEnd || ""}
          onStart={(value) =>
            setWorkDepartments((current) =>
              current.map((item) =>
                item.id === department.id ? { ...item, workStart: value } : item
              )
            )
          }
          onEnd={(value) =>
            setWorkDepartments((current) =>
              current.map((item) =>
                item.id === department.id ? { ...item, workEnd: value } : item
              )
            )
          }
          saving={savingWork}
          onSubmit={(event) => {
            event.preventDefault();
            saveWorkHours(
              "department",
              department.workStart || "",
              department.workEnd || "",
              department.id
            );
          }}
          onReset={
            department.workStart || department.workEnd
              ? () => saveWorkHours("department", "", "", department.id)
              : null
          }
        />
      ))}
      {day.overdueDepartment && day.overdueDepartment.length ? (
        <section className="day-group">
          <h2>
            Просроченные пропущенные отдела
            <span>{day.overdueDepartment.length}</span>
          </h2>
          {day.overdueDepartment.map((row) => (
            <DayRow
              key={`overdue-${row.companyId}`}
              row={row}
              extra={[row.managerName, row.missedAt ? formatWhen(row.missedAt) : ""]
                .filter(Boolean)
                .join(" · ")}
              userId={user.id}
              onResult={onResult}
            />
          ))}
        </section>
      ) : null}
      {groups.map((group) => (
        <section key={group.key} className="day-group">
          <h2>
            {group.title}
            <span>{group.rows.length}</span>
          </h2>
          {group.rows.length === 0 ? (
            <p className="day-group-empty">Пусто</p>
          ) : (
            group.rows.map((row) => (
              <DayRow
                key={row.reminderId || `${group.key}-${row.companyId}`}
                row={row}
                extra={group.extra(row)}
                userId={user.id}
                onResult={onResult}
              />
            ))
          )}
        </section>
      ))}
    </div>
  );
};

export default DayList;
