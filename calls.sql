ALTER TABLE work_groups ADD COLUMN notification_sent BOOLEAN DEFAULT FALSE;










 SELECT create_type, COUNT(*) AS count
      FROM work_groups wg
      JOIN group_participants gp ON wg.id = gp.work_groups_id
      WHERE gp.user_id = 2
      GROUP BY create_type

SELECT create_type,gp.user_id, COUNT(*) AS count
      FROM work_groups wg
      JOIN group_participants gp ON wg.id = gp.work_groups_id
      WHERE gp.user_id = 2
      GROUP BY create_type, gp.user_id


DELETE FROM group_participants WHERE work_groups_id = 164 AND user_id = 2

SELECT * FROM group_participants WHERE work_groups_id = 176;


SELECT * FROM telegramm_registrations_chat WHERE user_id IN (SELECT user_id FROM group_participants WHERE work_groups_id = 176);

SELECT * FROM telegramm_registrations_chat WHERE user_id = 2;

select * from group_participants

select * from work_groups

select * from participant_votes

SELECT DISTINCT chat_id
FROM telegramm_registrations_chat 
WHERE user_id IN (
    SELECT user_id 
    FROM group_participants 
    WHERE work_groups_id = 176)


	SELECT DISTINCT chat_id  -- Убедитесь, что выбираете уникальные chat_id
      FROM telegramm_registrations_chat 
      WHERE user_id IN (
        SELECT user_id 
        FROM group_participants 
        WHERE work_groups_id = 112)


-- Удаление триггера
DROP TRIGGER IF EXISTS group_creation_trigger ON work_groups;

-- Удаление функции
DROP FUNCTION IF EXISTS notify_group_creation();

 
INSERT INTO work_groups (
    group_name, 
    description, 
    importance, 
    create_type, 
    start_date, 
    end_date, 
    selected_date, 
    created_by
) VALUES (
    'Новая рабочая группа',  -- значение для group_name
    'Описание новой рабочей группы',  -- значение для description
    'Высокая',  -- значение для importance
    'range',  -- значение для create_type
    '2024-11-01 10:00:00',  -- значение для start_date
    '2024-11-15 10:00:00',  -- значение для end_date
    '2024-11-10 10:00:00',  -- значение для selected_date
    2  -- значение для created_by (должен быть действительный user_id)
);



DELETE FROM work_groups;

DELETE FROM participant_votes;

DELETE FROM group_participants;





SELECT * 
FROM telegramm_registrations_chat
WHERE user_id IN (SELECT user_id FROM group_participants WHERE work_groups_id = 186);




 CREATE TABLE work_groups (
    id SERIAL PRIMARY KEY, 
    group_name VARCHAR(255) NOT NULL, 
    description TEXT NOT NULL, 
    importance VARCHAR(50) NOT NULL, 
    create_type VARCHAR(10) NOT NULL, 
    start_date TIMESTAMP,     
    end_date TIMESTAMP,       
    selected_date TIMESTAMP,           
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    created_by INT NOT NULL
);

CREATE TABLE group_participants (
    id SERIAL PRIMARY KEY,
    work_groups_id INTEGER REFERENCES work_groups(id) ON DELETE CASCADE, -- Удаление участников, если группа удалена
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Удаление участников из таблицы users
    UNIQUE (work_groups_id, user_id) 
);

CREATE TABLE participant_votes (
    id SERIAL PRIMARY KEY,
    group_id INT REFERENCES work_groups(id) ON DELETE CASCADE, -- Удаление голосов при удалении группы
    participant_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Удаление голосов при удалении участника
    selected_date TIMESTAMP  ,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);


DROP TABLE IF EXISTS participant_votes CASCADE;
DROP TABLE IF EXISTS group_participants CASCADE;
DROP TABLE IF EXISTS work_groups CASCADE;



