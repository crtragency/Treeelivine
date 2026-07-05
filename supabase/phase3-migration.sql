-- ============================================================
-- Treeelivine — PHASE 3 Migration
-- AI assistant (conversations/usage), AI proposals & project plans
-- (no new tables — they land in quotations/projects), workflow
-- automations + event log, AI reports & schedules, meeting
-- summaries, smart notifications (insights), integrations hub,
-- DB-backed job queue, RAG embeddings (guarded — needs pgvector).
-- Idempotent: safe to run repeatedly in the Supabase SQL Editor.
-- Run AFTER schema.sql, phase1-migration.sql AND phase2-migration.sql.
-- ============================================================

-- ─────────────────────────────────────────
-- 1. AI CONVERSATIONS (Business Assistant + Client Assistant)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT,                                   -- auto-generated from first message
  scope       TEXT DEFAULT 'staff' CHECK (scope IN ('staff','client')),
  is_demo     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content          TEXT,                              -- rendered text shown in the UI
  blocks           JSONB DEFAULT '[]',                -- raw content blocks (tool_use/tool_result replay)
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);

-- per-call token/cost accounting for every AI feature
CREATE TABLE IF NOT EXISTS ai_usage (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  feature        TEXT NOT NULL,          -- assistant | proposal | planner | report | meeting |
                                         -- insight | automation | client_assistant | embedding
  model          TEXT,
  input_tokens   INTEGER DEFAULT 0,
  output_tokens  INTEGER DEFAULT 0,
  cache_read_tokens  INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  cost_usd       NUMERIC(10,6) DEFAULT 0,
  is_demo        BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage(feature, created_at DESC);

-- ─────────────────────────────────────────
-- 2. AI PROPOSAL GENERATOR / PROJECT PLANNER inputs
--    (outputs land in the existing quotations / projects+tasks tables)
-- ─────────────────────────────────────────
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS ai_generated  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_brief      JSONB;      -- {clientType, industry, services, budget, timeline}

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS ai_generated  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_plan       JSONB;      -- {milestones, dependencies, risks, teamSuggestions}

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS milestone     TEXT,        -- planner groups tasks under milestones
  ADD COLUMN IF NOT EXISTS depends_on    UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(project_id, milestone) WHERE milestone IS NOT NULL;

-- ─────────────────────────────────────────
-- 3. WORKFLOW AUTOMATION BUILDER
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automations (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  trigger_type  TEXT NOT NULL,           -- project.created | invoice.paid | ticket.created |
                                         -- ticket.resolved | contract.signed | lead.stage_changed |
                                         -- task.completed | vacation.requested | customer.created |
                                         -- quotation.accepted | schedule.daily | schedule.weekly
  conditions    JSONB DEFAULT '[]',      -- [{field:"priority", op:"eq", value:"urgent"}]
  actions       JSONB DEFAULT '[]',      -- [{type:"create_task", params:{...}}, {type:"notify", ...}]
  enabled       BOOLEAN DEFAULT true,
  run_count     INTEGER DEFAULT 0,
  last_run_at   TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  is_demo       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_trigger ON automations(trigger_type) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS automation_runs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id  UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  event_type     TEXT,
  event_payload  JSONB DEFAULT '{}',
  status         TEXT DEFAULT 'success' CHECK (status IN ('success','partial','failed','skipped')),
  actions_log    JSONB DEFAULT '[]',     -- [{type, ok, detail}]
  error          TEXT,
  duration_ms    INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs ON automation_runs(automation_id, created_at DESC);

-- ─────────────────────────────────────────
-- 4. DB-BACKED JOB QUEUE (Vercel Cron worker drains it)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type         TEXT NOT NULL,            -- generate_report | summarize_meeting | index_embeddings |
                                         -- run_automation | send_email | sync_integration | ai_insights_sweep
  payload      JSONB DEFAULT '{}',
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','dead')),
  run_at       TIMESTAMPTZ DEFAULT NOW(),
  attempts     INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error   TEXT,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_pending ON jobs(run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type, created_at DESC);

-- ─────────────────────────────────────────
-- 5. AI REPORTS & SCHEDULES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_schedules (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type  TEXT NOT NULL CHECK (report_type IN
                 ('weekly_summary','monthly_performance','team_productivity',
                  'client_performance','financial_overview')),
  cadence      TEXT DEFAULT 'weekly' CHECK (cadence IN ('daily','weekly','monthly')),
  enabled      BOOLEAN DEFAULT true,
  recipients   UUID[] DEFAULT '{}',      -- user ids to notify when ready
  last_run_at  TIMESTAMPTZ,
  next_run_at  TIMESTAMPTZ,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  is_demo      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_reports (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type  TEXT NOT NULL,            -- the 5 schedule types + executive_brief + custom
  title        TEXT NOT NULL,
  period_from  DATE,
  period_to    DATE,
  data         JSONB DEFAULT '{}',       -- the aggregated numbers the narrative is grounded in
  narrative    JSONB DEFAULT '{}',       -- {summary, highlights[], risks[], recommendations[], trends[]}
  lang         TEXT DEFAULT 'ar',
  schedule_id  UUID REFERENCES report_schedules(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  is_demo      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_reports ON ai_reports(report_type, created_at DESC);

-- ─────────────────────────────────────────
-- 6. AI MEETING SUMMARIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title          TEXT NOT NULL,
  meeting_date   TIMESTAMPTZ DEFAULT NOW(),
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  project_id     UUID REFERENCES projects(id) ON DELETE SET NULL,
  source         TEXT DEFAULT 'transcript' CHECK (source IN ('transcript','audio')),
  audio_path     TEXT,                    -- storage path when source = audio
  transcript     TEXT,
  status         TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','failed')),
  summary        JSONB DEFAULT '{}',      -- {summary, decisions[], actionItems[{title,assignee,due}], deadlines[]}
  tasks_created  BOOLEAN DEFAULT false,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  is_demo        BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings ON meetings(created_at DESC);

-- ─────────────────────────────────────────
-- 7. SMART NOTIFICATIONS / PREDICTIVE INSIGHTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_insights (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kind            TEXT NOT NULL,          -- project_delay_risk | budget_overrun | churn_risk |
                                          -- contract_renewal | resource_overload | invoice_followup
  severity        TEXT DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  entity_type     TEXT,
  entity_id       UUID,
  title           TEXT NOT NULL,
  detail          JSONB DEFAULT '{}',     -- the numbers behind the flag (score, thresholds, evidence)
  recommendation  TEXT,                   -- AI-written suggested action
  status          TEXT DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  is_demo         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_open ON ai_insights(kind, entity_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_ai_insights_list ON ai_insights(created_at DESC);

-- ─────────────────────────────────────────
-- 8. INTEGRATIONS HUB
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider       TEXT NOT NULL CHECK (provider IN
                   ('gmail','google_calendar','google_drive','slack',
                    'whatsapp','stripe','meta_ads','zoom')),
  status         TEXT DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','error','expired')),
  account_label  TEXT,                    -- e.g. the connected email / workspace name
  credentials    TEXT,                    -- AES-256-GCM encrypted JSON (tokens); never returned by the API
  scopes         TEXT[] DEFAULT '{}',
  settings       JSONB DEFAULT '{}',      -- per-provider options (channel id, calendar id, …)
  connected_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  connected_at   TIMESTAMPTZ,
  last_sync_at   TIMESTAMPTZ,
  is_demo        BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider) WHERE is_demo = false;

CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  direction       TEXT DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound','webhook')),
  action          TEXT,                   -- send_email | create_event | notify_channel | payment_webhook …
  status          TEXT DEFAULT 'success' CHECK (status IN ('success','failed')),
  detail          JSONB DEFAULT '{}',
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs ON integration_sync_logs(integration_id, created_at DESC);

-- ─────────────────────────────────────────
-- 9. RAG EMBEDDINGS (guarded — requires the pgvector extension)
--    On Supabase: Dashboard → Database → Extensions → enable "vector",
--    then re-run this migration; the block below creates the table.
-- ─────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector not available — skipping embeddings table (enable the extension and re-run)';
  END;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE TABLE IF NOT EXISTS embeddings (
      id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      entity_type  TEXT NOT NULL,          -- note | ticket_message | meeting | contract | file | customer
      entity_id    UUID NOT NULL,
      chunk_index  INTEGER DEFAULT 0,
      content      TEXT NOT NULL,          -- the chunk that was embedded (shown as citation)
      embedding    vector(1024),           -- voyage-3.5 dims
      is_demo      BOOLEAN DEFAULT false,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (entity_type, entity_id, chunk_index)
    );
    CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON embeddings(entity_type, entity_id);
    -- HNSW beats IVFFlat at this scale and needs no training step
    CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw ON embeddings
      USING hnsw (embedding vector_cosine_ops);
  END IF;
END $$;

-- ─────────────────────────────────────────
-- 10. updated_at triggers for new tables
-- ─────────────────────────────────────────
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_conversations','automations','report_schedules',
                           'meetings','ai_insights','integrations']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();', t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────
-- 11. Permission keys for Phase-3 modules (idempotent append)
-- ─────────────────────────────────────────
UPDATE settings SET roles = (
  SELECT jsonb_agg(
    jsonb_set(r, '{permissions}', (
      SELECT to_jsonb(ARRAY(SELECT DISTINCT p FROM unnest(
        ARRAY(SELECT jsonb_array_elements_text(r->'permissions'))
        ||
        CASE r->>'role'
          WHEN 'admin'   THEN ARRAY['ai.use','ai.admin','automations.manage','integrations.manage','reports.read','reports.manage','executive.read']
          WHEN 'manager' THEN ARRAY['ai.use','automations.manage','reports.read','reports.manage','executive.read']
          WHEN 'team'    THEN ARRAY['ai.use']
          WHEN 'finance' THEN ARRAY['ai.use','reports.read']
          WHEN 'viewer'  THEN ARRAY['reports.read']
          ELSE ARRAY[]::TEXT[]
        END
      ) AS p ORDER BY p))
    ))
  ) FROM jsonb_array_elements(roles) r
)
WHERE roles IS NOT NULL AND jsonb_typeof(roles) = 'array';

-- ─────────────────────────────────────────
-- 12. Seed automation templates (only when the table is empty)
-- ─────────────────────────────────────────
INSERT INTO automations (name, trigger_type, conditions, actions, enabled)
SELECT * FROM (VALUES
  ('ترحيب بمشروع جديد', 'project.created', '[]'::jsonb,
   '[{"type":"create_task","params":{"title":"اجتماع انطلاق المشروع","daysFromNow":3}},
     {"type":"notify","params":{"roles":["admin","manager"],"title":"مشروع جديد: {{project.name}}"}}]'::jsonb,
   false),
  ('متابعة سداد فاتورة', 'invoice.paid', '[]'::jsonb,
   '[{"type":"notify","params":{"roles":["admin","manager","finance"],"title":"تم سداد الفاتورة {{invoice.number}}"}},
     {"type":"log_activity","params":{"action":"receipt_ready"}}]'::jsonb,
   false),
  ('تصعيد تذكرة عاجلة', 'ticket.created', '[{"field":"priority","op":"eq","value":"urgent"}]'::jsonb,
   '[{"type":"notify","params":{"roles":["admin","manager"],"title":"تذكرة عاجلة: {{ticket.title}}"}}]'::jsonb,
   false)
) v(name, trigger_type, conditions, actions, enabled)
WHERE NOT EXISTS (SELECT 1 FROM automations);

-- RLS posture: unchanged — service-role key + API-layer authorization
-- (lib/auth.ts). See docs/PHASE3_ARCHITECTURE.md §security for the
-- policies to enable if the app migrates to Supabase Auth.
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_conversations','ai_messages','ai_usage','automations',
                           'automation_runs','jobs','report_schedules','ai_reports',
                           'meetings','ai_insights','integrations','integration_sync_logs']
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;
