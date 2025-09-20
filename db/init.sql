 -- Полная очистка БД от прошлых таблиц
/* 	DO $$ DECLARE
    r RECORD;
BEGIN
    -- Удаляем все таблицы
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$; */

-- Лог действий пользователя
CREATE TABLE user_actions (
    id SERIAL PRIMARY KEY,                                        -- идентификационный номер
    userId INTEGER,                                               -- id пользователя
    action VARCHAR(50) NOT NULL,                                  -- действие (удаление, создание, и тд.)
    entity_info JSON,                                             -- JSON { "id": 1, "name": "Карточка 1" }
    context VARCHAR(100),                                         -- Область действия (например, "карточка дилера", "задача") 
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

/*USERS*/
-- Создание таблицы roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор роли
    name VARCHAR(100) NOT NULL UNIQUE -- Название роли (например, "Администратор", "Менеджер", "Сотрудник")
);


-- Создание таблицы positions
CREATE TABLE positions (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор должности
    name VARCHAR(100) NOT NULL UNIQUE-- Название должности (например, "Программист", "Менеджер по продажам")
);

-- Создание таблицы components
CREATE TABLE components (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор компонента
    name VARCHAR(100) NOT NULL UNIQUE -- Название компонента
);

-- Таблица прав доступа
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    component_id INTEGER REFERENCES components(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    UNIQUE(role_id, component_id) -- Уникальность для комбинации роли и компонента
);


-- Создание таблицы users с дополнительными полями, индексами и триггером для updated_at
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    role_id INTEGER  REFERENCES roles(id) ON DELETE SET NULL,
    position_id INTEGER   REFERENCES positions(id) ON DELETE SET NULL,
    first_name VARCHAR(30),
    middle_name VARCHAR(30),
    last_name VARCHAR(30),
    birth_date DATE,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    email_token VARCHAR(200),
    avatar_url VARCHAR(200),
    user_photo BYTEA,
    role_assigned BOOLEAN DEFAULT false,
    supervisor_id INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    department_id INTEGER,
    status VARCHAR(10) DEFAULT 'offline',
    gender VARCHAR(15) DEFAULT 'не установлен'
);


-- Создание таблицы departments с дополнительными индексами и триггером для updated_at
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    head_user_id INTEGER
);



-- Добавление внешних ключей
ALTER TABLE users
ADD CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles(id);

ALTER TABLE users
ADD CONSTRAINT fk_supervisor FOREIGN KEY (supervisor_id) REFERENCES users(id);

ALTER TABLE users
ADD CONSTRAINT fk_department FOREIGN KEY (department_id) REFERENCES departments(id);

ALTER TABLE users
ADD CONSTRAINT fk_position FOREIGN KEY (position_id) REFERENCES positions(id);

ALTER TABLE departments
ADD CONSTRAINT fk_head_user FOREIGN KEY (head_user_id) REFERENCES users(id);

-- Создание таблицы user_phones для хранения телефонов пользователей
CREATE TABLE user_phones (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор телефона
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Ссылка на пользователя
    phone_number VARCHAR(20) NOT NULL, -- Номер телефона
    phone_type VARCHAR(20) NOT NULL -- Тип телефона (например, "мобильный", "рабочий")
);

-- Создание триггера для обновления поля updated_at в таблице users
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at_trigger
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_users_updated_at();

 
-- Создание таблицы user_department_position с дополнительными ограничениями
CREATE TABLE user_department_position (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Ссылка на пользователя
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE, -- Ссылка на отдел
    position_id INTEGER REFERENCES positions(id) ON DELETE CASCADE, -- Ссылка на должность
    start_date DATE NOT NULL, -- Дата начала работы в отделе/на должности
    end_date DATE, -- Дата окончания работы в отделе/на должности
    is_current BOOLEAN DEFAULT false, -- Флаг, указывающий, является ли эта запись текущей
    PRIMARY KEY (user_id, department_id, position_id) -- Составной первичный ключ
);

-- Настройки компонентов Астериск звонки 
CREATE TABLE calls_settings_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    showMissedCallsEmployee BOOLEAN DEFAULT false,
    showAcceptedCallsEmployee BOOLEAN DEFAULT false,
    showCallMissedTg BOOLEAN DEFAULT false, -- показывать пропущенные звонки
    showRemindersCalls BOOLEAN DEFAULT false, -- показывать уведомления таймера-напоминания  
    showOverdueNotification BOOLEAN DEFAULT false, -- показывать уведомления просроченных уведомлений
    showOverdueImplementer BOOLEAN DEFAULT false, -- показывать уведомления просроченных уведомлений сотрудников для руководителя отдела
    CONSTRAINT fk_user
        FOREIGN KEY (user_id) 
        REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Тригеры для вставки пользователй в настройки телефонии
CREATE OR REPLACE FUNCTION insert_calls_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO calls_settings_users (user_id)
    VALUES (NEW.id); -- Используем NEW.id для получения id нового пользователя
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER after_user_insert
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION insert_calls_settings();


 
-- Частичные индексы для уникальности текущих записей
CREATE UNIQUE INDEX idx_user_department_current 
ON user_department_position(user_id, department_id) 
WHERE is_current = true;

CREATE UNIQUE INDEX idx_user_position_current 
ON user_department_position(user_id, position_id) 
WHERE is_current = true;


-- Триггер для проверки даты окончания в таблице user_department_position
CREATE OR REPLACE FUNCTION check_end_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN
        RAISE EXCEPTION 'Дата окончания не может быть раньше даты начала.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER check_end_date_trigger
BEFORE INSERT OR UPDATE ON user_department_position
FOR EACH ROW EXECUTE FUNCTION check_end_date();





--*******************************************Вставка данных*******************************↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
-- Вставка ролей
INSERT INTO roles (id, name) VALUES (1, 'Администратор'), (2, 'Директор');
 
-- Вставка данных в таблицу users
INSERT INTO users (
    id, role_id, first_name, middle_name, last_name, birth_date, username, password, email, email_token, avatar_url, user_photo, role_assigned, supervisor_id, created_at, updated_at, department_id, position_id, status
) VALUES (
    1, 1, 'Александр', 'Александрович', 'Мизинцов', '1988-07-04', 'admin', '$2b$10$un.Xb7XNkRIsJskA0VEhYO17T1VbnwP3J7QhjVo.B7kOmg9BahrGS', 'a.mizincov@poz-sar.com', 'RjfRSdye9zgfyVUhkAtg', NULL, 'binary data', TRUE, NULL, '2024-07-25 20:36:23.138278', '2024-07-25 20:36:23.138278', NULL, NULL, 'offline'
 );

