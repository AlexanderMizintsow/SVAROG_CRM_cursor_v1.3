-- Согласования: шаблоны, заявки, шаги, чат и файлы.
-- Карточка не является задачей и не является проектом.

CREATE TABLE IF NOT EXISTS approval_templates (
  id SERIAL PRIMARY KEY,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('official', 'personal')),
  owner_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  hint TEXT DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_templates_owner
  ON approval_templates (owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_templates_scope
  ON approval_templates (scope, is_published);

CREATE TABLE IF NOT EXISTS approval_template_fields (
  id SERIAL PRIMARY KEY,
  template_id INT NOT NULL REFERENCES approval_templates(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  field_key VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'textarea', 'number', 'money', 'date', 'file', 'choice', 'order_ref')),
  required BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS approval_template_steps (
  id SERIAL PRIMARY KEY,
  template_id INT NOT NULL REFERENCES approval_templates(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  step_kind VARCHAR(20) NOT NULL CHECK (step_kind IN ('decision', 'external', 'notice')),
  title VARCHAR(255) NOT NULL,
  assignee_mode VARCHAR(30) NOT NULL DEFAULT 'users',
  assignee_user_ids INT[] NOT NULL DEFAULT '{}',
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  role_name VARCHAR(100),
  position_id INT REFERENCES positions(id) ON DELETE SET NULL,
  quorum VARCHAR(10) NOT NULL DEFAULT 'all',
  deadline_hours INT,
  on_reject VARCHAR(10) NOT NULL DEFAULT 'stop',
  return_to_sort_order INT,
  allow_manual_close BOOLEAN NOT NULL DEFAULT true,
  external_match VARCHAR(10) NOT NULL DEFAULT 'all',
  enter_rule JSONB
);

CREATE TABLE IF NOT EXISTS approval_template_checks (
  id SERIAL PRIMARY KEY,
  template_step_id INT NOT NULL REFERENCES approval_template_steps(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  source VARCHAR(20) NOT NULL DEFAULT 'altawin',
  check_code VARCHAR(64) NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  order_field_key VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS approval_cards (
  id SERIAL PRIMARY KEY,
  template_id INT REFERENCES approval_templates(id) ON DELETE SET NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('official', 'personal', 'free')),
  author_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT DEFAULT '',
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'running', 'approved', 'rejected', 'cancelled')),
  current_step_id INT,
  outcome_text TEXT,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_cards_author
  ON approval_cards (author_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_cards_status
  ON approval_cards (status);

CREATE TABLE IF NOT EXISTS approval_card_fields (
  id SERIAL PRIMARY KEY,
  card_id INT NOT NULL REFERENCES approval_cards(id) ON DELETE CASCADE,
  field_key VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL,
  field_type VARCHAR(20) NOT NULL,
  value_text TEXT,
  value_number NUMERIC,
  value_date DATE,
  value_json JSONB
);

CREATE TABLE IF NOT EXISTS approval_card_steps (
  id SERIAL PRIMARY KEY,
  card_id INT NOT NULL REFERENCES approval_cards(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  step_kind VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  assignee_mode VARCHAR(30) NOT NULL DEFAULT 'users',
  assignee_user_ids INT[] NOT NULL DEFAULT '{}',
  department_id INT,
  role_name VARCHAR(100),
  position_id INT,
  quorum VARCHAR(10) NOT NULL DEFAULT 'all',
  deadline_hours INT,
  on_reject VARCHAR(10) NOT NULL DEFAULT 'stop',
  return_to_sort_order INT,
  allow_manual_close BOOLEAN NOT NULL DEFAULT true,
  external_match VARCHAR(10) NOT NULL DEFAULT 'all',
  enter_rule JSONB,
  checks JSONB NOT NULL DEFAULT '[]',
  order_field_key VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  result VARCHAR(20),
  result_comment TEXT,
  result_payload JSONB,
  acted_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  acted_at TIMESTAMP,
  due_at TIMESTAMP,
  external_snapshot JSONB,
  external_checked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_card_steps_card
  ON approval_card_steps (card_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_approval_card_steps_active
  ON approval_card_steps (status) WHERE status = 'active';

ALTER TABLE approval_cards
  DROP CONSTRAINT IF EXISTS approval_cards_current_step_fk;
ALTER TABLE approval_cards
  ADD CONSTRAINT approval_cards_current_step_fk
  FOREIGN KEY (current_step_id) REFERENCES approval_card_steps(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS approval_card_step_assignees (
  id SERIAL PRIMARY KEY,
  step_id INT NOT NULL REFERENCES approval_card_steps(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_substitute BOOLEAN NOT NULL DEFAULT false,
  decision VARCHAR(20),
  comment TEXT,
  decided_at TIMESTAMP,
  UNIQUE (step_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_assignees_user
  ON approval_card_step_assignees (user_id, decision);

UPDATE approval_template_steps SET step_kind = 'decision' WHERE step_kind IN ('choice', 'options');
UPDATE approval_card_steps
SET step_kind = 'decision',
    result = CASE WHEN result = 'prepared' THEN 'approved' ELSE result END
WHERE step_kind = 'options';
UPDATE approval_card_steps SET step_kind = 'decision' WHERE step_kind = 'choice';

ALTER TABLE approval_template_steps DROP CONSTRAINT IF EXISTS approval_template_steps_step_kind_check;
ALTER TABLE approval_template_steps
  ADD CONSTRAINT approval_template_steps_step_kind_check
  CHECK (step_kind IN ('decision', 'external', 'notice'));

ALTER TABLE approval_card_steps DROP CONSTRAINT IF EXISTS approval_card_steps_step_kind_check;
ALTER TABLE approval_card_steps
  ADD CONSTRAINT approval_card_steps_step_kind_check
  CHECK (step_kind IN ('decision', 'external', 'notice'));

ALTER TABLE approval_card_step_assignees
  ADD COLUMN IF NOT EXISTS covers_user_id INT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE approval_card_steps
  ADD COLUMN IF NOT EXISTS deadline_notified BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS approval_messages (
  id SERIAL PRIMARY KEY,
  card_id INT NOT NULL REFERENCES approval_cards(id) ON DELETE CASCADE,
  author_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_messages_card
  ON approval_messages (card_id, created_at);

CREATE TABLE IF NOT EXISTS approval_files (
  id SERIAL PRIMARY KEY,
  card_id INT NOT NULL REFERENCES approval_cards(id) ON DELETE CASCADE,
  step_id INT REFERENCES approval_card_steps(id) ON DELETE SET NULL,
  message_id INT REFERENCES approval_messages(id) ON DELETE SET NULL,
  uploader_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE approval_files DROP COLUMN IF EXISTS option_id;
DROP TABLE IF EXISTS approval_options;

CREATE TABLE IF NOT EXISTS approval_check_logs (
  id SERIAL PRIMARY KEY,
  card_id INT REFERENCES approval_cards(id) ON DELETE SET NULL,
  step_id INT REFERENCES approval_card_steps(id) ON DELETE SET NULL,
  card_title TEXT,
  step_title TEXT,
  reason TEXT NOT NULL,
  repeat_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_check_logs_updated
  ON approval_check_logs (updated_at DESC);

UPDATE approval_templates t
SET department_id = u.department_id
FROM users u
LEFT JOIN roles r ON r.id = u.role_id
LEFT JOIN positions p ON p.id = u.position_id
WHERE t.owner_user_id = u.id
  AND t.scope = 'official'
  AND t.department_id IS NULL
  AND u.department_id IS NOT NULL
  AND COALESCE(r.name, '') NOT IN ('Администратор', 'Директор')
  AND COALESCE(p.name, '') <> 'Директор'
  AND (
    r.name = 'Руководитель отдела'
    OR EXISTS (SELECT 1 FROM departments d WHERE d.head_user_id = u.id)
  );

ALTER TABLE approval_cards ADD COLUMN IF NOT EXISTS author_done_at TIMESTAMP;
ALTER TABLE approval_cards ADD COLUMN IF NOT EXISTS author_note TEXT;

CREATE TABLE IF NOT EXISTS approval_card_links (
  id SERIAL PRIMARY KEY,
  card_id INT NOT NULL REFERENCES approval_cards(id) ON DELETE CASCADE,
  task_id INT REFERENCES tasks(id) ON DELETE CASCADE,
  global_task_id INT REFERENCES global_tasks(id) ON DELETE CASCADE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT approval_card_links_one_target CHECK (
    (task_id IS NOT NULL AND global_task_id IS NULL)
    OR (task_id IS NULL AND global_task_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_card_links_one_task
  ON approval_card_links (card_id) WHERE task_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_card_links_one_project
  ON approval_card_links (card_id) WHERE global_task_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_card_links_task
  ON approval_card_links (task_id) WHERE task_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_card_links_project
  ON approval_card_links (global_task_id) WHERE global_task_id IS NOT NULL;

ALTER TABLE approval_cards ADD COLUMN IF NOT EXISTS template_title TEXT;

UPDATE approval_cards c
SET template_title = t.title
FROM approval_templates t
WHERE c.template_id = t.id
  AND COALESCE(c.template_title, '') = '';
