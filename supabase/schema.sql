-- ============================================================
-- Treelivine ERP — Supabase PostgreSQL Schema
-- Run this in your Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- USERS  (custom auth — not Supabase Auth)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email                 TEXT UNIQUE NOT NULL,
  password              TEXT NOT NULL,
  name                  TEXT,
  role                  TEXT NOT NULL DEFAULT 'client'
                          CHECK (role IN ('admin','manager','team','finance','viewer','client')),
  is_active             BOOLEAN DEFAULT true,
  effective_permissions TEXT[] DEFAULT '{}',
  is_demo               BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- EMPLOYEES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  internal_role TEXT,
  salary        NUMERIC,
  is_demo       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  company     TEXT,
  status      TEXT DEFAULT 'lead',
  priority    TEXT DEFAULT 'medium',
  notes       TEXT,
  assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  is_demo     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    TEXT NOT NULL,
  description             TEXT,
  customer_id             UUID REFERENCES customers(id) ON DELETE SET NULL,
  status                  TEXT DEFAULT 'planning',
  brief                   TEXT,
  brief_status            TEXT DEFAULT 'not_started',
  brief_approved_at       TIMESTAMPTZ,
  brief_approved_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  brief_comments          JSONB DEFAULT '[]',
  assigned_employee_ids   UUID[] DEFAULT '{}',
  due_date                TIMESTAMPTZ,
  start_date              TIMESTAMPTZ,
  notes                   TEXT,
  task_progress_percent   NUMERIC DEFAULT 0,
  is_demo                 BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TASKS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title               TEXT NOT NULL,
  description         TEXT,
  project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  current_assignee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  status              TEXT DEFAULT 'pending',
  priority            TEXT DEFAULT 'medium',
  due_date            TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  history             JSONB DEFAULT '[]',
  is_demo             BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number   TEXT UNIQUE,
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
  project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
  status           TEXT DEFAULT 'unpaid',
  currency         TEXT DEFAULT 'SAR',
  tax_rate         NUMERIC DEFAULT 0,
  tax_amount       NUMERIC DEFAULT 0,
  subtotal         NUMERIC DEFAULT 0,
  amount           NUMERIC DEFAULT 0,
  paid_amount      NUMERIC DEFAULT 0,
  remaining_amount NUMERIC DEFAULT 0,
  issue_date       TIMESTAMPTZ DEFAULT NOW(),
  due_date         TIMESTAMPTZ,
  notes            TEXT,
  items            JSONB DEFAULT '[]',
  is_demo          BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- EXPENSES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description           TEXT,
  category              TEXT NOT NULL,
  amount                NUMERIC NOT NULL,
  date                  TIMESTAMPTZ DEFAULT NOW(),
  employee_id           UUID REFERENCES employees(id) ON DELETE SET NULL,
  is_recurring_salary   BOOLEAN DEFAULT false,
  salary_next_due_date  TIMESTAMPTZ,
  is_demo               BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TEMPLATES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  type        TEXT DEFAULT 'brief',
  category    TEXT DEFAULT 'general',
  content     TEXT,
  usage_count INTEGER DEFAULT 0,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  is_demo     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SETTINGS (singleton row)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name     TEXT DEFAULT 'Treelivine',
  company_address  TEXT,
  default_currency TEXT DEFAULT 'SAR',
  default_tax_rate NUMERIC DEFAULT 15,
  currencies       JSONB DEFAULT '[{"code":"SAR","name":"Saudi Riyal","rate":1},{"code":"USD","name":"US Dollar","rate":3.75}]',
  roles            JSONB DEFAULT '[]',
  permissions      JSONB DEFAULT '[]',
  demo_mode        BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SUPPORT TICKETS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES employees(id) ON DELETE SET NULL,
  status        TEXT DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','resolved','closed')),
  priority      TEXT DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','urgent')),
  resolved_at   TIMESTAMPTZ,
  is_demo       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- QUOTATIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT UNIQUE,
  customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  status       TEXT DEFAULT 'draft'
                 CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  currency     TEXT DEFAULT 'SAR',
  subtotal     NUMERIC DEFAULT 0,
  tax_rate     NUMERIC DEFAULT 15,
  tax_amount   NUMERIC DEFAULT 0,
  total        NUMERIC DEFAULT 0,
  items        JSONB DEFAULT '[]',
  valid_until  TIMESTAMPTZ,
  notes        TEXT,
  is_demo      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_status     ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_user_id    ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status      ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status         ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id     ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee       ON tasks(current_assignee_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer    ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category    ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_salary      ON expenses(is_recurring_salary) WHERE is_recurring_salary = true;
CREATE INDEX IF NOT EXISTS idx_tickets_status       ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_customer     ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status    ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_customer  ON quotations(customer_id);

-- ─────────────────────────────────────────
-- updated_at auto-update trigger
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','employees','customers','projects','tasks','invoices','expenses','templates','settings','support_tickets','quotations']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();', t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────
-- DEFAULT SETTINGS ROW
-- ─────────────────────────────────────────
INSERT INTO settings (
  company_name, default_currency, default_tax_rate,
  currencies, roles, permissions
)
SELECT
  'Treelivine',
  'SAR',
  15,
  '[{"code":"SAR","name":"Saudi Riyal","rate":1},{"code":"USD","name":"US Dollar","rate":3.75},{"code":"EUR","name":"Euro","rate":4.05}]'::jsonb,
  '[
    {"role":"admin","label":"Admin","permissions":["crm.read","crm.write","projects.read","projects.write","tasks.read","tasks.write","finance.read","finance.write","team.read","team.write","settings.read","settings.write","templates.read","templates.write"]},
    {"role":"manager","label":"Manager","permissions":["crm.read","crm.write","projects.read","projects.write","tasks.read","tasks.write","team.read","templates.read"]},
    {"role":"team","label":"Team","permissions":["projects.read","tasks.read","tasks.write"]},
    {"role":"finance","label":"Finance","permissions":["finance.read","finance.write","projects.read","tasks.read"]},
    {"role":"viewer","label":"Viewer","permissions":["crm.read","projects.read","tasks.read"]},
    {"role":"client","label":"Client","permissions":[]}
  ]'::jsonb,
  '[
    {"key":"crm.read","label":"CRM Read"},{"key":"crm.write","label":"CRM Write"},
    {"key":"projects.read","label":"Projects Read"},{"key":"projects.write","label":"Projects Write"},
    {"key":"tasks.read","label":"Tasks Read"},{"key":"tasks.write","label":"Tasks Write"},
    {"key":"finance.read","label":"Finance Read"},{"key":"finance.write","label":"Finance Write"},
    {"key":"team.read","label":"Team Read"},{"key":"team.write","label":"Team Write"},
    {"key":"settings.read","label":"Settings Read"},{"key":"settings.write","label":"Settings Write"},
    {"key":"templates.read","label":"Templates Read"},{"key":"templates.write","label":"Templates Write"}
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM settings);

-- ─────────────────────────────────────────
-- DISABLE RLS (we use service role key with our own auth)
-- ─────────────────────────────────────────
ALTER TABLE users      DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees  DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers  DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects   DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks      DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices   DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses   DISABLE ROW LEVEL SECURITY;
ALTER TABLE templates  DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings        DISABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotations      DISABLE ROW LEVEL SECURITY;
