-- Итоговые решения по проекту (любой участник может добавить)
CREATE TABLE IF NOT EXISTS global_task_final_solutions (
    id SERIAL PRIMARY KEY,
    global_task_id INT NOT NULL REFERENCES global_tasks(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_global_task_final_solutions_task ON global_task_final_solutions(global_task_id);
