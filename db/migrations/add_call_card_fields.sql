-- Карточка звонка. Старые строки не переписываются: новые поля могут быть пустыми.

ALTER TABLE calls ADD COLUMN IF NOT EXISTS direction VARCHAR(16);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS extension VARCHAR(10);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS uniqueid VARCHAR(40);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS talk_seconds INTEGER;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS dialed_seconds INTEGER;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_path TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS calls_uniqueid_uidx ON calls (uniqueid);

-- +7, 8 и 7 для одного мобильного дают один ключ. Короткие номера остаются как есть.
CREATE OR REPLACE FUNCTION phone_key(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL OR btrim(raw) = '' THEN NULL
    WHEN regexp_replace(raw, '\D', '', 'g') = '' THEN NULL
    WHEN length(regexp_replace(raw, '\D', '', 'g')) = 11
      AND left(regexp_replace(raw, '\D', '', 'g'), 1) = '8'
      THEN '7' || substring(regexp_replace(raw, '\D', '', 'g') from 2)
    WHEN length(regexp_replace(raw, '\D', '', 'g')) = 10
      THEN '7' || regexp_replace(raw, '\D', '', 'g')
    ELSE regexp_replace(raw, '\D', '', 'g')
  END;
$$;

CREATE INDEX IF NOT EXISTS calls_caller_phone_key_idx
  ON calls (phone_key(caller_number));

CREATE INDEX IF NOT EXISTS calls_receiver_phone_key_idx
  ON calls (phone_key(receiver_number));

-- Срок молчания для списка дел. Позже его сможет задать руководитель.
CREATE TABLE IF NOT EXISTS telephony_day_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  silence_days INTEGER NOT NULL DEFAULT 14 CHECK (silence_days > 0)
);

INSERT INTO telephony_day_settings (id, silence_days)
VALUES (1, 14)
ON CONFLICT (id) DO NOTHING;

-- Минуты, после которых пропущенный виден руководителю отдела.
ALTER TABLE telephony_day_settings
  ADD COLUMN IF NOT EXISTS missed_minutes INTEGER NOT NULL DEFAULT 15;

-- Напоминание «перезвонить» относится к компании. У старых строк поле пустое.
ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;

-- Срок «пора позвонить»: у отдела и, если задан, свой у менеджера.
-- Пустое поле значит «брать срок отдела, иначе общий».
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS silence_days INTEGER;

ALTER TABLE departments
  DROP CONSTRAINT IF EXISTS departments_silence_days_check;

ALTER TABLE departments
  ADD CONSTRAINT departments_silence_days_check
  CHECK (silence_days IS NULL OR silence_days > 0);

ALTER TABLE calls_settings_users
  ADD COLUMN IF NOT EXISTS silence_days INTEGER;

ALTER TABLE calls_settings_users
  DROP CONSTRAINT IF EXISTS calls_settings_users_silence_days_check;

ALTER TABLE calls_settings_users
  ADD CONSTRAINT calls_settings_users_silence_days_check
  CHECK (silence_days IS NULL OR silence_days > 0);

-- Окно, в котором создаются и приходят напоминания о звонках.
ALTER TABLE telephony_day_settings
  ADD COLUMN IF NOT EXISTS work_start TIME NOT NULL DEFAULT '09:00';

ALTER TABLE telephony_day_settings
  ADD COLUMN IF NOT EXISTS work_end TIME NOT NULL DEFAULT '18:00';

ALTER TABLE telephony_day_settings
  ADD COLUMN IF NOT EXISTS last_company_check DATE;

ALTER TABLE telephony_day_settings
  DROP CONSTRAINT IF EXISTS telephony_day_settings_work_hours_check;

ALTER TABLE telephony_day_settings
  ADD CONSTRAINT telephony_day_settings_work_hours_check
  CHECK (work_end > work_start);

-- Пустые часы отдела значат «брать общее окно».
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS work_start TIME;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS work_end TIME;

ALTER TABLE departments
  DROP CONSTRAINT IF EXISTS departments_work_hours_check;

ALTER TABLE departments
  ADD CONSTRAINT departments_work_hours_check
  CHECK (
    (work_start IS NULL AND work_end IS NULL)
    OR (work_start IS NOT NULL AND work_end IS NOT NULL AND work_end > work_start)
  );

-- Галочка «видит статистику звонков». Руководитель отдела видит её и без галочки.
ALTER TABLE calls_settings_users
  ADD COLUMN IF NOT EXISTS show_call_stats BOOLEAN NOT NULL DEFAULT false;

-- Пороги отметки разговора. Короче первого — короткий, длиннее второго — длинный.
ALTER TABLE telephony_day_settings
  ADD COLUMN IF NOT EXISTS short_seconds INTEGER NOT NULL DEFAULT 30;

ALTER TABLE telephony_day_settings
  ADD COLUMN IF NOT EXISTS long_seconds INTEGER NOT NULL DEFAULT 180;

ALTER TABLE telephony_day_settings
  DROP CONSTRAINT IF EXISTS telephony_day_settings_talk_marks_check;

ALTER TABLE telephony_day_settings
  ADD CONSTRAINT telephony_day_settings_talk_marks_check
  CHECK (short_seconds > 0 AND long_seconds > short_seconds);

-- Кто включил запись.
CREATE TABLE IF NOT EXISTS call_recording_plays (
  id SERIAL PRIMARY KEY,
  call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Сбои телефонии на рабочем компьютере. Не журнал всех действий.
CREATE TABLE IF NOT EXISTS crm_work_log (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  process VARCHAR(40) NOT NULL,
  kind VARCHAR(40) NOT NULL,
  message TEXT NOT NULL,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS crm_work_log_created_idx
  ON crm_work_log (created_at DESC);