-- Вставка данных в таблицу user_phones
INSERT INTO user_phones (
    user_id, phone_number, phone_type
) VALUES
    (1, '89271390907', 'мобильный');


SELECT setval('roles_id_seq', (SELECT COALESCE(MAX(id), 0) FROM roles)); -- восстановление последовательности для роли
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 0) FROM users)); -- восстановление последовательности для пользователей

    --******************************************↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑***********************************

-- ***************************************************↓ Таблицы отпусков и статуса отсутствия ↓****************************************************
-- Статусы сотрудников для периода времени
CREATE TABLE user_statuses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL, -- Например, 'отпуск', 'болезнь', 'выходные', 'командировка'
    start_date DATE, -- Дата начала статуса
    end_date DATE, -- Дата окончания статуса
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW() 
);
-- Статусы сотрудников для конкретной даты
CREATE TABLE user_status_dates (
    id SERIAL PRIMARY KEY,
    user_status_id INTEGER REFERENCES user_statuses(id) ON DELETE CASCADE,
    specific_date DATE NOT NULL -- конкретная дата одного дня
);


-- ***************************************************↑ ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑ ↑****************************************************
 
 
--****************************************************↓ Дилеры ↓***********************************************************************************************
-- Таблица компания
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,                             -- Уникальный идентификатор компании
    name_companies VARCHAR(255) NOT NULL UNIQUE,       -- Название компании
    status_companies VARCHAR(50),                      -- Статус компании
    seller_code VARCHAR(50),                           -- Код продавца
    inn VARCHAR(255) UNIQUE,                           -- ИНН
    trade_brand VARCHAR(255),                          -- Торговый бренд
    regional_manager_id INTEGER REFERENCES users(id),  -- Региональный менеджер (ссылка на id в таблице users)
    mpp_id INTEGER REFERENCES users(id),               -- МПП (ссылка на id в таблице users)
    mpr_id INTEGER REFERENCES users(id),               -- МПР (ссылка на id в таблице users)
    has_availability BOOLEAN DEFAULT FALSE,            -- Наличие АВ (булево значение)
    has_warehouse BOOLEAN DEFAULT FALSE,               -- Наличие склада (булево значение)
    document_transfer_department VARCHAR(255),         -- Отдел передачи документов
    is_self_service BOOLEAN DEFAULT FALSE,             -- Самостоятельный клиент (булево значение)
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(), -- Дата создания записи
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),  -- Дата последнего обновления записи
    telegram_password VARCHAR(255) NOT NULL DEFAULT 'NOTACCES'   -- Пароль компании (хранится в хэшированном виде)
);


 
 
-- для telegram_password
CREATE UNIQUE INDEX unique_telegram_password
ON companies(telegram_password)
WHERE telegram_password <> 'NOTACCES';

-- Адреса компании
CREATE TABLE company_addresses (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    region VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    street VARCHAR(255) NOT NULL,
    building VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,  -- указание основного адреса
    comment TEXT                        -- дополнительные примечания по адресу
);


    -- Значимые даты
    CREATE TABLE important_dates (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        date_name VARCHAR(255) NOT NULL,
        event_date DATE NOT NULL
    );


    -- Способы оповещения
    CREATE TABLE notification_methods (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        method_name VARCHAR(255) NOT NULL
    );


    --Условия доставки
    CREATE TABLE delivery_terms (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        term_name VARCHAR(255) NOT NULL,
        term_comment TEXT
    );


    -- Социальные сети
    CREATE TABLE social_networks (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        network_name VARCHAR(255) NOT NULL,
        comment TEXT
    );


    -- Подъем на этаж   
    CREATE TABLE floor_rising (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        is_paid BOOLEAN NOT NULL, -- TRUE для платно, FALSE для бесплатно
        comment TEXT
    );


    -- Сопутствующая деятельность компании
    CREATE TABLE related_activities (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        activity_name VARCHAR(255) NOT NULL
    );


    -- Договор компании
    CREATE TABLE contracts (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        contract_name VARCHAR(255) NOT NULL
    );


    -- Замещающий МПР
    CREATE TABLE replacing_mpr (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    );


    -- Замещающий МПП
    CREATE TABLE replacing_mpp (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    );

    -- Таблица приоритетов для замещающих МПП
CREATE TABLE mpp_priority (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,  -- Ссылка на компанию
    replacing_mpp_id INTEGER REFERENCES replacing_mpp(id) ON DELETE CASCADE, -- Ссылка на замещающего МПП
    priority_level INTEGER NOT NULL, -- Уровень приоритета (1 = высший приоритет, 2 = ниже и т.д. 0 = приоритет отсутствует)
    UNIQUE(company_id, replacing_mpp_id) -- Уникальность записи для каждой компании и замещающего
);

    -- Отрасли компании
    CREATE TABLE company_industries (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        industry_name VARCHAR(100) NOT NULL
    );

    -- Телефоны компании
    CREATE TABLE phone_numbers_companies (
        id SERIAL PRIMARY KEY, -- Уникальный идентификатор номера телефона
        company_id INT REFERENCES companies(id) ON DELETE CASCADE, -- Внешний ключ на таблицу companies
        phone_number VARCHAR(20) NOT NULL -- Номер телефона компании
    );

    -- Почта компании
    CREATE TABLE emails_companies (
        id SERIAL PRIMARY KEY, -- Уникальный идентификатор электронного адреса
        company_id INT REFERENCES companies(id) ON DELETE CASCADE, -- Внешний ключ на таблицу companies
        email VARCHAR(100) NOT NULL UNIQUE -- Электронная почта компании
    );

