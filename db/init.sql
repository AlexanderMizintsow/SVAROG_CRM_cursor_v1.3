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

-- Поставщики (для выбора при отправке писем из проектов и др.)
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_fio VARCHAR(255),
    phones JSONB DEFAULT '[]',
    emails JSONB DEFAULT '[]',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
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
    requires_approval BOOLEAN DEFAULT false,  -- требуется согласование участника
    approval_status VARCHAR(20) DEFAULT NULL,  -- 'approved' | 'rejected' | NULL (ожидает)
    approval_comment TEXT,                    -- комментарий при согласовании/отклонении
    approval_at TIMESTAMP,
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


-- Разрешение почтовых отправлений: не более одного ответственного на проект с правом отправки писем
ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS allow_mail BOOLEAN DEFAULT false;

-- Только один участник на проект может иметь allow_mail = true
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_task_responsibles_one_allow_mail
  ON global_task_responsibles (global_task_id) WHERE allow_mail = true;

COMMENT ON COLUMN global_task_responsibles.allow_mail IS 'Разрешить участнику отправлять почту из карточки проекта (не более одного на проект)';

 
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

-- Аналитика (фаза 1): поля и индексы для отчётов по проектам, задачам, отделам и сотрудникам
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;
ALTER TABLE task_approvals ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP NULL;
CREATE INDEX IF NOT EXISTS idx_global_task_history_created_at ON global_task_history(created_at);
CREATE INDEX IF NOT EXISTS idx_global_task_history_created_by ON global_task_history(created_by);
CREATE INDEX IF NOT EXISTS idx_global_task_history_event_type ON global_task_history(event_type);
CREATE INDEX IF NOT EXISTS idx_task_history_change_timestamp ON task_history(change_timestamp);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_approvals_responded_at ON task_approvals(responded_at) WHERE responded_at IS NOT NULL;

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

