-- ============================================================
-- Treeelivine — PHASE 1 Migration
-- CRM profile, Leads pipeline, Quotation upgrades, Client portal
-- entities (contracts / files / activity), Time tracking.
-- Idempotent: safe to run repeatedly in the Supabase SQL Editor.
-- Run AFTER supabase/schema.sql.
-- ============================================================

-- ─────────────────────────────────────────
-- 1. CRM — extend customer profile
-- ─────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp       TEXT,
  ADD COLUMN IF NOT EXISTS industry       TEXT,
  ADD COLUMN IF NOT EXISTS country        TEXT,
  ADD COLUMN IF NOT EXISTS address        TEXT,
  ADD COLUMN IF NOT EXISTS website        TEXT,
  ADD COLUMN IF NOT EXISTS tax_number     TEXT,
  ADD COLUMN IF NOT EXISTS tags           TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_customers_tags     ON customers USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_customers_industry ON customers(industry);
CREATE INDEX IF NOT EXISTS idx_customers_country  ON customers(country);

-- ─────────────────────────────────────────
-- 2. LEADS PIPELINE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  company         TEXT,
  email           TEXT,
  phone           TEXT,
  whatsapp        TEXT,
  source          TEXT DEFAULT 'other'
                    CHECK (source IN ('website','referral','social','ads','cold_call','event','other')),
  stage           TEXT NOT NULL DEFAULT 'new'
                    CHECK (stage IN ('new','contacted','meeting_scheduled','proposal_sent','negotiation','won','lost')),
  position        BIGINT DEFAULT 0,            -- ordering inside a Kanban column
  score           INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  expected_value  NUMERIC DEFAULT 0,
  currency        TEXT DEFAULT 'SAR',
  assigned_to     UUID REFERENCES employees(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,  -- set on conversion (won)
  quotation_id    UUID REFERENCES quotations(id) ON DELETE SET NULL,
  lost_reason     TEXT,
  next_reminder_at TIMESTAMPTZ,
  notes           TEXT,
  won_at          TIMESTAMPTZ,
  lost_at         TIMESTAMPTZ,
  is_demo         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leads ALTER COLUMN position TYPE BIGINT;

CREATE INDEX IF NOT EXISTS idx_leads_stage       ON leads(stage, position);
CREATE INDEX IF NOT EXISTS idx_leads_assigned    ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_reminder    ON leads(next_reminder_at) WHERE next_reminder_at IS NOT NULL;

-- ─────────────────────────────────────────
-- 3. Generic ACTIVITY TIMELINE (leads, customers, projects, quotations, …)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type  TEXT NOT NULL
                 CHECK (entity_type IN ('lead','customer','project','task','quotation','invoice','contract','ticket')),
  entity_id    UUID NOT NULL,
  action       TEXT NOT NULL,            -- e.g. 'created','stage_changed','note_added','file_uploaded','status_changed'
  detail       JSONB DEFAULT '{}',       -- e.g. {"from":"contacted","to":"negotiation"}
  actor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name   TEXT,                     -- denormalized for cheap timeline rendering
  is_demo      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id, created_at DESC);

-- ─────────────────────────────────────────
-- 4. REMINDERS (follow-ups on leads / customers / anything)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  due_at       TIMESTAMPTZ NOT NULL,
  entity_type  TEXT,
  entity_id    UUID,
  assigned_to  UUID REFERENCES users(id) ON DELETE SET NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','done','dismissed')),
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  is_demo      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(assigned_to, status, due_at);

-- ─────────────────────────────────────────
-- 5. INTERNAL NOTES (per entity)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  body         TEXT NOT NULL,
  pinned       BOOLEAN DEFAULT false,
  author_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name  TEXT,
  is_demo      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_type, entity_id, pinned DESC, created_at DESC);

-- ─────────────────────────────────────────
-- 6. ATTACHMENTS (metadata; binaries live in Supabase Storage bucket 'attachments')
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attachments (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type    TEXT NOT NULL,
  entity_id      UUID NOT NULL,
  bucket         TEXT DEFAULT 'attachments',
  path           TEXT NOT NULL,           -- storage object path
  file_name      TEXT NOT NULL,
  mime_type      TEXT,
  size_bytes     BIGINT,
  client_visible BOOLEAN DEFAULT false,   -- shows up in the client portal Files tab
  uploaded_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  is_demo        BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);