-- Конкуренты
    CREATE TABLE competitors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,        -- Название конкурента
    industry VARCHAR(100),             -- Отрасль/сектор, в которой конкурент работает
    contact_email VARCHAR(100),        -- Контактный email конкурента, если необходимо
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(), -- Дата создания записи
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()  -- Дата обновления записи
);
CREATE TABLE dealer_competitors (
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,  -- Внешний ключ для дилера
    competitor_id INTEGER REFERENCES competitors(id) ON DELETE CASCADE,  -- Внешний ключ для конкурента
    PRIMARY KEY (company_id, competitor_id),
    has_representation BOOLEAN DEFAULT FALSE  -- Индикатор того, если конкурент работает с данным дилером
);

 --********************Телеграмм бот диллеров*********************************************** 
 -- Содержит чаты(id) тг для дилеров
CREATE TABLE user_company_tg_bot (
    id SERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,                             -- Идентификатор чата
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, -- Ссылка на уникальный идентификатор компании с каскадным удалением
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(), -- Дата создания записи
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(), -- Дата последнего обновления записи 
    request_count INTEGER DEFAULT 0,                     -- Количество обращений
    UNIQUE (chat_id, company_id)                         -- Убедитесь, что для одной компании может быть один chatId
);
--{
CREATE TABLE calculations_bot_dealers (
    id SERIAL PRIMARY KEY,                  -- Уникальный идентификатор записи
    chat_id BIGINT NOT NULL,                -- Идентификатор чата (Telegram)
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,  -- Идентификатор компании с внешним ключом
    calculation_number VARCHAR(255),        -- Номер расчета (если есть)
    importance VARCHAR(50),                 -- Важность расчета (например, "низкая", "высокая")
    text_calc TEXT,                         -- Введенный текст  
    file_paths TEXT,                        -- Пути к документам, разделенные запятыми (если есть)
    photo_paths TEXT,                       -- Пути к фотографиям, разделенные запятыми (если есть)
    file_links TEXT,                        -- Ссылки на документы, разделенные запятыми (если есть)
    photo_links TEXT,                       -- Ссылки на фотографии, разделенные запятыми (если есть)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Дата и время записи
);
 
-- Таблица для учета рекламационных заявок с автоматическим контролем времени обработки
CREATE TABLE reclamation_records ( 
    id SERIAL PRIMARY KEY,  -- Уникальный идентификатор записи (автоинкремент) 
    claim_number VARCHAR(30) NOT NULL UNIQUE,    -- Номер рекламационной заявки (обязательное поле) 
    kontragent VARCHAR(255),  -- Наименование поставщика/контрагента 
    inn VARCHAR(255), -- ИНН контрагента 
    defect TEXT,  -- Подробное описание дефекта/проблемы
    location TEXT,  -- Место обнаружения проблемы 
    claim_date DATE, -- Дата возникновения рекламации (из заявки) 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- [ВАЖНО] Время создания записи в БД (автоматически) 
    sent_at TIMESTAMP,  -- [НОВОЕ] Время отправки уведомления (автоматически) 
    processed BOOLEAN DEFAULT FALSE  -- Статус обработки заявки -- FALSE - новая заявка (по умолчанию)  -- TRUE - уведомление отправлено
);
 
CREATE INDEX idx_reclamation_records_claim_number ON reclamation_records(claim_number); 
CREATE INDEX idx_reclamation_records_unsent ON reclamation_records(processed)
WHERE processed = FALSE;

-- Триггер для автоматического проставления времени отправки
CREATE OR REPLACE FUNCTION set_sent_timestamp()
RETURNS TRIGGER AS $$
BEGIN 
    IF NEW.processed = TRUE AND OLD.processed = FALSE THEN
        NEW.sent_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_sent_time
BEFORE UPDATE ON reclamation_records
FOR EACH ROW
EXECUTE FUNCTION set_sent_timestamp();
 
 



-- дилер, персона в компании
-- Таблица дилеров **************************************************************************
CREATE TABLE dealers (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор дилера
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, -- Ссылка на компанию (из таблицы companies)
    last_name VARCHAR(255) NOT NULL, -- Фамилия контактного лица дилера
    first_name VARCHAR(255) NOT NULL, -- Имя контактного лица дилера
    middle_name VARCHAR(255), -- Отчество контактного лица дилера
    birth_date DATE, -- День рождения контактного лица дилера 
    gender VARCHAR(10), -- Пол контактного лица дилера
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(), -- Дата создания записи
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() -- Дата последнего изменения записи
);

-- Таблица хобби дилеров
CREATE TABLE dealer_hobbies (
    id SERIAL PRIMARY KEY,
    dealer_id INTEGER REFERENCES dealers(id) ON DELETE CASCADE, -- Ссылка на дилера (из таблицы dealers)
    hobby TEXT NOT NULL -- Хобби дилера
);

-- Таблица должностей дилеров
CREATE TABLE dealer_positions (
    id SERIAL PRIMARY KEY,
    dealer_id INTEGER REFERENCES dealers(id) ON DELETE CASCADE, -- Ссылка на дилера (из таблицы dealers)
    position VARCHAR(100) NOT NULL -- Должность дилера
);

-- Таблица телефонных номеров дилеров
CREATE TABLE dealer_phone_numbers (
    id SERIAL PRIMARY KEY,
    dealer_id INTEGER REFERENCES dealers(id) ON DELETE CASCADE, -- Ссылка на дилера (из таблицы dealers)
    phone_number VARCHAR(20) NOT NULL, -- Номер телефона
    phone_type VARCHAR(20), -- Тип телефона (например, мобильный, рабочий, домашний)
    is_primary BOOLEAN DEFAULT false -- Является ли номер основным
);

-- Таблица электронной почты дилеров
CREATE TABLE dealer_emails (
    id SERIAL PRIMARY KEY,
    dealer_id INTEGER REFERENCES dealers(id) ON DELETE CASCADE, -- Ссылка на дилера (из таблицы dealers)
    email VARCHAR(255) NOT NULL, -- Электронная почта 
    is_primary BOOLEAN DEFAULT false -- Является ли почта основной
);
 
-- Триггер для автоматического обновления поля updated_at в таблице dealers
CREATE OR REPLACE FUNCTION update_dealers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dealers_updated_at_trigger
BEFORE UPDATE ON dealers
FOR EACH ROW EXECUTE FUNCTION update_dealers_updated_at();
 
 


/*ASTERISK*/
-- Звонки Астериск
CREATE TABLE calls (
    id SERIAL PRIMARY KEY,
    caller_number VARCHAR(20) NOT NULL, -- звонящий
    receiver_number VARCHAR(20), -- кому звонили
    accepted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(), -- дата звонка
    status VARCHAR(20) DEFAULT 'missed' CHECK (status IN ('missed', 'accepted', 'processed'))
);

-- Данные кто обработал звонок
CREATE TABLE call_processing_logs (
    id SERIAL PRIMARY KEY,
    call_id INTEGER REFERENCES calls(id) ON DELETE CASCADE,  -- Связь с таблицей calls
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,   -- Связь с таблицей users
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()   -- Дата и время обработки
);

-- Комментарии к звонку
CREATE TABLE call_comments (
    id SERIAL PRIMARY KEY,               -- Уникальный идентификатор комментария
    call_id INTEGER REFERENCES calls(id) ON DELETE CASCADE, -- Связь с таблицей calls
    dealer_id INTEGER REFERENCES dealers(id) ON DELETE CASCADE, -- Ссылка на дилера
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- Ссылка на пользователя, который добавил комментарий
    comment TEXT NOT NULL,               -- Текст комментария
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(), -- Дата создания комментария
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()  -- Дата последнего изменения комментария
);
 
-- отслеживание изменений в таблице calls
CREATE OR REPLACE FUNCTION notify_call_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('new_call_channel', NEW.id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_call_change
AFTER INSERT OR UPDATE ON calls
FOR EACH ROW 
EXECUTE FUNCTION notify_call_change();

-- Регистрация в чат боте Телеграмм
CREATE TABLE telegramm_registrations_chat (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  chat_id BIGINT UNIQUE NOT NULL,
  registered BOOLEAN DEFAULT false
);

-- Для связки напоминания к определенной задаче или звонку для уведомлений.  
CREATE TABLE reminders (
    id SERIAL PRIMARY KEY,                          -- Уникальный идентификатор напоминания (первичный ключ).
    related_id INTEGER NOT NULL,                    -- Идентификатор связанного объекта (например, ID звонка, задачи из таблицы и т.д.).
    user_id INTEGER NOT NULL,                       -- Идентификатор пользователя / Отображается для id сотрудника
    date_time TIMESTAMP NOT NULL,                   -- Дата и время, когда должно произойти напоминание.
    comment TEXT,                                   -- Комментарий или описание напоминания.
    type_reminders VARCHAR(50) NOT NULL,           -- Тип напоминания (например, "call", "task", "notification" и т.д.).
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Дата и время создания напоминания (по умолчанию текущее время). 
    is_completed BOOLEAN DEFAULT FALSE,             -- Статус выполнения напоминания: TRUE - выполнено, FALSE - не выполнено (по умолчанию FALSE).
    completed_at TIMESTAMP NULL,                   -- Дата и время, когда напоминание было выполнено; NULL, если напоминание еще не выполнено.
    priority_notifications VARCHAR(50) DEFAULT 'low', -- Приоритет уведомления (например, "low", "normal", "high")
    title TEXT,                                       -- Для отображения оглавления уведомлений
    links JSONB,                                      -- Для хранения различных ссылок на файлы или сайты
    tags JSONB,                                     -- тэги для отображения
    FOREIGN KEY (user_id) REFERENCES users(id)     -- Связь с таблицей users по идентификатору пользователя.
);
CREATE INDEX idx_reminders_is_completed ON reminders(is_completed);
ALTER TABLE reminders
ALTER COLUMN date_time TYPE TIMESTAMP WITH TIME ZONE;

-- Для записи отправленных сообщений в уведомлениях от дилера
CREATE TABLE sent_messages_notifications (
    id SERIAL PRIMARY KEY,
    reminders_id INT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE, -- Внешний ключ с каскадным удалением
    sent_text TEXT, -- Текст, который был отправлен
    sent_files TEXT[], -- Имена файлов, которые были отправлены
    sent_at TIMESTAMP DEFAULT NOW() -- Дата и время отправки
);

-- Уникальный индекс для предотвращения дублирования сообщений
CREATE UNIQUE INDEX idx_sent_messages_unique 
ON sent_messages_notifications (reminders_id, sent_text, sent_files, DATE_TRUNC('minute', sent_at));

-- Для хранения истории завершенных уведомлений
CREATE TABLE completed_notifications_history (
    id SERIAL PRIMARY KEY,
    original_reminder_id INT NOT NULL, -- ID оригинального уведомления
    dealer_name VARCHAR(255) NOT NULL, -- Наименование дилера
    request_description TEXT, -- Суть запроса
    priority VARCHAR(50) DEFAULT 'normal', -- Приоритет уведомления
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Дата создания уведомления
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Дата завершения (удаления)
    completed_by_user_id INT REFERENCES users(id) ON DELETE SET NULL, -- Пользователь, завершивший уведомление
    original_reminder_data JSONB -- Сохранение всех данных оригинального уведомления
);

-- Индексы для быстрого поиска
CREATE INDEX idx_completed_notifications_user_id ON completed_notifications_history(completed_by_user_id);
CREATE INDEX idx_completed_notifications_dealer_name ON completed_notifications_history(dealer_name);
CREATE INDEX idx_completed_notifications_completed_at ON completed_notifications_history(completed_at);

-- Для хранения истории отправленных сообщений и файлов к завершенным уведомлениям
CREATE TABLE completed_notifications_messages (
    id SERIAL PRIMARY KEY,
    completed_notification_id INT NOT NULL REFERENCES completed_notifications_history(id) ON DELETE CASCADE,
    sent_text TEXT, -- Текст, который был отправлен
    sent_files TEXT[], -- Имена файлов, которые были отправлены
    sent_at TIMESTAMP DEFAULT NOW() -- Дата и время отправки
);

-- Индекс для быстрого поиска по завершенному уведомлению
CREATE INDEX idx_completed_messages_notification_id ON completed_notifications_messages(completed_notification_id);

/*
CREATE TABLE notifications_telegramm_dealer (    
     priority_notifications VARCHAR(50) DEFAULT 'normal' -- Приоритет уведомления (например, "low", "normal", "high")
);🔴
*/


--******************************************
 -- **************************** Рабочая группа **************************************
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
    created_by INT NOT NULL,
    notification_sent BOOLEAN DEFAULT FALSE 
);

CREATE TABLE group_participants (
    id SERIAL PRIMARY KEY,
    work_groups_id INTEGER REFERENCES work_groups(id) ON DELETE CASCADE,  
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  
    UNIQUE (work_groups_id, user_id) 
);

CREATE TABLE participant_votes (
    id SERIAL PRIMARY KEY,
    group_id INT REFERENCES work_groups(id) ON DELETE CASCADE, -- Удаление голосов при удалении группы
    participant_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Удаление голосов при удалении участника
    selected_date TIMESTAMP ,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);


-- **************************** ЗАДАЧИ TASKS *****************************************
-- Создание глобальной задачи 
CREATE TABLE global_tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    goals JSONB,
    deadline TIMESTAMP, 
    priority VARCHAR(50) NOT NULL DEFAULT 'medium', -- Устанавливаем значение по умолчанию  
    CHECK (priority IN ('high', 'medium', 'low')),
    status VARCHAR(50) NOT NULL,  -- Статус глобальной задачи (Новая, В работе, Завершено, На паузе, Отменена)
    progress INT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),  -- Общий процент выполнения, зависит общего количества подзадач и количества выполненных
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES users(id) ON DELETE SET NULL, -- Связь с таблицей users создатель
    additional_info JSONB -- дополнительная информация. 
);