CREATE TABLE IF NOT EXISTS global_task_final_solutions (
    id SERIAL PRIMARY KEY,
    global_task_id INT NOT NULL REFERENCES global_tasks(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    author_display_name TEXT,
    is_from_supplier_reply BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_global_task_final_solutions_task ON global_task_final_solutions(global_task_id);

-- Связь исходящих писем из проекта с Message-Id для сопоставления ответов
CREATE TABLE IF NOT EXISTS project_sent_emails (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(512) NOT NULL UNIQUE,
    global_task_id INT NOT NULL REFERENCES global_tasks(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_sent_emails_message_id ON project_sent_emails(message_id);
CREATE INDEX IF NOT EXISTS idx_project_sent_emails_global_task ON project_sent_emails(global_task_id);

-- Идемпотентность: один ответ по почте = одна запись итогового решения (по message_id ответа)
CREATE TABLE IF NOT EXISTS email_reply_final_solutions (
    reply_message_id VARCHAR(512) PRIMARY KEY,
    final_solution_id INT NOT NULL REFERENCES global_task_final_solutions(id) ON DELETE CASCADE
);

-- Для существующих БД: добавить колонки в global_task_final_solutions, если их ещё нет
ALTER TABLE global_task_final_solutions ADD COLUMN IF NOT EXISTS author_display_name TEXT;
ALTER TABLE global_task_final_solutions ADD COLUMN IF NOT EXISTS is_from_supplier_reply BOOLEAN DEFAULT false;
ALTER TABLE global_task_final_solutions ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE global_task_final_solutions ADD COLUMN IF NOT EXISTS thread_messages JSONB DEFAULT NULL;
ALTER TABLE project_sent_emails ADD COLUMN IF NOT EXISTS final_solution_id INT REFERENCES global_task_final_solutions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_project_sent_emails_final_solution ON project_sent_emails(final_solution_id);

CREATE TABLE IF NOT EXISTS project_email_attachments (
  id SERIAL PRIMARY KEY,
  final_solution_id INT NOT NULL REFERENCES global_task_final_solutions(id) ON DELETE CASCADE,
  message_index INT NOT NULL,
  filename VARCHAR(500) NOT NULL,
  content_type VARCHAR(255) DEFAULT 'application/octet-stream',
  file_path VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_email_attachments_solution ON project_email_attachments(final_solution_id);

-- Время ответа на письмо по проекту (для аналитики «Почта»: ожидание ответа по автору и отделу)
CREATE TABLE IF NOT EXISTS project_email_response_times (
  sent_message_id VARCHAR(512) PRIMARY KEY,
  reply_received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_email_response_times_reply_at ON project_email_response_times(reply_received_at);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_task_id ON notifications(task_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);

-- Для таблицы tasks: создание индекса по полям global_task_id, created_by и deadline
CREATE INDEX idx_tasks_global_task_id ON tasks(global_task_id);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_deadline ON tasks(deadline); 
-- Для таблицы global_tasks: создание индекса по полю created_by
CREATE INDEX idx_global_tasks_created_by ON global_tasks(created_by);

ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;
ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT NULL;
ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS approval_comment TEXT;
ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS approval_at TIMESTAMP;


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
 

-- ************************************************** EDITOR HANDLE - РЕДАКТОР РУЧЕК **************************************************

-- Типы створок (дверь, окно, офисная дверь, балконная дверь и т.д.)
CREATE TABLE leaf_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Параметры (тип ручки, цвет накладок, цилиндр, ламинация и т.д.)
CREATE TABLE parameters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_multiple BOOLEAN DEFAULT FALSE, -- можно ли выбирать несколько значений
    use_categories BOOLEAN DEFAULT FALSE, -- использовать категории для группировки значений (например, для цветов)
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Категории для группировки значений параметров (например, категории цветов: Коричневый, Серый и т.д.)
CREATE TABLE parameter_value_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Значения параметров (например, "Античная сосна", "RAL 8019" и т.д.)
CREATE TABLE parameter_values (
    id SERIAL PRIMARY KEY,
    parameter_id INTEGER REFERENCES parameters(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,
    display_order INTEGER DEFAULT 0,
    category_id INTEGER REFERENCES parameter_value_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(parameter_id, value)
);

-- Ручки
CREATE TABLE handles (
    id SERIAL PRIMARY KEY,
    article VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Правила выбора ручек
CREATE TABLE handle_rules (
    id SERIAL PRIMARY KEY,
    handle_id INTEGER REFERENCES handles(id) ON DELETE CASCADE,
    leaf_type_id INTEGER REFERENCES leaf_types(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1, -- количество ручек для данного правила
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Условия правил (связь параметров и их значений с правилами)
-- Если parameter_value_id NULL, то правило подходит для любого значения этого параметра
CREATE TABLE handle_rule_conditions (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES handle_rules(id) ON DELETE CASCADE,
    parameter_id INTEGER REFERENCES parameters(id) ON DELETE CASCADE,
    parameter_value_id INTEGER REFERENCES parameter_values(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(rule_id, parameter_id, parameter_value_id)
);

-- История изменений
CREATE TABLE handle_history (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'handle', 'parameter', 'rule', 'leaf_type'
    entity_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted'
    old_data JSONB,
    new_data JSONB,
    changed_by INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Шаблоны створок для визуализации
CREATE TABLE leaf_templates (
    id SERIAL PRIMARY KEY,
    leaf_type_id INTEGER REFERENCES leaf_types(id) ON DELETE CASCADE,
    default_width INTEGER DEFAULT 970, -- ширина в мм
    default_height INTEGER DEFAULT 1990, -- высота в мм
    handle_position_x INTEGER DEFAULT 30, -- позиция ручки по X (в процентах от ширины)
    handle_position_y INTEGER DEFAULT 33, -- позиция ручки по Y (в процентах от высоты)
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Триггеры для обновления updated_at
CREATE OR REPLACE FUNCTION update_leaf_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leaf_types_updated_at_trigger
BEFORE UPDATE ON leaf_types
FOR EACH ROW EXECUTE FUNCTION update_leaf_types_updated_at();

CREATE OR REPLACE FUNCTION update_parameters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_parameters_updated_at_trigger
BEFORE UPDATE ON parameters
FOR EACH ROW EXECUTE FUNCTION update_parameters_updated_at();

CREATE OR REPLACE FUNCTION update_parameter_values_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_parameter_values_updated_at_trigger
BEFORE UPDATE ON parameter_values
FOR EACH ROW EXECUTE FUNCTION update_parameter_values_updated_at();

CREATE OR REPLACE FUNCTION update_handles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_handles_updated_at_trigger
BEFORE UPDATE ON handles
FOR EACH ROW EXECUTE FUNCTION update_handles_updated_at();

CREATE OR REPLACE FUNCTION update_handle_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_handle_rules_updated_at_trigger
BEFORE UPDATE ON handle_rules
FOR EACH ROW EXECUTE FUNCTION update_handle_rules_updated_at();

CREATE OR REPLACE FUNCTION update_leaf_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leaf_templates_updated_at_trigger
BEFORE UPDATE ON leaf_templates
FOR EACH ROW EXECUTE FUNCTION update_leaf_templates_updated_at();

-- Индексы для оптимизации
CREATE INDEX idx_parameter_values_parameter_id ON parameter_values(parameter_id);
CREATE INDEX idx_parameter_values_category_id ON parameter_values(category_id);
CREATE INDEX idx_parameter_value_categories_name ON parameter_value_categories(name);
CREATE INDEX idx_handle_rules_handle_id ON handle_rules(handle_id);
CREATE INDEX idx_handle_rules_leaf_type_id ON handle_rules(leaf_type_id);
CREATE INDEX idx_handle_rule_conditions_rule_id ON handle_rule_conditions(rule_id);
CREATE INDEX idx_handle_rule_conditions_parameter_id ON handle_rule_conditions(parameter_id);
CREATE INDEX idx_handle_history_entity ON handle_history(entity_type, entity_id);
CREATE INDEX idx_leaf_templates_leaf_type_id ON leaf_templates(leaf_type_id);

-- Вставка начальных данных
INSERT INTO leaf_types (name, description) VALUES
    ('Дверь', 'Межкомнатная или входная дверь'),
    ('Окно', 'Оконная створка'),
    ('Офисная дверь', 'Дверь для офисных помещений'),
    ('Балконная дверь', 'Дверь на балкон'),
    ('Окно 25ДМ', 'Оконная створка типа 25ДМ')
ON CONFLICT (name) DO NOTHING;

-- Таблица для определения пользователей, которые могут подтверждать эталонность
CREATE TABLE handle_approval_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    created_by INTEGER, -- Кто добавил пользователя (администратор)
    UNIQUE(user_id)
);

-- Таблица прав доступа к редактору ручек для конкретных пользователей
-- Если can_edit = true, пользователь имеет все права редактирования (кроме управления пользователями и восстановления из снапшота)
CREATE TABLE handle_editor_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_edit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Кто выдал права (администратор)
    UNIQUE(user_id)
);

-- Триггер для обновления updated_at в handle_editor_permissions
CREATE OR REPLACE FUNCTION update_handle_editor_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_handle_editor_permissions_updated_at_trigger
BEFORE UPDATE ON handle_editor_permissions
FOR EACH ROW EXECUTE FUNCTION update_handle_editor_permissions_updated_at();

-- Индекс для handle_editor_permissions
CREATE INDEX idx_handle_editor_permissions_user_id ON handle_editor_permissions(user_id);

-- Таблица подтверждений эталонности данных
CREATE TABLE handle_approvals (
    id SERIAL PRIMARY KEY,
    approved_by INTEGER,
    approved_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    snapshot_date DATE NOT NULL, -- Дата, на которую была подтверждена эталонность
    is_current BOOLEAN DEFAULT TRUE, -- Текущее подтверждение
    UNIQUE(approved_by, snapshot_date)
);

-- Таблица снапшотов данных (для отката)
CREATE TABLE handle_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    description TEXT,
    created_by INTEGER,
    is_approved BOOLEAN DEFAULT FALSE, -- Был ли эталон подтвержден на момент создания снапшота
    -- Снапшот данных хранится в JSON
    leaf_types_data JSONB,
    parameters_data JSONB,
    parameter_values_data JSONB,
    handles_data JSONB,
    handle_rules_data JSONB,
    handle_rule_conditions_data JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Добавляем внешние ключи после создания всех таблиц
-- ВАЖНО: Эти команды выполняются после создания всех таблиц, включая users и roles
-- Используем DO блок для безопасного добавления ограничений
DO $$
BEGIN
    -- Проверяем существование таблицы users перед добавлением внешних ключей
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        -- Добавляем внешний ключ для handle_history
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'fk_handle_history_changed_by'
        ) THEN
            ALTER TABLE handle_history 
            ADD CONSTRAINT fk_handle_history_changed_by 
            FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL;
        END IF;

        -- Добавляем внешний ключ для handle_approvals
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'fk_handle_approvals_approved_by'
        ) THEN
            ALTER TABLE handle_approvals 
            ADD CONSTRAINT fk_handle_approvals_approved_by 
            FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
        END IF;

        -- Добавляем внешний ключ для handle_snapshots
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'fk_handle_snapshots_created_by'
        ) THEN
            ALTER TABLE handle_snapshots 
            ADD CONSTRAINT fk_handle_snapshots_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
        END IF;

        -- Добавляем внешние ключи для handle_approval_users
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'fk_handle_approval_users_user_id'
        ) THEN
            ALTER TABLE handle_approval_users 
            ADD CONSTRAINT fk_handle_approval_users_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'fk_handle_approval_users_created_by'
        ) THEN
            ALTER TABLE handle_approval_users 
            ADD CONSTRAINT fk_handle_approval_users_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Индексы
CREATE INDEX idx_handle_approvals_snapshot_date ON handle_approvals(snapshot_date);
CREATE INDEX idx_handle_approvals_is_current ON handle_approvals(is_current);
CREATE INDEX idx_handle_snapshots_snapshot_date ON handle_snapshots(snapshot_date);

-- Создание параметров "Внешнее покрытие" и "Внутреннее покрытие" и добавление значений
-- Сначала создаем параметры (если их еще нет)
INSERT INTO parameters (name, description, is_multiple, created_at, updated_at)
VALUES 
    ('Внешнее покрытие изделия', 'Внешний цвет окна', true, NOW(), NOW()),
    ('Внутреннее покрытие изделия', 'Внутренний цвет окна', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Получаем ID созданных параметров и вставляем значения
-- Значения отсортированы по алфавиту по наименованию
DO $$
DECLARE
    vneshniy_id INTEGER;
    vnutrenniy_id INTEGER;
BEGIN
    SELECT id INTO vneshniy_id FROM parameters WHERE name = 'Внешнее покрытие изделия';
    SELECT id INTO vnutrenniy_id FROM parameters WHERE name = 'Внутреннее покрытие изделия';
    
    -- Вставляем значения для параметра "Внешнее покрытие" (в алфавитном порядке)
    INSERT INTO parameter_values (parameter_id, value, display_order, created_at, updated_at)
    VALUES
        (vneshniy_id, 'Античная Сосна В2302 x46', 1, NOW(), NOW()),
        (vneshniy_id, 'Антрацит Ульти-мат KDB 76-6H x82', 2, NOW(), NOW()),
        (vneshniy_id, 'Антрацитово серый брашированный KDB74-34 x24', 3, NOW(), NOW()),
        (vneshniy_id, 'Антрацитово серый гладкий KDB74-F7(стандарт) x42', 4, NOW(), NOW()),
        (vneshniy_id, 'Африканская вишня US601 x70', 5, NOW(), NOW()),
        (vneshniy_id, 'Базальтово серый KAEX9-Z8 x29', 6, NOW(), NOW()),
        (vneshniy_id, 'Белый брашированный WAQ50-34 x77', 7, NOW(), NOW()),
        (vneshniy_id, 'Блэк ульти-мат KDG62-6H x47', 8, NOW(), NOW()),
        (vneshniy_id, 'Брашированный Золотой дуб UK117-34 x51', 9, NOW(), NOW()),
        (vneshniy_id, 'Брашированный шоколадный KDB75-34(стандарт) x50', 10, NOW(), NOW()),
        (vneshniy_id, 'Бургундия UJ401 x65', 11, NOW(), NOW()),
        (vneshniy_id, 'Винтажная сосна B2303-G7 x32', 12, NOW(), NOW()),
        (vneshniy_id, 'Виндзор YEQ31-4K x74', 13, NOW(), NOW()),
        (vneshniy_id, 'Глубокий черный KDG62(стандарт) x39', 14, NOW(), NOW()),
        (vneshniy_id, 'Горная сосна UR916 x12', 15, NOW(), NOW()),
        (vneshniy_id, 'Дуб антик Z1402 x69', 16, NOW(), NOW()),
        (vneshniy_id, 'Дуб Камарг UF711 x89', 17, NOW(), NOW()),
        (vneshniy_id, 'Дуб шамони G3001 x56', 18, NOW(), NOW()),
        (vneshniy_id, 'Дуб Шефилд Светлый GF402-5F x44', 19, NOW(), NOW()),
        (vneshniy_id, 'Дуб шефилд серый GF401-5F x81', 20, NOW(), NOW()),
        (vneshniy_id, 'Золотой дуб UK117(стандарт) x1', 21, NOW(), NOW()),
        (vneshniy_id, 'Кадет Серый D3202 x55', 22, NOW(), NOW()),
        (vneshniy_id, 'Какао NDY05-Z8 x73', 23, NOW(), NOW()),
        (vneshniy_id, 'Кварцевый серый KACV8 x83', 24, NOW(), NOW()),
        (vneshniy_id, 'Коричневый дуб UQ901(стандарт) x4', 25, NOW(), NOW()),
        (vneshniy_id, 'Коричневый каштан NDT46 x22', 26, NOW(), NOW()),
        (vneshniy_id, 'Коричневый мортар KDB75-6F x88', 27, NOW(), NOW()),
        (vneshniy_id, 'Кремовый YEL88 x80', 28, NOW(), NOW()),
        (vneshniy_id, 'Кристально-белый WAQ50 x75', 29, NOW(), NOW()),
        (vneshniy_id, 'Махагон UJ301(стандарт) x2', 30, NOW(), NOW()),
        (vneshniy_id, 'Мерцающий антрацит KDG14-69 x48', 31, NOW(), NOW()),
        (vneshniy_id, 'Мерцающий черный KDG 62-69 x40', 32, NOW(), NOW()),
        (vneshniy_id, 'Мореная сосна B2304-G7 x27', 33, NOW(), NOW()),
        (vneshniy_id, 'Мореный дуб UR401(стандарт) x3', 34, NOW(), NOW()),
        (vneshniy_id, 'Натуральный дуб UR001 x8', 35, NOW(), NOW()),
        (vneshniy_id, 'Орех UK103(стандарт) x5', 36, NOW(), NOW()),
        (vneshniy_id, 'Полосатая сосна G0502 x87', 37, NOW(), NOW()),
        (vneshniy_id, 'Польская сосна G4301 x60', 38, NOW(), NOW()),
        (vneshniy_id, 'Сапели UR601 x71', 39, NOW(), NOW()),
        (vneshniy_id, 'Светлый дуб UF711 x76', 40, NOW(), NOW()),
        (vneshniy_id, 'Серебрянное облако DJ 606 x72', 41, NOW(), NOW()),
        (vneshniy_id, 'Сигнальный серый KAGF3-F7 x52', 42, NOW(), NOW()),
        (vneshniy_id, 'Сиена Светлая UR102 x37', 43, NOW(), NOW()),
        (vneshniy_id, 'Старинный дуб US805-U4 x85', 44, NOW(), NOW()),
        (vneshniy_id, 'Темно зеленый GAP45-28 x84', 45, NOW(), NOW()),
        (vneshniy_id, 'Темно-зеленый GAP45-Z8 x79', 46, NOW(), NOW()),
        (vneshniy_id, 'Темно-синий BES89 x57', 47, NOW(), NOW()),
        (vneshniy_id, 'Темный дуб G1501(стандарт) x9', 48, NOW(), NOW()),
        (vneshniy_id, 'Темный тик US906 x67', 49, NOW(), NOW()),
        (vneshniy_id, 'Угольно-коричневый KDB75(стандарт) x6', 50, NOW(), NOW()),
        (vneshniy_id, 'Угольный серый KDB74(стандарт) x21', 51, NOW(), NOW()),
        (vneshniy_id, 'Черно-коричневый KDD17 x16', 52, NOW(), NOW()),
        (vneshniy_id, 'Шоколадная сосна UR907 x66', 53, NOW(), NOW()),
        (vneshniy_id, 'Южный дуб UQ902 x13', 54, NOW(), NOW()),
        (vneshniy_id, 'Ясень полярный G8101-G7 x86', 55, NOW(), NOW())
    ON CONFLICT (parameter_id, value) DO NOTHING;
    
    -- Вставляем значения для параметра "Внутреннее покрытие" (в алфавитном порядке)
    INSERT INTO parameter_values (parameter_id, value, display_order, created_at, updated_at)
    VALUES
        (vnutrenniy_id, 'Античная Сосна В2302 x46', 1, NOW(), NOW()),
        (vnutrenniy_id, 'Антрацит Ульти-мат KDB 76-6H x82', 2, NOW(), NOW()),
        (vnutrenniy_id, 'Антрацитово серый брашированный KDB74-34 x24', 3, NOW(), NOW()),
        (vnutrenniy_id, 'Антрацитово серый гладкий KDB74-F7(стандарт) x42', 4, NOW(), NOW()),
        (vnutrenniy_id, 'Африканская вишня US601 x70', 5, NOW(), NOW()),
        (vnutrenniy_id, 'Базальтово серый KAEX9-Z8 x29', 6, NOW(), NOW()),
        (vnutrenniy_id, 'Белый брашированный WAQ50-34 x77', 7, NOW(), NOW()),
        (vnutrenniy_id, 'Блэк ульти-мат KDG62-6H x47', 8, NOW(), NOW()),
        (vnutrenniy_id, 'Брашированный Золотой дуб UK117-34 x51', 9, NOW(), NOW()),
        (vnutrenniy_id, 'Брашированный шоколадный KDB75-34(стандарт) x50', 10, NOW(), NOW()),
        (vnutrenniy_id, 'Бургундия UJ401 x65', 11, NOW(), NOW()),
        (vnutrenniy_id, 'Винтажная сосна B2303-G7 x32', 12, NOW(), NOW()),
        (vnutrenniy_id, 'Виндзор YEQ31-4K x74', 13, NOW(), NOW()),
        (vnutrenniy_id, 'Глубокий черный KDG62(стандарт) x39', 14, NOW(), NOW()),
        (vnutrenniy_id, 'Горная сосна UR916 x12', 15, NOW(), NOW()),
        (vnutrenniy_id, 'Дуб антик Z1402 x69', 16, NOW(), NOW()),
        (vnutrenniy_id, 'Дуб Камарг UF711 x89', 17, NOW(), NOW()),
        (vnutrenniy_id, 'Дуб шамони G3001 x56', 18, NOW(), NOW()),
        (vnutrenniy_id, 'Дуб Шефилд Светлый GF402-5F x44', 19, NOW(), NOW()),
        (vnutrenniy_id, 'Дуб шефилд серый GF401-5F x81', 20, NOW(), NOW()),
        (vnutrenniy_id, 'Золотой дуб UK117(стандарт) x1', 21, NOW(), NOW()),
        (vnutrenniy_id, 'Кадет Серый D3202 x55', 22, NOW(), NOW()),
        (vnutrenniy_id, 'Какао NDY05-Z8 x73', 23, NOW(), NOW()),
        (vnutrenniy_id, 'Кварцевый серый KACV8 x83', 24, NOW(), NOW()),
        (vnutrenniy_id, 'Коричневый дуб UQ901(стандарт) x4', 25, NOW(), NOW()),
        (vnutrenniy_id, 'Коричневый каштан NDT46 x22', 26, NOW(), NOW()),
        (vnutrenniy_id, 'Коричневый мортар KDB75-6F x88', 27, NOW(), NOW()),
        (vnutrenniy_id, 'Кремовый YEL88 x80', 28, NOW(), NOW()),
        (vnutrenniy_id, 'Кристально-белый WAQ50 x75', 29, NOW(), NOW()),
        (vnutrenniy_id, 'Махагон UJ301(стандарт) x2', 30, NOW(), NOW()),
        (vnutrenniy_id, 'Мерцающий антрацит KDG14-69 x48', 31, NOW(), NOW()),
        (vnutrenniy_id, 'Мерцающий черный KDG 62-69 x40', 32, NOW(), NOW()),
        (vnutrenniy_id, 'Мореная сосна B2304-G7 x27', 33, NOW(), NOW()),
        (vnutrenniy_id, 'Мореный дуб UR401(стандарт) x3', 34, NOW(), NOW()),
        (vnutrenniy_id, 'Натуральный дуб UR001 x8', 35, NOW(), NOW()),
        (vnutrenniy_id, 'Орех UK103(стандарт) x5', 36, NOW(), NOW()),
        (vnutrenniy_id, 'Полосатая сосна G0502 x87', 37, NOW(), NOW()),
        (vnutrenniy_id, 'Польская сосна G4301 x60', 38, NOW(), NOW()),
        (vnutrenniy_id, 'Сапели UR601 x71', 39, NOW(), NOW()),
        (vnutrenniy_id, 'Светлый дуб UF711 x76', 40, NOW(), NOW()),
        (vnutrenniy_id, 'Серебрянное облако DJ 606 x72', 41, NOW(), NOW()),
        (vnutrenniy_id, 'Сигнальный серый KAGF3-F7 x52', 42, NOW(), NOW()),
        (vnutrenniy_id, 'Сиена Светлая UR102 x37', 43, NOW(), NOW()),
        (vnutrenniy_id, 'Старинный дуб US805-U4 x85', 44, NOW(), NOW()),
        (vnutrenniy_id, 'Темно зеленый GAP45-28 x84', 45, NOW(), NOW()),
        (vnutrenniy_id, 'Темно-зеленый GAP45-Z8 x79', 46, NOW(), NOW()),
        (vnutrenniy_id, 'Темно-синий BES89 x57', 47, NOW(), NOW()),
        (vnutrenniy_id, 'Темный дуб G1501(стандарт) x9', 48, NOW(), NOW()),
        (vnutrenniy_id, 'Темный тик US906 x67', 49, NOW(), NOW()),
        (vnutrenniy_id, 'Угольно-коричневый KDB75(стандарт) x6', 50, NOW(), NOW()),
        (vnutrenniy_id, 'Угольный серый KDB74(стандарт) x21', 51, NOW(), NOW()),
        (vnutrenniy_id, 'Черно-коричневый KDD17 x16', 52, NOW(), NOW()),
        (vnutrenniy_id, 'Шоколадная сосна UR907 x66', 53, NOW(), NOW()),
        (vnutrenniy_id, 'Южный дуб UQ902 x13', 54, NOW(), NOW()),
        (vnutrenniy_id, 'Ясень полярный G8101-G7 x86', 55, NOW(), NOW())
    ON CONFLICT (parameter_id, value) DO NOTHING;
END $$;


-- ************************************************** КОНЕЦ EDITOR HANDLE **************************************************

-- ===================================================================
-- АВТОМАТИЗАЦИЯ МАРКЕТИНГА - Структура базы данных
-- ===================================================================
-- Файл содержит все таблицы, индексы и триггеры для компонента
-- "Автоматизация маркетинга"
-- ===================================================================

-- ===================================================================
-- 1. КАТЕГОРИИ ИНФОРМАЦИИ
-- ===================================================================

-- Категории информации (Акции, Техническая информация и т.д.)
CREATE TABLE marketing_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50), -- эмодзи для бота
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Комментарии к таблице
COMMENT ON TABLE marketing_categories IS 'Категории маркетинговой информации (Акции, Техническая информация и т.д.)';
COMMENT ON COLUMN marketing_categories.icon IS 'Эмодзи для отображения в Telegram-боте';

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_marketing_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketing_categories_updated_at_trigger
BEFORE UPDATE ON marketing_categories
FOR EACH ROW EXECUTE FUNCTION update_marketing_categories_updated_at();

-- Индексы
CREATE INDEX idx_marketing_categories_display_order ON marketing_categories(display_order);

-- ===================================================================
-- 2. СПРАВОЧНИКИ
-- ===================================================================

-- Справочник локаций (городов)
CREATE TABLE marketing_locations (
    id SERIAL PRIMARY KEY,
    city VARCHAR(255) NOT NULL UNIQUE,
    region VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketing_locations IS 'Справочник локаций (городов) для фильтрации дилеров';

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_marketing_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketing_locations_updated_at_trigger
BEFORE UPDATE ON marketing_locations
FOR EACH ROW EXECUTE FUNCTION update_marketing_locations_updated_at();

-- Индексы
CREATE INDEX idx_marketing_locations_city ON marketing_locations(city);
CREATE INDEX idx_marketing_locations_region ON marketing_locations(region);

-- Справочник тегов
CREATE TABLE marketing_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    color VARCHAR(7), -- hex цвет для отображения
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketing_tags IS 'Справочник тегов для маркетинговых кампаний';

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_marketing_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketing_tags_updated_at_trigger
BEFORE UPDATE ON marketing_tags
FOR EACH ROW EXECUTE FUNCTION update_marketing_tags_updated_at();

-- Индексы
CREATE INDEX idx_marketing_tags_name ON marketing_tags(name);

-- ===================================================================
-- 3. МАРКЕТИНГОВЫЕ КАМПАНИИ (ИНФОРМАЦИЯ)
-- ===================================================================

-- Маркетинговые кампании (акции, сообщения)
CREATE TABLE marketing_campaigns (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES marketing_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- HTML/Markdown
    status VARCHAR(20) CHECK (status IN ('draft', 'active', 'inactive')) DEFAULT 'draft',
    period_type VARCHAR(20) CHECK (period_type IN ('unlimited', 'date', 'period')) DEFAULT 'unlimited',
    send_date DATE, -- если period_type = 'date'
    period_start TIMESTAMP WITHOUT TIME ZONE, -- если period_type = 'period'
    period_end TIMESTAMP WITHOUT TIME ZONE, -- если period_type = 'period'
    auto_send BOOLEAN DEFAULT FALSE,
    send_time TIME DEFAULT '08:00:00', -- время автоматической отправки (нельзя менять пользователю)
    blocking_period_days INTEGER DEFAULT 30, -- период блокировки дублирования (можно менять)
    contact_person_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    show_contact_person BOOLEAN DEFAULT FALSE,
    notes TEXT, -- служебные заметки
    delivery_channels JSONB DEFAULT '["telegram"]'::jsonb, -- массив каналов
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketing_campaigns IS 'Маркетинговые кампании (акции, сообщения для дилеров)';
COMMENT ON COLUMN marketing_campaigns.send_time IS 'Время автоматической отправки (фиксированное: 08:00)';
COMMENT ON COLUMN marketing_campaigns.blocking_period_days IS 'Период блокировки дублирования отправок (дни)';
COMMENT ON COLUMN marketing_campaigns.delivery_channels IS 'Массив каналов доставки: ["telegram", "email", "sms"]';

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_marketing_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketing_campaigns_updated_at_trigger
BEFORE UPDATE ON marketing_campaigns
FOR EACH ROW EXECUTE FUNCTION update_marketing_campaigns_updated_at();

-- Индексы
CREATE INDEX idx_marketing_campaigns_category_id ON marketing_campaigns(category_id);
CREATE INDEX idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX idx_marketing_campaigns_period_type ON marketing_campaigns(period_type);
CREATE INDEX idx_marketing_campaigns_send_date ON marketing_campaigns(send_date);
CREATE INDEX idx_marketing_campaigns_period_start ON marketing_campaigns(period_start);
CREATE INDEX idx_marketing_campaigns_period_end ON marketing_campaigns(period_end);
CREATE INDEX idx_marketing_campaigns_auto_send ON marketing_campaigns(auto_send);
CREATE INDEX idx_marketing_campaigns_created_by ON marketing_campaigns(created_by);
CREATE INDEX idx_marketing_campaigns_created_at ON marketing_campaigns(created_at);

-- Составной индекс для поиска активных кампаний на сегодня
CREATE INDEX idx_marketing_campaigns_active_today ON marketing_campaigns(status, auto_send, send_date, period_start, period_end)
WHERE status = 'active' AND auto_send = TRUE;

-- ===================================================================
-- 4. ИЗОБРАЖЕНИЯ И ВЛОЖЕНИЯ КАМПАНИЙ
-- ===================================================================

-- Изображения кампаний
CREATE TABLE marketing_campaign_images (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketing_campaign_images IS 'Изображения для маркетинговых кампаний';

-- Индексы
CREATE INDEX idx_marketing_campaign_images_campaign_id ON marketing_campaign_images(campaign_id);
CREATE INDEX idx_marketing_campaign_images_display_order ON marketing_campaign_images(display_order);

-- Вложения (документы) кампаний
CREATE TABLE marketing_campaign_attachments (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(255), -- Увеличено с 50 до 255 для длинных MIME-типов
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketing_campaign_attachments IS 'Вложения (документы) для маркетинговых кампаний';

-- Индексы
CREATE INDEX idx_marketing_campaign_attachments_campaign_id ON marketing_campaign_attachments(campaign_id);
CREATE INDEX idx_marketing_campaign_attachments_display_order ON marketing_campaign_attachments(display_order);

-- ===================================================================
-- 5. СВЯЗИ КАМПАНИЙ С ДИЛЕРАМИ, ЛОКАЦИЯМИ И ТЭГАМИ
-- ===================================================================

-- Связь кампаний с компаниями (дилерскими компаниями)
CREATE TABLE marketing_campaign_companies (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, company_id)
);

COMMENT ON TABLE marketing_campaign_companies IS 'Связь маркетинговых кампаний с дилерскими компаниями (если выбраны конкретные компании)';

-- Индексы
CREATE INDEX idx_marketing_campaign_companies_campaign_id ON marketing_campaign_companies(campaign_id);
CREATE INDEX idx_marketing_campaign_companies_company_id ON marketing_campaign_companies(company_id);

-- Связь кампаний с локациями
CREATE TABLE marketing_campaign_locations (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES marketing_locations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, location_id)
);

COMMENT ON TABLE marketing_campaign_locations IS 'Связь маркетинговых кампаний с локациями (городами)';

-- Индексы
CREATE INDEX idx_marketing_campaign_locations_campaign_id ON marketing_campaign_locations(campaign_id);
CREATE INDEX idx_marketing_campaign_locations_location_id ON marketing_campaign_locations(location_id);

-- Связь кампаний с тегами
CREATE TABLE marketing_campaign_tags (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES marketing_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, tag_id)
);

COMMENT ON TABLE marketing_campaign_tags IS 'Связь маркетинговых кампаний с тегами';

-- Индексы
CREATE INDEX idx_marketing_campaign_tags_campaign_id ON marketing_campaign_tags(campaign_id);
CREATE INDEX idx_marketing_campaign_tags_tag_id ON marketing_campaign_tags(tag_id);

-- ===================================================================
-- 6. ЖУРНАЛ ОТПРАВОК
-- ===================================================================

-- Журнал отправок маркетинговых кампаний
CREATE TABLE marketing_send_log (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    sent_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) CHECK (status IN ('sent', 'error', 'no_telegram')) DEFAULT 'sent',
    send_type VARCHAR(20) CHECK (send_type IN ('auto', 'manual')) DEFAULT 'manual',
    error_message TEXT,
    delivery_channel VARCHAR(20) DEFAULT 'telegram',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketing_send_log IS 'Журнал отправок маркетинговых кампаний дилерам';
COMMENT ON COLUMN marketing_send_log.status IS 'Статус отправки: sent - отправлено, error - ошибка, no_telegram - нет регистрации в ТГ';
COMMENT ON COLUMN marketing_send_log.send_type IS 'Тип отправки: auto - автоматическая, manual - ручная';

-- Индексы для быстрого поиска
CREATE INDEX idx_marketing_send_log_campaign_id ON marketing_send_log(campaign_id);
CREATE INDEX idx_marketing_send_log_company_id ON marketing_send_log(company_id);
CREATE INDEX idx_marketing_send_log_sent_at ON marketing_send_log(sent_at);
CREATE INDEX idx_marketing_send_log_status ON marketing_send_log(status);
CREATE INDEX idx_marketing_send_log_send_type ON marketing_send_log(send_type);

-- Составной индекс для проверки дублирования
CREATE INDEX idx_marketing_send_log_duplicate_check ON marketing_send_log(campaign_id, company_id, sent_at);

-- ===================================================================
-- 7. ПРАВА ДОСТУПА К КОМПОНЕНТУ
-- ===================================================================

-- Права доступа к компоненту "Автоматизация маркетинга"
-- Аналогично handle_editor_permissions
CREATE TABLE marketing_editor_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_edit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id)
);

COMMENT ON TABLE marketing_editor_permissions IS 'Права доступа к компоненту "Автоматизация маркетинга" для конкретных пользователей';
COMMENT ON COLUMN marketing_editor_permissions.can_edit IS 'Если true, пользователь имеет все права редактирования (кроме управления пользователями)';

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_marketing_editor_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketing_editor_permissions_updated_at_trigger
BEFORE UPDATE ON marketing_editor_permissions
FOR EACH ROW EXECUTE FUNCTION update_marketing_editor_permissions_updated_at();

-- Индексы
CREATE INDEX idx_marketing_editor_permissions_user_id ON marketing_editor_permissions(user_id);

-- ===================================================================
-- 8. ВСТАВКА НАЧАЛЬНЫХ ДАННЫХ
-- ===================================================================

-- Вставка базовых категорий
INSERT INTO marketing_categories (name, description, icon, display_order) VALUES
    ('Акции', 'Специальные предложения и акции для дилеров', '🎯', 1),
    ('Техническая информация', 'Технические характеристики, инструкции, документация', '📋', 2),
    ('Новости', 'Новости компании и отрасли', '📰', 3),
    ('Обучение', 'Материалы для обучения и повышения квалификации', '📚', 4)
ON CONFLICT (name) DO NOTHING;



-- Удаляем старый CHECK constraint
ALTER TABLE marketing_send_log DROP CONSTRAINT IF EXISTS marketing_send_log_status_check;

-- Добавляем новый CHECK constraint с поддержкой статуса 'skipped'
ALTER TABLE marketing_send_log 
ADD CONSTRAINT marketing_send_log_status_check 
CHECK (status IN ('sent', 'error', 'skipped', 'no_telegram'));

-- Обновляем комментарий
COMMENT ON COLUMN marketing_send_log.status IS 'Статус отправки: sent - отправлено, error - ошибка, skipped - пропущено (блокировка повторной отправки), no_telegram - нет регистрации в ТГ';


-- Миграция: добавление поля original_name для хранения оригинального имени файла
-- Выполнить эту миграцию для поддержки оригинальных имен файлов

-- Добавляем поле original_name в таблицу marketing_campaign_images
ALTER TABLE marketing_campaign_images 
ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);

-- Добавляем поле original_name в таблицу marketing_campaign_attachments
ALTER TABLE marketing_campaign_attachments 
ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);

-- Обновляем комментарии
COMMENT ON COLUMN marketing_campaign_images.original_name IS 'Оригинальное имя файла (без префикса timestamp)';
COMMENT ON COLUMN marketing_campaign_attachments.original_name IS 'Оригинальное имя файла (без префикса timestamp)';




-- =============================================================================
-- ДВИЖОК БИЗНЕС-ПРОЦЕССОВ (BPE) — ЗАПРОСЫ ДЛЯ РУЧНОГО ВЫПОЛНЕНИЯ В БД SVAROG_DB
-- Таблицы users и tasks должны уже существовать.
-- =============================================================================

-- 1. Определения процессов
CREATE TABLE bp_process_definitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scheme JSONB NOT NULL,
  is_draft BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_bp_process_definitions_is_draft ON bp_process_definitions(is_draft);
CREATE INDEX idx_bp_process_definitions_created_by ON bp_process_definitions(created_by);


-- 2. Экземпляры процессов
CREATE TABLE bp_process_instances (
  id SERIAL PRIMARY KEY,
  process_id INT NOT NULL REFERENCES bp_process_definitions(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP,
  initiator_id INT REFERENCES users(id) ON DELETE SET NULL,
  launched_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  current_node_id VARCHAR(100),
  status VARCHAR(30) NOT NULL CHECK (status IN ('running', 'waiting_gateway', 'waiting_timer', 'waiting_user_input', 'waiting_decision', 'waiting_additional_info', 'waiting_join', 'completed', 'failed', 'cancelled')),
  context JSONB DEFAULT '{}',
  error_message TEXT
);

CREATE INDEX idx_bp_process_instances_process_id ON bp_process_instances(process_id);
CREATE INDEX idx_bp_process_instances_status ON bp_process_instances(status);
CREATE INDEX idx_bp_process_instances_initiator_id ON bp_process_instances(initiator_id);
CREATE INDEX idx_bp_process_instances_started_at ON bp_process_instances(started_at);
CREATE INDEX idx_bp_process_instances_waiting_timer ON bp_process_instances(status) WHERE status = 'waiting_timer';

-- Если таблица bp_process_instances уже создана без новых статусов — выполните:
-- ALTER TABLE bp_process_instances DROP CONSTRAINT IF EXISTS bp_process_instances_status_check;
-- ALTER TABLE bp_process_instances ADD CONSTRAINT bp_process_instances_status_check CHECK (status IN ('running', 'waiting_gateway', 'waiting_timer', 'waiting_user_input', 'waiting_decision', 'waiting_additional_info', 'waiting_join', 'completed', 'failed', 'cancelled'));


-- 3. Лог прохода по узлам
CREATE TABLE bp_node_execution_log (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  entered_at TIMESTAMP DEFAULT NOW(),
  exited_at TIMESTAMP,
  outcome VARCHAR(30) CHECK (outcome IN ('success', 'condition_met', 'error', 'timer_scheduled', 'waiting_user_input', 'waiting_decision', 'waiting_additional_info', 'waiting_join')),
  payload JSONB
);

-- Если таблица bp_node_execution_log уже создана без новых outcome — выполните:
-- ALTER TABLE bp_node_execution_log DROP CONSTRAINT IF EXISTS bp_node_execution_log_outcome_check;
-- ALTER TABLE bp_node_execution_log ADD CONSTRAINT bp_node_execution_log_outcome_check CHECK (outcome IN ('success', 'condition_met', 'error', 'timer_scheduled', 'waiting_user_input', 'waiting_decision', 'waiting_additional_info', 'waiting_join'));

CREATE INDEX idx_bp_node_execution_log_instance_id ON bp_node_execution_log(instance_id);
CREATE INDEX idx_bp_node_execution_log_node_id ON bp_node_execution_log(node_id);
CREATE INDEX idx_bp_node_execution_log_entered_at ON bp_node_execution_log(entered_at);


-- 4. Связь задач с процессами
CREATE TABLE bp_task_process_links (
  id SERIAL PRIMARY KEY,
  task_id INT NOT NULL,
  process_instance_id INT NOT NULL REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_task_process_links_task_id ON bp_task_process_links(task_id);
CREATE INDEX idx_bp_task_process_links_instance_id ON bp_task_process_links(process_instance_id);


-- 5. Ожидание таймера
CREATE TABLE bp_timer_waiting (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL UNIQUE REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  resume_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_timer_waiting_resume_at ON bp_timer_waiting(resume_at);


-- 6. Ожидание развилки по задаче
CREATE TABLE bp_gateway_waiting (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  task_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_gateway_waiting_task_id ON bp_gateway_waiting(task_id);
CREATE INDEX idx_bp_gateway_waiting_instance_id ON bp_gateway_waiting(instance_id);


-- 6.1. Ожидание развилки по проекту (global_task)
CREATE TABLE bp_gateway_project_waiting (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  global_task_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_gateway_project_waiting_global_task_id ON bp_gateway_project_waiting(global_task_id);
CREATE INDEX idx_bp_gateway_project_waiting_instance_id ON bp_gateway_project_waiting(instance_id);


-- 6.2. Ожидание развилки «Слияние» (несколько входящих)
CREATE TABLE bp_gateway_join_waiting (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL UNIQUE REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_gateway_join_waiting_instance_id ON bp_gateway_join_waiting(instance_id);


-- 7. Шаблоны задач
CREATE TABLE bp_task_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  priority_default VARCHAR(20) DEFAULT 'низкий',
  tags_default JSONB DEFAULT '[]',
  deadline_offset_days INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_bp_task_templates_is_active ON bp_task_templates(is_active);


-- =============================================================================
-- 8. Связь таблицы tasks (register) с процессами
-- Выполнять после создания bp_process_instances.
-- Если колонка уже есть — первый запрос можно пропустить.
-- =============================================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS business_process_instance_id INT NULL;

-- Если ограничение уже есть — команда выдаст ошибку; тогда выполните только CREATE INDEX.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_bp_instance;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_bp_instance
  FOREIGN KEY (business_process_instance_id) REFERENCES bp_process_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_business_process_instance_id ON tasks(business_process_instance_id);

-- =============================================================================
-- 9. In-app уведомления BPE (для AlertBanner, пометка «БП»)
-- =============================================================================

CREATE TABLE bp_in_app_notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  message TEXT NOT NULL,
  process_instance_id INT REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_in_app_notifications_user_id ON bp_in_app_notifications(user_id);
CREATE INDEX idx_bp_in_app_notifications_is_read ON bp_in_app_notifications(user_id, is_read);
CREATE INDEX idx_bp_in_app_notifications_created_at ON bp_in_app_notifications(created_at);


-- 10. Запросы на принятие решения (блок «Принятие решения»)
CREATE TABLE bp_decision_requests (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  process_name VARCHAR(255),
  message TEXT NOT NULL,
  buttons JSONB NOT NULL DEFAULT '[]',
  initiator_id INT REFERENCES users(id) ON DELETE SET NULL,
  initiator_name VARCHAR(255),
  selected_button_id VARCHAR(100),
  responded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_decision_requests_user_id ON bp_decision_requests(user_id);
CREATE INDEX idx_bp_decision_requests_instance_id ON bp_decision_requests(instance_id);
CREATE INDEX idx_bp_decision_requests_responded_at ON bp_decision_requests(user_id, responded_at);


-- 11. Запросы на заполнение «Доп. информация» (блок «Доп. информация»)
CREATE TABLE bp_additional_info_requests (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  process_name VARCHAR(255),
  prompt_text TEXT NOT NULL,
  required_keys JSONB NOT NULL DEFAULT '[]',
  initiator_id INT REFERENCES users(id) ON DELETE SET NULL,
  initiator_name VARCHAR(255),
  responded_values JSONB,
  responded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_additional_info_requests_user_id ON bp_additional_info_requests(user_id);
CREATE INDEX idx_bp_additional_info_requests_instance_id ON bp_additional_info_requests(instance_id);
CREATE INDEX idx_bp_additional_info_requests_responded_at ON bp_additional_info_requests(user_id, responded_at);


-- Согласование участников проекта: колонки в global_task_responsibles
-- Выполнить один раз для существующей БД (если таблица создана без этих полей).

ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;
ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT NULL;
ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS approval_comment TEXT;
ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS approval_at TIMESTAMP;


-- 12. Расписания автоматического запуска процессов
-- schedule_type: 'dates' | 'weekdays' | 'interval'
-- config: JSONB — для dates: { "dates": ["YYYY-MM-DD", ...] }; для weekdays: { "weekdays": [1,2,3] } (1=Пн..7=Вс); для interval: { "interval_days": 2, "anchor_date": "YYYY-MM-DD" }; общее: "exclude_weekdays": [6,7], "exclude_dates": ["YYYY-MM-DD", ...]
CREATE TABLE bp_process_schedules (
  id SERIAL PRIMARY KEY,
  process_id INT NOT NULL UNIQUE REFERENCES bp_process_definitions(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('dates', 'weekdays', 'interval')),
  time_hour INT NOT NULL CHECK (time_hour >= 0 AND time_hour <= 23),
  time_minute INT NOT NULL CHECK (time_minute >= 0 AND time_minute <= 59),
  config JSONB NOT NULL DEFAULT '{}',
  launched_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  last_triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_process_schedules_process_id ON bp_process_schedules(process_id);
CREATE INDEX idx_bp_process_schedules_enabled ON bp_process_schedules(enabled) WHERE enabled = true;


-- =============================================================================
-- БЕЗОПАСНОЕ УДАЛЕНИЕ: если что-то пошло не так, выполните следующий блок.
-- ВНИМАНИЕ: это удалит все данные и таблицы БП. Задачи (tasks) останутся,
-- но связь business_process_instance_id будет сброшена.
-- Выполняйте по порядку.
-- =============================================================================

-- 1. Удалить FK и колонку в tasks (связь с экземплярами БП)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_bp_instance;
ALTER TABLE tasks DROP COLUMN IF EXISTS business_process_instance_id;

-- 2. Удалить таблицы (порядок важен: сначала зависимые, затем основные)
DROP TABLE IF EXISTS bp_additional_info_requests CASCADE;
DROP TABLE IF EXISTS bp_decision_requests CASCADE;
DROP TABLE IF EXISTS bp_in_app_notifications CASCADE;
DROP TABLE IF EXISTS bp_gateway_join_waiting CASCADE;
DROP TABLE IF EXISTS bp_gateway_project_waiting CASCADE;
DROP TABLE IF EXISTS bp_gateway_waiting CASCADE;
DROP TABLE IF EXISTS bp_timer_waiting CASCADE;
DROP TABLE IF EXISTS bp_task_process_links CASCADE;
DROP TABLE IF EXISTS bp_node_execution_log CASCADE;
DROP TABLE IF EXISTS bp_process_schedules CASCADE;
DROP TABLE IF EXISTS bp_process_instances CASCADE;
DROP TABLE IF EXISTS bp_process_definitions CASCADE;
DROP TABLE IF EXISTS bp_task_templates CASCADE;





-- =============================================================================
-- Компонент идеи и предложения
-- =============================================================================
-- Идеи и предложения пользователей по улучшению приложения
CREATE TABLE IF NOT EXISTS app_ideas (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  file_path VARCHAR(1000) DEFAULT NULL,
  file_name VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_applied BOOLEAN DEFAULT FALSE,
  admin_comment TEXT,
  applied_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_ideas_user_id ON app_ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_app_ideas_created_at ON app_ideas(created_at DESC);


 

-- ===================================================================
-- КОНЕЦ ФАЙЛА
-- ===================================================================