-- ─────────────────────────────────────────
-- 7. CONTRACTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_number  TEXT UNIQUE,
  title            TEXT NOT NULL,
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
  project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
  status           TEXT DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','signed','expired','cancelled')),
  value            NUMERIC DEFAULT 0,
  currency         TEXT DEFAULT 'SAR',
  start_date       TIMESTAMPTZ,
  end_date         TIMESTAMPTZ,
  body             TEXT,                  -- contract text / terms
  signed_at        TIMESTAMPTZ,
  signed_by_name   TEXT,
  is_demo          BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_customer ON contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status   ON contracts(status);

-- ─────────────────────────────────────────
-- 8. QUOTATIONS — client-facing upgrades
--    (public share link, viewed tracking, discounts, online acceptance)
-- ─────────────────────────────────────────
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS public_token     UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS viewed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS responded_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS discount_type    TEXT DEFAULT 'none'
                             CHECK (discount_type IN ('none','percent','fixed')),
  ADD COLUMN IF NOT EXISTS discount_value   NUMERIC DEFAULT 0;

-- allow the new 'viewed' status
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
ALTER TABLE quotations ADD CONSTRAINT quotations_status_check
  CHECK (status IN ('draft','sent','viewed','accepted','rejected','expired'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_public_token ON quotations(public_token);

-- ─────────────────────────────────────────
-- 9. TIME TRACKING
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_entries (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
  task_id          UUID REFERENCES tasks(id) ON DELETE SET NULL,
  description      TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,                       -- NULL = timer still running
  duration_seconds INTEGER,                           -- filled on stop / manual entry
  billable         BOOLEAN DEFAULT true,
  hourly_rate      NUMERIC,
  source           TEXT DEFAULT 'timer' CHECK (source IN ('timer','manual')),
  is_demo          BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- one running timer per employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_running
  ON time_entries(employee_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_entries(employee_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_project  ON time_entries(project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_billable ON time_entries(billable, started_at DESC);

-- ─────────────────────────────────────────
-- 10. updated_at triggers for new tables (reuses update_updated_at())
-- ─────────────────────────────────────────
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads','reminders','notes','contracts','time_entries']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();', t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────
-- 11. RLS posture
-- ─────────────────────────────────────────
-- The app authenticates with its own JWT and talks to the DB through the
-- service-role key, so authorization is enforced in the API layer
-- (lib/auth.ts permissions). RLS stays disabled for these tables to match
-- the rest of the schema. If/when the app migrates to Supabase Auth, see
-- docs/PHASE1_ARCHITECTURE.md §4 for the per-role policies to enable.
ALTER TABLE leads        DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities   DISABLE ROW LEVEL SECURITY;
ALTER TABLE reminders    DISABLE ROW LEVEL SECURITY;
ALTER TABLE notes        DISABLE ROW LEVEL SECURITY;
ALTER TABLE attachments  DISABLE ROW LEVEL SECURITY;
ALTER TABLE contracts    DISABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────
-- 12. Permission keys for the new modules
--     (appends to settings.roles; idempotent)
-- ─────────────────────────────────────────
UPDATE settings SET roles = (
  SELECT jsonb_agg(
    jsonb_set(r, '{permissions}', (
      SELECT to_jsonb(ARRAY(SELECT DISTINCT p FROM unnest(
        ARRAY(SELECT jsonb_array_elements_text(r->'permissions'))
        ||
        CASE r->>'role'
          WHEN 'admin'   THEN ARRAY['leads.read','leads.write','contracts.read','contracts.write','time.read','time.write','time.reports','files.read','files.write']
          WHEN 'manager' THEN ARRAY['leads.read','leads.write','contracts.read','contracts.write','time.read','time.reports','files.read','files.write']
          WHEN 'team'    THEN ARRAY['leads.read','time.read','time.write','files.read','files.write']
          WHEN 'finance' THEN ARRAY['contracts.read','time.reports','files.read']
          WHEN 'viewer'  THEN ARRAY['leads.read','contracts.read','files.read']
          ELSE ARRAY[]::TEXT[]
        END
      ) AS p ORDER BY p))
    ))
  ) FROM jsonb_array_elements(roles) r
)
WHERE roles IS NOT NULL AND jsonb_typeof(roles) = 'array';

-- NOTE: for attachments, create a private Storage bucket named
-- 'attachments' in Supabase (Dashboard → Storage → New bucket, private).
-- Downloads are streamed through /api/attachments/[id] with auth checks.
