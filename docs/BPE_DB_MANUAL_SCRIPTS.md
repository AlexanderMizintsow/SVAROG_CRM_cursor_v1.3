```sql
-- 1) Определения процессов
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

-- 2) Экземпляры процессов
CREATE TABLE bp_process_instances (
  id SERIAL PRIMARY KEY,
  process_id INT NOT NULL REFERENCES bp_process_definitions(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP,
  initiator_id INT REFERENCES users(id) ON DELETE SET NULL,
  launched_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  current_node_id VARCHAR(100),
  status VARCHAR(30) NOT NULL CHECK (status IN ('running', 'waiting_gateway', 'waiting_timer', 'waiting_user_input', 'completed', 'failed', 'cancelled')),
  context JSONB DEFAULT '{}',
  error_message TEXT
);

CREATE INDEX idx_bp_process_instances_process_id ON bp_process_instances(process_id);
CREATE INDEX idx_bp_process_instances_status ON bp_process_instances(status);
CREATE INDEX idx_bp_process_instances_initiator_id ON bp_process_instances(initiator_id);
CREATE INDEX idx_bp_process_instances_started_at ON bp_process_instances(started_at);
CREATE INDEX idx_bp_process_instances_waiting_timer ON bp_process_instances(status) WHERE status = 'waiting_timer';

-- 3) Лог прохода по узлам
CREATE TABLE bp_node_execution_log (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  entered_at TIMESTAMP DEFAULT NOW(),
  exited_at TIMESTAMP,
  outcome VARCHAR(30) CHECK (outcome IN ('success', 'condition_met', 'error', 'timer_scheduled', 'waiting_user_input', 'waiting_decision', 'waiting_join')),
  payload JSONB
);

CREATE INDEX idx_bp_node_execution_log_instance_id ON bp_node_execution_log(instance_id);
CREATE INDEX idx_bp_node_execution_log_node_id ON bp_node_execution_log(node_id);
CREATE INDEX idx_bp_node_execution_log_entered_at ON bp_node_execution_log(entered_at);

-- 4) Связь задач с процессами
CREATE TABLE bp_task_process_links (
  id SERIAL PRIMARY KEY,
  task_id INT NOT NULL,
  process_instance_id INT NOT NULL REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_task_process_links_task_id ON bp_task_process_links(task_id);
CREATE INDEX idx_bp_task_process_links_instance_id ON bp_task_process_links(process_instance_id);

-- 5) Ожидание таймера
CREATE TABLE bp_timer_waiting (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL UNIQUE REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  resume_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_timer_waiting_resume_at ON bp_timer_waiting(resume_at);

-- 6) Ожидание развилки по задаче
CREATE TABLE bp_gateway_waiting (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  task_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_gateway_waiting_task_id ON bp_gateway_waiting(task_id);
CREATE INDEX idx_bp_gateway_waiting_instance_id ON bp_gateway_waiting(instance_id);

-- 6.1) Ожидание Развилки-Слияния (несколько входящих)
CREATE TABLE bp_gateway_join_waiting (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL UNIQUE REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bp_gateway_join_waiting_instance_id ON bp_gateway_join_waiting(instance_id);

-- 7) Шаблоны задач
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

-- 8) Связь таблицы tasks с процессами
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS business_process_instance_id INT NULL;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_bp_instance;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_bp_instance
  FOREIGN KEY (business_process_instance_id) REFERENCES bp_process_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_business_process_instance_id ON tasks(business_process_instance_id);

-- 9) In-app уведомления (для AlertBanner, пометка «БП»)
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

-- 10) Запросы на принятие решения (блок «Принятие решения»)
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

-- Добавить outcome 'waiting_decision', 'waiting_join' в bp_node_execution_log (если таблица уже создана)
ALTER TABLE bp_node_execution_log DROP CONSTRAINT IF EXISTS bp_node_execution_log_outcome_check;
ALTER TABLE bp_node_execution_log ADD CONSTRAINT bp_node_execution_log_outcome_check
  CHECK (outcome IN ('success', 'condition_met', 'error', 'timer_scheduled', 'waiting_user_input', 'waiting_decision', 'waiting_join'));

-- Добавить статус waiting_decision, waiting_join в bp_process_instances (если таблица уже создана)
ALTER TABLE bp_process_instances DROP CONSTRAINT IF EXISTS bp_process_instances_status_check;
ALTER TABLE bp_process_instances ADD CONSTRAINT bp_process_instances_status_check
  CHECK (status IN ('running', 'waiting_gateway', 'waiting_timer', 'waiting_user_input', 'waiting_decision', 'waiting_join', 'completed', 'failed', 'cancelled'));

-- Миграция: создать таблицу bp_gateway_join_waiting (если её ещё нет)
-- Выполните при ошибке "отношение bp_gateway_join_waiting не существует"
CREATE TABLE IF NOT EXISTS bp_gateway_join_waiting (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL UNIQUE REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bp_gateway_join_waiting_instance_id ON bp_gateway_join_waiting(instance_id);
```