-- Связующая таблица для ответственных лиц
CREATE TABLE global_task_responsibles (
    global_task_id INT REFERENCES global_tasks(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50),  -- Можно указать роль: например, "лидер", "исполнитель" и т.д.
    PRIMARY KEY (global_task_id, user_id)
);
CREATE INDEX idx_global_task_responsibles_user_id ON global_task_responsibles(user_id);

-- Чат Глобальной задачи
CREATE TABLE global_task_chat_messages (
    id SERIAL PRIMARY KEY,
    global_task_id INT REFERENCES global_tasks(id) ON DELETE CASCADE, -- Связь с глобальной задачей
    user_id INT REFERENCES users(id) ON DELETE CASCADE, -- Пользователь, отправивший сообщение
    text TEXT NOT NULL, -- Текст сообщения
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Время отправки сообщения
);
-- для ссылочных сообщений 
ALTER TABLE global_task_chat_messages
ADD COLUMN replied_to_message_id INT NULL,
ADD CONSTRAINT fk_replied_message_global
FOREIGN KEY (replied_to_message_id)
REFERENCES global_task_chat_messages(id) ON DELETE SET NULL;

CREATE INDEX idx_chat_messages_task_id ON global_task_chat_messages(global_task_id);

-- Комментарии при действиях. Например если провал, то запросить комментарий о причине провала
CREATE TABLE action_global_task_comment (
  id SERIAL PRIMARY KEY,
  global_task_id INTEGER REFERENCES global_tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_comments_task_id ON action_global_task_comment(global_task_id);

-- История событий глобальной задачи
CREATE TABLE global_task_history (
    id SERIAL PRIMARY KEY,
    global_task_id INT REFERENCES global_tasks(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- Тип события: "создание", "обновление", "завершение", "ошибка", "комментарий" и т.д.
    description TEXT, -- Детали события
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES users(id) ON DELETE SET NULL, -- Кто зафиксировал событие
    data JSONB -- Дополнительные данные, например, изменения в полях, входные параметры, ошибки
);
CREATE INDEX idx_global_task_history_task_id ON global_task_history(global_task_id);
 
  -- задача
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор задачи
    title VARCHAR(255) NOT NULL, -- Заголовок задачи
    description TEXT, -- Описание задачи
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Дата и время создания задачи
    created_by INT REFERENCES users(id) ON DELETE SET NULL, -- Идентификатор пользователя, который создал задачу
    deadline TIMESTAMP, -- Срок исполнения задачи
    priority VARCHAR(20), -- Приоритет задачи (например, высокий, средний, низкий)
    status VARCHAR(50) NOT NULL, -- Текущий статус задачи (например, "в ожидании", "в процессе", "завершена") 
    notification_status BOOLEAN DEFAULT FALSE -- Статус отображения уведомлений (True: уведомление было показано, False: нет)
);
 -- задача tasks
ALTER TABLE tasks 
ADD COLUMN tags JSONB,  -- для хранения тэгов
ADD COLUMN global_task_id INT REFERENCES global_tasks(id) ON DELETE SET NULL;    -- связь с глобальной задачей
ADD COLUMN is_completed BOOLEAN DEFAULT FALSE                   -- Подтверждение завершения задачи
ALTER TABLE tasks 
ADD COLUMN parent_id INT REFERENCES tasks(id) ON DELETE SET NULL,
ADD COLUMN root_id INT REFERENCES tasks(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_root_id ON tasks(root_id);

-- таблица для запроса продления дидлайна
CREATE TABLE task_deadline_extension_requests (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор запроса
    task_id INT REFERENCES tasks(id) ON DELETE CASCADE, -- ID задачи, для которой запрашивается продление
    requester_id INT REFERENCES users(id) ON DELETE SET NULL, -- ID пользователя, запросившего продление
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Дата и время создания запроса
    reason TEXT NOT NULL, -- Причина продления (обязательное поле)
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')), -- Статус запроса
    response_date TIMESTAMP, -- Дата ответа на запрос
    responder_id INT REFERENCES users(id) ON DELETE SET NULL, -- ID пользователя, ответившего на запрос
    response_comment TEXT, -- Комментарий при ответе (например, причина отклонения)
    new_proposed_deadline TIMESTAMP -- Предлагаемый новый срок (необязательное поле)
);

-- Индексы для ускорения запросов
CREATE INDEX idx_task_extension_requests_task_id ON task_deadline_extension_requests(task_id);
CREATE INDEX idx_task_extension_requests_status ON task_deadline_extension_requests(status);

-- Хранение предыдущего описания задачи после изменения текста
CREATE TABLE task_description_history (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор записи
    task_id INT REFERENCES tasks(id) ON DELETE CASCADE, -- Идентификатор задачи
    previous_description TEXT, -- Предыдущее описание задачи
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Дата и время обновления
);


  -- информации о назначенных исполнителях задач (может быть один или более).
  CREATE TABLE task_assignments (
    task_id INT REFERENCES tasks(id) ON DELETE CASCADE, -- Идентификатор задачи
    user_id INT REFERENCES users(id) ON DELETE CASCADE, -- Идентификатор пользователя, который исполняет задачу
    PRIMARY KEY (task_id, user_id) -- Уникальная пара (задача, пользователь)
); 
CREATE INDEX idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX idx_task_assignments_user_id ON task_assignments(user_id);
CREATE INDEX idx_tasks_is_completed ON tasks(is_completed);

-- информацию о пользователях, которым необходимо подтвердить выполнение задачи (может быть один или более).
CREATE TABLE task_approvals (
    task_id INT REFERENCES tasks(id) ON DELETE CASCADE, -- Идентификатор задачи
    approver_id INT REFERENCES users(id) ON DELETE CASCADE, -- Идентификатор пользователя, который должен подтвердить выполнение задачи
    is_approved BOOLEAN DEFAULT FALSE, -- Отметка о согласовании (True: согласована, False: не согласована)
    PRIMARY KEY (task_id, approver_id) -- Уникальная пара (задача, пользователь)
); 
CREATE INDEX idx_task_approvals_task_id ON task_approvals(task_id);
CREATE INDEX idx_task_approvals_approver_id ON task_approvals(approver_id);

-- информацию о том, кто может видеть задачу (для реализации уведомлений).
CREATE TABLE task_visibility (
    task_id INT REFERENCES tasks(id) ON DELETE CASCADE, -- Идентификатор задачи
    user_id INT REFERENCES users(id) ON DELETE CASCADE, -- Идентификатор пользователя, который может видеть задачу
    PRIMARY KEY (task_id, user_id) -- Уникальная пара (задача, пользователь)
); 
CREATE INDEX idx_task_visibility_task_id ON task_visibility(task_id);
CREATE INDEX idx_task_visibility_user_id ON task_visibility(user_id);

-- стадии выполнения задачи и связи с пользователями. Лучше сделать только для глобальных задач
/*CREATE TABLE task_progress (
    task_id INT REFERENCES tasks(id) ON DELETE CASCADE, -- Идентификатор задачи
    user_id INT REFERENCES users(id) ON DELETE CASCADE, -- Идентификатор пользователя, которому относится этот прогресс
    stage_description TEXT, -- Текстовое описание текущего этапа выполнения задачи
    progress INT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100), -- Процент выполнения задачи (от 0 до 100)
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Дата и время последнего обновления статуса выполнения задачи
    PRIMARY KEY (task_id, user_id) -- Уникальная пара (задача, пользователь)
); 
CREATE INDEX idx_task_progress_task_id ON task_progress(task_id);
CREATE INDEX idx_task_progress_user_id ON task_progress(user_id);*/

-- хранения комментариев к задачам (При отправке на доработку).
CREATE TABLE task_comments_redo (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор комментария
    task_id INT REFERENCES tasks(id) ON DELETE CASCADE, -- Идентификатор задачи, к которой относится комментарий
    comment TEXT NOT NULL, -- Текст комментария
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Дата и время создания комментария
);

-- хранения комментариев к задачам (как чат).
CREATE TABLE task_comments (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор комментария
    task_id INT REFERENCES tasks(id) ON DELETE CASCADE, -- Идентификатор задачи, к которой относится комментарий
    user_id INT REFERENCES users(id) ON DELETE CASCADE, -- Идентификатор пользователя, который оставил комментарий
    comment TEXT NOT NULL, -- Текст комментария
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Дата и время создания комментария
); 
CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_task_comments_user_id ON task_comments(user_id);


-- хранения вложений к Глобальным задачам (например, изображений и текстовых файлов).
CREATE TABLE task_attachments_global_tasks (
  id SERIAL PRIMARY KEY,
  task_id INT NOT NULL REFERENCES global_tasks(id) ON DELETE CASCADE,
  file_url VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  uploaded_by INT REFERENCES users(id),
  comment_file TEXT,
  name_file VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- хранения вложений к задачам (например, изображений и текстовых файлов).
    CREATE TABLE task_attachments (
        id SERIAL PRIMARY KEY, -- Уникальный идентификатор вложения
        task_id INT REFERENCES tasks(id) ON DELETE CASCADE, -- Идентификатор задачи, к которой относится вложение
        file_url VARCHAR(255) NOT NULL, -- URL-адрес размещения файла
        file_type VARCHAR(50) NOT NULL, -- Тип файла (например, "image/png", "text/plain")
        uploaded_by INT REFERENCES users(id) ON DELETE SET NULL, -- Идентификатор пользователя, который загрузил вложение
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Дата и время загрузки вложения
    );  
    ALTER TABLE task_attachments 
    ADD COLUMN comment_file TEXT,   
    ADD COLUMN name_file VARCHAR(500);   
ALTER TABLE task_attachments
ALTER COLUMN file_type TYPE VARCHAR(500);

CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);

-- Хранение сообщений в чате задач
CREATE TABLE messages_task (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор сообщения
    task_id INT NOT NULL, -- Идентификатор задачи, к которой относится сообщение
    sender_id INT NOT NULL, -- Идентификатор отправителя сообщения
    task_author_id INT NOT NULL, -- Идентификатор автора задачи
    text TEXT NOT NULL, -- Текст сообщения
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Время отправки сообщения
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE, -- Связь с таблицей задач
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE, -- Связь с таблицей пользователей
    FOREIGN KEY (task_author_id) REFERENCES users(id) ON DELETE CASCADE -- Связь с таблицей пользователей (автор задачи)
);
 ALTER TABLE messages_task
ADD COLUMN read_status BOOLEAN DEFAULT FALSE;
CREATE INDEX idx_messages_task_task_id ON messages_task(task_id);
CREATE INDEX idx_messages_task_timestamp ON messages_task(timestamp);
 -- для ссылки на сообщение на которое отвечают 18.06.2025г.
 ALTER TABLE messages_task
ADD COLUMN replied_to_message_id INT NULL,
ADD CONSTRAINT fk_replied_message 
FOREIGN KEY (replied_to_message_id) 
REFERENCES messages_task(id) ON DELETE SET NULL;
    

-- хранения истории изменений задач.
CREATE TABLE task_history (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор записи истории
    task_id INT REFERENCES tasks(id) ON DELETE CASCADE, -- Идентификатор измененной задачи
    changed_by INT REFERENCES users(id) ON DELETE SET NULL, -- Идентификатор пользователя, который внес изменения
    change_description TEXT NOT NULL, -- Описание изменения
    change_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Дата и время изменения
); 
CREATE INDEX idx_task_history_task_id ON task_history(task_id);
CREATE INDEX idx_task_history_changed_by ON task_history(changed_by);


-- отслеживания и отправки уведомлений пользователям о событиях, связанных с задачами
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY, -- Уникальный идентификатор уведомления
    user_id INT REFERENCES users(id) ON DELETE CASCADE, -- Идентификатор пользователя, которому адресовано уведомление
    task_id INT REFERENCES tasks(id) ON DELETE CASCADE, -- Идентификатор связанной задачи
    message TEXT NOT NULL, -- Текст уведомления     
    event_type VARCHAR(50), -- тип уведомления (например, создание задачи, изменение статуса, можно описать тип уведомления(Расчет, возврат) или задачи и т.д.)
    is_read BOOLEAN DEFAULT FALSE, -- Статус прочтения уведомления (True: прочитано, False: нет)
    is_sent BOOLEAN DEFAULT FALSE, -- было ли уведомление уже отправлено пользователям
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Дата и время создания уведомления
); 
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_task_id ON notifications(task_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);

-- Для таблицы tasks: создание индекса по полям global_task_id, created_by и deadline
CREATE INDEX idx_tasks_global_task_id ON tasks(global_task_id);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_deadline ON tasks(deadline); 
-- Для таблицы global_tasks: создание индекса по полю created_by
CREATE INDEX idx_global_tasks_created_by ON global_tasks(created_by);


-- Тэги
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,           -- Уникальный идентификатор тега
  name VARCHAR(255) NOT NULL UNIQUE -- Название тега, уникальное
); 
 
