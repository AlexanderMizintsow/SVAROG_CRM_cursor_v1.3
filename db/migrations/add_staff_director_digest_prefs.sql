-- Настройки утреннего дайджеста директора (POZ-Staff)
CREATE TABLE IF NOT EXISTS staff_director_digest_prefs (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_on DATE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
