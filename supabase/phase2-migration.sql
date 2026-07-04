-- ============================================================
-- Treeelivine — PHASE 2 Migration
-- Contract lifecycle, Resource planning, Profitability inputs,
-- Advanced help desk (SLA/departments/CSAT), Notifications,
-- Team chat, Digital asset management.
-- Idempotent: safe to run repeatedly in the Supabase SQL Editor.
-- Run AFTER schema.sql AND phase1-migration.sql.
-- ============================================================

-- ─────────────────────────────────────────
-- 1. CONTRACT MANAGEMENT (upgrades the Phase-1 contracts table)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_templates (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    TEXT NOT NULL,
  body                    TEXT,
  default_duration_months INTEGER DEFAULT 12,
  default_value           NUMERIC DEFAULT 0,
  created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
  is_demo                 BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS template_id            UUID REFERENCES contract_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_renew             BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_reminder_days  INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS renewed_from_id        UUID REFERENCES contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS public_token           UUID DEFAULT gen_random_uuid(),  -- signing link
  ADD COLUMN IF NOT EXISTS signer_email           TEXT,
  ADD COLUMN IF NOT EXISTS signature_data         TEXT;                            -- base64 signature image

-- widen status lifecycle (keeps legacy 'sent'/'signed' values valid)
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE contracts ADD CONSTRAINT contracts_status_check
  CHECK (status IN ('draft','pending_approval','sent','active','signed','expired','renewed','cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_public_token ON contracts(public_token);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date)
  WHERE status IN ('active','signed');

-- ─────────────────────────────────────────
-- 2. RESOURCE PLANNING
-- ─────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS capacity_hours_week NUMERIC DEFAULT 40;

CREATE TABLE IF NOT EXISTS vacations (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type         TEXT DEFAULT 'vacation' CHECK (type IN ('vacation','sick','unpaid','other')),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  notes        TEXT,
  approved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  is_demo      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_vacations_employee ON vacations(employee_id, start_date);
CREATE INDEX IF NOT EXISTS idx_vacations_window   ON vacations(start_date, end_date) WHERE status = 'approved';

CREATE TABLE IF NOT EXISTS allocations (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  percent        NUMERIC NOT NULL DEFAULT 50 CHECK (percent > 0 AND percent <= 100),
  start_date     DATE NOT NULL,
  end_date       DATE,
  notes          TEXT,
  is_demo        BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_allocations_employee ON allocations(employee_id, start_date);
CREATE INDEX IF NOT EXISTS idx_allocations_project  ON allocations(project_id);

-- ─────────────────────────────────────────
-- 3. PROFITABILITY INPUTS
--    (dashboard itself is computed; this links costs to projects)
-- ─────────────────────────────────────────
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id) WHERE project_id IS NOT NULL;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS hourly_cost NUMERIC;   -- optional override; default derives from salary / capacity

-- ─────────────────────────────────────────
-- 4. ADVANCED HELP DESK
-- ─────────────────────────────────────────
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS department          TEXT DEFAULT 'general'
    CHECK (department IN ('general','design','development','marketing','finance','accounts')),
  ADD COLUMN IF NOT EXISTS first_response_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_to        UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS satisfaction_note   TEXT,
  ADD COLUMN IF NOT EXISTS created_by          UUID REFERENCES users(id) ON DELETE SET NULL;

-- widen status lifecycle
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open','in_progress','waiting_client','escalated','resolved','closed'));

-- SLA targets per priority (minutes)
CREATE TABLE IF NOT EXISTS sla_policies (
  priority               TEXT PRIMARY KEY CHECK (priority IN ('low','medium','high','urgent')),
  first_response_minutes INTEGER NOT NULL,
  resolution_minutes     INTEGER NOT NULL
);

INSERT INTO sla_policies (priority, first_response_minutes, resolution_minutes)
SELECT * FROM (VALUES
  ('low',    1440, 10080),
  ('medium',  480,  4320),
  ('high',    120,  1440),
  ('urgent',   30,   240)
) v(p, f, r)
WHERE NOT EXISTS (SELECT 1 FROM sla_policies);

-- ticket conversation (public replies + internal notes)
CREATE TABLE IF NOT EXISTS ticket_messages (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id    UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name  TEXT,
  body         TEXT NOT NULL,
  internal     BOOLEAN DEFAULT false,     -- true = staff-only note
  is_demo      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages ON ticket_messages(ticket_id, created_at);

-- ─────────────────────────────────────────
-- 5. NOTIFICATIONS CENTER
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,             -- mention | task_assigned | task_due | contract_expiring |
                                          -- ticket_reply | ticket_escalated | project_update | chat_message | reminder
  title        TEXT NOT NULL,
  body         TEXT,
  entity_type  TEXT,
  entity_id    UUID,
  link         TEXT,                      -- in-app route to open
  read_at      TIMESTAMPTZ,
  emailed_at   TIMESTAMPTZ,               -- set when the email fan-out sent it
  is_demo      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- ─────────────────────────────────────────
-- 6. INTERNAL TEAM CHAT
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type        TEXT NOT NULL DEFAULT 'team' CHECK (type IN ('dm','project','team')),
  name        TEXT,                                  -- null for DMs (derived from members)
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  dm_key      TEXT,                                  -- sorted "uidA:uidB" — dedupes DM channels
  is_demo     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_dm      ON channels(dm_key) WHERE dm_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_project ON channels(project_id) WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id   UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),            -- read receipts / unread counts
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id     UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name    TEXT,
  body           TEXT,
  attachment_id  UUID REFERENCES attachments(id) ON DELETE SET NULL,   -- file sharing
  reply_to_id    UUID REFERENCES messages(id) ON DELETE SET NULL,
  mentions       UUID[] DEFAULT '{}',               -- mentioned user ids → notifications
  edited_at      TIMESTAMPTZ,
  is_demo        BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- ─────────────────────────────────────────
-- 7. DIGITAL ASSET MANAGEMENT (builds on Phase-1 attachments)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS folders (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES folders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,   -- client folder root
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,    -- project folder root
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  is_demo     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folders_parent   ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_customer ON folders(customer_id);
CREATE INDEX IF NOT EXISTS idx_folders_project  ON folders(project_id);

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS folder_id     UUID REFERENCES folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags          TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version       INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_group UUID DEFAULT gen_random_uuid();  -- versions share a group

CREATE INDEX IF NOT EXISTS idx_attachments_folder  ON attachments(folder_id);
CREATE INDEX IF NOT EXISTS idx_attachments_tags    ON attachments USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_attachments_version ON attachments(version_group, version DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_name    ON attachments(file_name text_pattern_ops);

-- ─────────────────────────────────────────
-- 8. updated_at triggers for new tables
-- ─────────────────────────────────────────
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['contract_templates','vacations','allocations','folders']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();', t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────
-- 9. Permission keys for Phase-2 modules (idempotent append)
-- ─────────────────────────────────────────
UPDATE settings SET roles = (
  SELECT jsonb_agg(
    jsonb_set(r, '{permissions}', (
      SELECT to_jsonb(ARRAY(SELECT DISTINCT p FROM unnest(
        ARRAY(SELECT jsonb_array_elements_text(r->'permissions'))
        ||
        CASE r->>'role'
          WHEN 'admin'   THEN ARRAY['resources.read','resources.write','profitability.read','helpdesk.manage','chat.use','dam.read','dam.write']
          WHEN 'manager' THEN ARRAY['resources.read','resources.write','profitability.read','helpdesk.manage','chat.use','dam.read','dam.write']
          WHEN 'team'    THEN ARRAY['resources.read','chat.use','dam.read','dam.write']
          WHEN 'finance' THEN ARRAY['profitability.read','dam.read','chat.use']
          WHEN 'viewer'  THEN ARRAY['resources.read','dam.read']
          ELSE ARRAY[]::TEXT[]
        END
      ) AS p ORDER BY p))
    ))
  ) FROM jsonb_array_elements(roles) r
)
WHERE roles IS NOT NULL AND jsonb_typeof(roles) = 'array';

-- ─────────────────────────────────────────
-- 10. Supabase Realtime (run once; harmless if repeated)
--     Enables live notifications + chat via postgres_changes.
-- ─────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- RLS posture: unchanged from Phase 1 — the app talks to Postgres with the
-- service-role key and authorization lives in the API layer (lib/auth.ts).
-- See docs/PHASE2_ARCHITECTURE.md §5 for the policies to enable if the app
-- migrates to Supabase Auth (required before exposing Realtime to browsers).
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['contract_templates','vacations','allocations','sla_policies','ticket_messages','notifications','channels','channel_members','messages','message_reactions','folders']
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;