-- FOOTER COMMAND *************************************************************************************************

-- Отзывы о приложении
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,     -- Пользователь
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),         -- звездочки
    feedback TEXT,                                              -- Отзыв комментарий
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),       -- Дата создания
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()        -- Дата обновления
);


-- Обновление приложения - уведомление об этом
CREATE TABLE version_app (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,     -- Пользователь 
    is_approved BOOLEAN DEFAULT FALSE                           -- отметка о прочтении
);
ALTER TABLE version_app
ADD CONSTRAINT unique_user_id UNIQUE (user_id);



-- ************************************************** Рейтинги процессов ********************************************************************

CREATE TABLE reclamation_records ( 
    id SERIAL PRIMARY KEY,  -- Уникальный идентификатор записи (автоинкремент) 
    claim_number VARCHAR(30) NOT NULL UNIQUE,    -- Номер рекламационной заявки (обязательное поле) 
    kontragent VARCHAR(255),  -- Наименование поставщика/контрагента 
    inn VARCHAR(255), -- ИНН контрагента 
    defect TEXT,  -- Подробное описание дефекта/проблемы
    location TEXT,  -- Место обнаружения проблемы 
    claim_date DATE, -- Дата возникновения рекламации (из заявки) 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- [ВАЖНО] Время создания записи в БД (автоматически) 
    sent_at TIMESTAMP,  -- [НОВОЕ] Время отправки уведомления (автоматически) 
    processed BOOLEAN DEFAULT FALSE  -- Статус обработки заявки -- FALSE - новая заявка (по умолчанию)  -- TRUE - уведомление отправлено
);
 
