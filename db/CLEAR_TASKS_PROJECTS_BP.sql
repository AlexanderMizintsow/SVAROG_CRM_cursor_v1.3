-- Очистка таблиц от задач, проектов и бизнес-процессов для тестирования.
-- Выполнять на копии БД или когда уверены, что данные не нужны.
-- Порядок: сначала зависимые таблицы, затем tasks и global_tasks.

BEGIN;

-- 1. Снять ссылки на задачи в calls (иначе нельзя удалить tasks)
UPDATE calls SET task_id = NULL WHERE task_id IS NOT NULL;
UPDATE calls SET reminder_id = NULL WHERE reminder_id IN (SELECT id FROM reminders WHERE type_reminders = 'task');

-- 2. Напоминания, привязанные к задачам
DELETE FROM reminders WHERE type_reminders = 'task';

-- 3. Файлы чата (ссылаются на messages_task)
DELETE FROM chat_files;

-- 4. Сообщения в чате задач
DELETE FROM messages_task;

-- 5. Таблицы, ссылающиеся на tasks
DELETE FROM notifications;
DELETE FROM task_history;
DELETE FROM task_comments;
DELETE FROM task_comments_redo;
DELETE FROM task_assignments;
DELETE FROM task_approvals;
DELETE FROM task_visibility;
DELETE FROM task_deadline_extension_requests;
DELETE FROM task_description_history;
DELETE FROM task_attachments;

-- 6. Бизнес-процессы: связи задач с процессами и ожидания шлюзов
DELETE FROM bp_task_process_links;
DELETE FROM bp_gateway_waiting;
DELETE FROM bp_gateway_project_waiting;
DELETE FROM bp_gateway_join_waiting;
DELETE FROM bp_timer_waiting;
DELETE FROM bp_node_execution_log;
DELETE FROM bp_additional_info_requests;
DELETE FROM bp_decision_requests;
DELETE FROM bp_in_app_notifications;
DELETE FROM bp_process_schedules;
DELETE FROM bp_process_instances;
DELETE FROM bp_process_definitions;
DELETE FROM bp_task_templates;

-- 7. Проекты (global_tasks): связанные таблицы
DELETE FROM email_reply_final_solutions;
DELETE FROM project_email_attachments;
DELETE FROM project_sent_emails;
TRUNCATE project_email_response_times;
DELETE FROM global_task_final_solutions;
DELETE FROM global_task_responsibles;
DELETE FROM global_task_chat_messages;
DELETE FROM action_global_task_comment;
DELETE FROM global_task_history;
DELETE FROM task_attachments_global_tasks;

-- 8. Задачи (tasks)
DELETE FROM tasks;

-- 9. Проекты (global_tasks)
DELETE FROM global_tasks;

-- 10. Сброс последовательностей для новых id
SELECT setval(pg_get_serial_sequence('tasks', 'id'), 1);
SELECT setval(pg_get_serial_sequence('global_tasks', 'id'), 1);
SELECT setval(pg_get_serial_sequence('bp_process_definitions', 'id'), 1);
SELECT setval(pg_get_serial_sequence('bp_process_instances', 'id'), 1);

COMMIT;

-- После выполнения в БД не останется задач, проектов и экземпляров БП.
-- Пользователи, отделы, дилеры и прочие справочники не затрагиваются.
