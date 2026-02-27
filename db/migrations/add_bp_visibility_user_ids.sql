-- Кому показывать процесс во вкладке «Опубликованные»: пустой массив = всем
ALTER TABLE bp_process_definitions
  ADD COLUMN IF NOT EXISTS visibility_user_ids JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN bp_process_definitions.visibility_user_ids IS 'Массив user_id: кому показывать в Опубликованных. Пустой или NULL = всем. Администратор всегда видит все процессы.';