CREATE INDEX idx_reclamation_records_claim_number ON reclamation_records(claim_number); 
CREATE INDEX idx_reclamation_records_unsent ON reclamation_records(processed)
WHERE processed = FALSE;

-- Триггер для автоматического проставления времени отправки
CREATE OR REPLACE FUNCTION set_sent_timestamp()
RETURNS TRIGGER AS $$
BEGIN 
    IF NEW.processed = TRUE AND OLD.processed = FALSE THEN
        NEW.sent_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_sent_time
BEFORE UPDATE ON reclamation_records
FOR EACH ROW
EXECUTE FUNCTION set_sent_timestamp();





-- Таблица для хранения информации о сообщениях с рекламациями
CREATE TABLE IF NOT EXISTS reclamation_messages (
    message_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    request_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (message_id, chat_id)
);

-- Таблица для хранения оценок рекламаций
CREATE TABLE IF NOT EXISTS reclamation_ratings (
    id SERIAL PRIMARY KEY,
    request_number VARCHAR(50) NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    user_name VARCHAR(255),
    comment TEXT,
    rated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (message_id, chat_id) REFERENCES reclamation_messages(message_id, chat_id)
);

-- Индексы для ускорения запросов
CREATE INDEX IF NOT EXISTS idx_reclamation_ratings_request_number ON reclamation_ratings(request_number);
CREATE INDEX IF NOT EXISTS idx_reclamation_ratings_user_id ON reclamation_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_reclamation_ratings_rated_at ON reclamation_ratings(rated_at);



 -- **************************** КОНЕЦ ***********************************************