ALTER TABLE work_groups
ADD COLUMN created_by INT NOT NULL,
ADD FOREIGN KEY (created_by) REFERENCES users(id);

 SELECT * FROM participant_votes WHERE group_id = 145 AND participant = 'Крепышева Татьяна';

ALTER TABLE participant_votes
ADD CONSTRAINT unique_participant_vote UNIQUE (group_id, participant, selected_date);

SELECT * FROM information_schema.table_constraints 
WHERE table_name = 'participant_votes';


CREATE TABLE participant_votes (
    id SERIAL PRIMARY KEY,
    group_id INT REFERENCES work_groups(id),
    participant VARCHAR(255) NOT NULL,
    selected_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);





CREATE TABLE telegramm_registrations_chat (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  chat_id BIGINT UNIQUE NOT NULL,
  registered BOOLEAN DEFAULT false
);

SELECT * FROM telegramm_registrations_chat 
	
TRUNCATE TABLE telegramm_registrations_chat RESTART IDENTITY;

INSERT INTO calls (caller_number, receiver_number, accepted_at, status) VALUES
('1234567890', '0987654321', NOW(), 'missed'),
('2345678901', '1987654321', NOW(), 'missed'),
('3456789012', '2987654321', NOW(), 'missed'),
('4567890123', '3987654321', NOW(), 'missed'),
('5678901234', '4987654321', NOW(), 'missed')
	
	INSERT INTO calls (caller_number, receiver_number, accepted_at, status)
VALUES ('2321', '777777777777777', NOW(), 'missed');

SELECT * FROM call_processing_logs WHERE call_id = 48;

UPDATE calls 
SET status = 'processed' 
WHERE caller_number = '1234567890' AND status = 'missed';

	
	select * from dealers

			select * from calls where id = 124
		
	select * from calls_settings_users

--DELETE FROM calls_settings_users;

UPDATE calls_settings_users
SET showAcceptedCallsEmployee = false
WHERE user_id = 2;

SELECT showMissedCallsEmployee FROM calls_settings_users WHERE user_id = 2;

UPDATE calls_settings_users
SET showRemindersCalls = true
WHERE user_id = 2;

CREATE TABLE calls_settings_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    showMissedCallsEmployee BOOLEAN DEFAULT true,
    showAcceptedCallsEmployee BOOLEAN DEFAULT true,
	showRemindersCalls BOOLEAN DEFAULT false;
    CONSTRAINT fk_user
        FOREIGN KEY (user_id) 
        REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

ALTER TABLE calls_settings_users
ADD COLUMN showRemindersCalls BOOLEAN DEFAULT false;



select * from reminders

	ALTER TABLE reminders
ADD COLUMN notification_shown BOOLEAN DEFAULT FALSE;


CREATE TABLE reminders (
    id SERIAL PRIMARY KEY,                          -- Уникальный идентификатор напоминания (первичный ключ).
    related_id INTEGER NOT NULL,                    -- Идентификатор связанного объекта (например, ID звонка, задачи и т.д.).
    user_id INTEGER NOT NULL,                       -- Идентификатор пользователя, создавшего напоминание (внешний ключ).
    date_time TIMESTAMP NOT NULL,                   -- Дата и время, когда должно произойти напоминание.
    comment TEXT,                                   -- Комментарий или описание напоминания.
    type_reminders VARCHAR(50) NOT NULL,           -- Тип напоминания (например, "call", "task" и т.д.).
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Дата и время создания напоминания (по умолчанию текущее время).
    is_completed BOOLEAN DEFAULT FALSE,             -- Статус выполнения напоминания: TRUE - выполнено, FALSE - не выполнено (по умолчанию FALSE).
    completed_at TIMESTAMP NULL,                   -- Дата и время, когда напоминание было выполнено; NULL, если напоминание еще не выполнено.
    FOREIGN KEY (user_id) REFERENCES users(id)     -- Связь с таблицей users по идентификатору пользователя.
);