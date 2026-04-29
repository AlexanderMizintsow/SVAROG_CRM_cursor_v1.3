-- Ветка рекламаций для mobile_app (самостоятельная реализация)

CREATE TABLE IF NOT EXISTS mobile_complaint_drafts (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_no VARCHAR(120) NOT NULL,
  year INTEGER NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  submitted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('active', 'submitted', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_mobile_complaint_drafts_company_status
  ON mobile_complaint_drafts(company_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS mobile_complaint_draft_nodes (
  id BIGSERIAL PRIMARY KEY,
  draft_id BIGINT NOT NULL REFERENCES mobile_complaint_drafts(id) ON DELETE CASCADE,
  item_name VARCHAR(500) NOT NULL,
  part_name VARCHAR(120) NOT NULL,
  reason_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_complaint_draft_nodes_draft_id
  ON mobile_complaint_draft_nodes(draft_id, id);

CREATE TABLE IF NOT EXISTS mobile_complaint_attachments (
  id BIGSERIAL PRIMARY KEY,
  draft_id BIGINT NOT NULL REFERENCES mobile_complaint_drafts(id) ON DELETE CASCADE,
  kind VARCHAR(24) NOT NULL DEFAULT 'document',
  caption TEXT NULL,
  original_name VARCHAR(500) NOT NULL,
  stored_rel_path VARCHAR(600) NOT NULL,
  mime_type VARCHAR(120) NULL,
  file_size BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (kind IN ('photo', 'document'))
);

CREATE INDEX IF NOT EXISTS idx_mobile_complaint_attachments_draft
  ON mobile_complaint_attachments(draft_id, id);

CREATE TABLE IF NOT EXISTS mobile_complaint_closed_claims (
  id BIGSERIAL PRIMARY KEY,
  request_number VARCHAR(120) NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  contractor_name VARCHAR(255) NULL,
  inn VARCHAR(32) NULL,
  defect TEXT NULL,
  location TEXT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_number, company_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_complaint_closed_company
  ON mobile_complaint_closed_claims(company_id, closed_at DESC);

CREATE TABLE IF NOT EXISTS mobile_complaint_ratings (
  id BIGSERIAL PRIMARY KEY,
  request_number VARCHAR(120) NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_number, company_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_complaint_ratings_company
  ON mobile_complaint_ratings(company_id, updated_at DESC);