/*ВРЕМЕННВЕ ИСПРАВЛЕНИЯ**********************************************************************************************/
ALTER TABLE companies DROP CONSTRAINT companies_regional_manager_id_fkey;  -- Удаление старого ограничения
ALTER TABLE companies ADD CONSTRAINT companies_regional_manager_id_fkey 
FOREIGN KEY (regional_manager_id) REFERENCES users(id) ON DELETE CASCADE; -- Создание нового ограничения с каскадным удалением

ALTER TABLE companies DROP CONSTRAINT companies_mpp_id_fkey; -- Удаляем старое ограничение
ALTER TABLE companies ADD CONSTRAINT companies_mpp_id_fkey 
FOREIGN KEY (mpp_id) REFERENCES users(id) ON DELETE CASCADE;  -- Создайте новое ограничение с каскадным удалением

ALTER TABLE companies DROP CONSTRAINT companies_mpr_id_fkey; -- Удалите старое ограничение
ALTER TABLE companies ADD CONSTRAINT companies_mpr_id_fkey 
FOREIGN KEY (mpr_id) REFERENCES users(id) ON DELETE CASCADE; -- Создайте новое с каскадным удалением

ALTER TABLE reminders DROP CONSTRAINT reminders_user_id_fkey; -- Удаление старого ограничения
ALTER TABLE reminders ADD CONSTRAINT reminders_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; -- Создание нового ограничения с каскадным удалением
/*ВРЕМЕННВЕ ИСПРАВЛЕНИЯ**********************************************************************************************/



-- Таблица для хранения метаданных файлов в чате задач
CREATE TABLE IF NOT EXISTS chat_files (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages_task(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    server_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    is_image BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sender_id INTEGER NOT NULL,
    sender_name VARCHAR(255) NOT NULL
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_chat_files_task_id ON chat_files(task_id);
CREATE INDEX IF NOT EXISTS idx_chat_files_message_id ON chat_files(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_files_sender_id ON chat_files(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_files_created_at ON chat_files(created_at);

-- Комментарии к таблице
COMMENT ON TABLE chat_files IS 'Метаданные файлов, отправленных в чате задач';
COMMENT ON COLUMN chat_files.message_id IS 'ID сообщения, к которому прикреплен файл';
COMMENT ON COLUMN chat_files.task_id IS 'ID задачи';
COMMENT ON COLUMN chat_files.original_name IS 'Оригинальное имя файла';
COMMENT ON COLUMN chat_files.server_filename IS 'Имя файла на сервере';
COMMENT ON COLUMN chat_files.file_path IS 'Путь к файлу на сервере';
COMMENT ON COLUMN chat_files.file_size IS 'Размер файла в байтах';
COMMENT ON COLUMN chat_files.file_type IS 'MIME-тип файла';
COMMENT ON COLUMN chat_files.is_image IS 'Флаг, является ли файл изображением';
COMMENT ON COLUMN chat_files.sender_id IS 'ID отправителя файла';
COMMENT ON COLUMN chat_files.sender_name IS 'Имя отправителя файла';
-- Таблица для хранения метаданных файлов в чате задач
CREATE TABLE IF NOT EXISTS chat_files (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages_task(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    server_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    is_image BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sender_id INTEGER NOT NULL,
    sender_name VARCHAR(255) NOT NULL
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_chat_files_task_id ON chat_files(task_id);
CREATE INDEX IF NOT EXISTS idx_chat_files_message_id ON chat_files(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_files_sender_id ON chat_files(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_files_created_at ON chat_files(created_at);


-- Таблица для хранения данных о заказах 1С
CREATE TABLE IF NOT EXISTS orders_1c (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE, -- Номер заказа
    company_name VARCHAR(255) NOT NULL, -- Название компании
    inn VARCHAR(255), -- ИНН компании
    shipping_date DATE NOT NULL, -- Дата отгрузки
    address TEXT, -- Адрес доставки
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Дата создания записи
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Дата обновления записи
    notification_sent BOOLEAN DEFAULT FALSE, -- Статус отправки уведомления дилеру
    notification_sent_at TIMESTAMP, -- Дата отправки уведомления
    dealer_response_received BOOLEAN DEFAULT FALSE, -- Получен ли ответ от дилера
    dealer_response_at TIMESTAMP, -- Дата ответа дилера
    dealer_response_type VARCHAR(20), -- Тип ответа: 'confirm', 'reschedule', 'no_response'
    new_shipping_date DATE, -- Новая дата отгрузки (если перенесена)
    reschedule_reason TEXT, -- Причина переноса даты
    mpp_notified BOOLEAN DEFAULT FALSE, -- Уведомлен ли МПП
    mpp_notified_at TIMESTAMP -- Дата уведомления МПП
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_orders_1c_order_number ON orders_1c(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_1c_inn ON orders_1c(inn);
CREATE INDEX IF NOT EXISTS idx_orders_1c_shipping_date ON orders_1c(shipping_date);
CREATE INDEX IF NOT EXISTS idx_orders_1c_notification_sent ON orders_1c(notification_sent);
CREATE INDEX IF NOT EXISTS idx_orders_1c_dealer_response_received ON orders_1c(dealer_response_received);

-- Триггер для автоматического обновления поля updated_at
CREATE OR REPLACE FUNCTION update_orders_1c_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_1c_updated_at_trigger
BEFORE UPDATE ON orders_1c
FOR EACH ROW EXECUTE FUNCTION update_orders_1c_updated_at();

---------------------------------









-- Таблица целей звонков
CREATE TABLE call_purposes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Вставка базовых целей звонков
INSERT INTO call_purposes (name, description) VALUES
    ('Расчет', 'Вопросы по расчетам и ценообразованию'),
    ('Консультация', 'Общие консультации по продуктам и услугам'),
    ('Рекламация', 'Жалобы и претензии'),
    ('Бухгалтерия', 'Вопросы по бухгалтерским документам'),
    ('Логистика', 'Вопросы по доставке и логистике');

-- Добавление полей в таблицу calls для цели звонка и описания
ALTER TABLE calls 
ADD COLUMN purpose_id INTEGER REFERENCES call_purposes(id),
ADD COLUMN description TEXT,
ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

-- Создание индекса для быстрого поиска по цели звонка
CREATE INDEX idx_calls_purpose_id ON calls(purpose_id);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calls_updated_at_trigger
BEFORE UPDATE ON calls
FOR EACH ROW EXECUTE FUNCTION update_calls_updated_at();

-- Добавление поля итога звонка в таблицу calls
ALTER TABLE calls 
ADD COLUMN outcome VARCHAR(50) CHECK (outcome IN ('success', 'failed', 'postponed', 'callback', 'send_info'));

-- Добавление поля для связи с напоминанием
ALTER TABLE calls 
ADD COLUMN reminder_id INTEGER REFERENCES reminders(id);
-- Добавление поля для связи с задачей
ALTER TABLE calls 
ADD COLUMN task_id INTEGER REFERENCES tasks(id);

-- Создание индекса для быстрого поиска по итогу звонка
CREATE INDEX idx_calls_outcome ON calls(outcome);

-- Создание индекса для быстрого поиска по ID напоминания
CREATE INDEX idx_calls_reminder_id ON calls(reminder_id);

-- Комментарии к значениям поля outcome:
-- 'success' - Успешно (цель достигнута, клиент доволен)
-- 'failed' - Неудачно (цель не достигнута, клиент недоволен)
-- 'postponed' - Отложено (вопрос требует дополнительного времени)
-- 'callback' - Перезвонить (нужно связаться позже)
-- 'send_info' - Отправить информацию (требуется отправка документов/информации)

-- Обновление триггера для автоматического обновления updated_at при изменении outcome
-- (триггер уже существует и будет работать автоматически)
 

