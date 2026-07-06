-- ============================================================
-- Treeelivine — PHASE 4 Migration
-- SaaS platform foundation: organizations & multi-company
-- tenancy (org_id/company_id on every business table, backfilled),
-- white-label branding & custom domains, plans/subscriptions/
-- coupons/usage, granular roles, audit logs, enterprise security
-- (2FA, SSO identities, device sessions, security events),
-- public API platform (API keys, webhooks, OAuth apps),
-- marketplace addons.
-- Idempotent: safe to run repeatedly in the Supabase SQL Editor.
-- Run AFTER schema.sql AND phase 1–3 migrations.
-- ============================================================

-- ─────────────────────────────────────────
-- 1. ORGANIZATIONS (the tenant: billing + white-label boundary)
--    and COMPANIES (separate businesses inside one organization)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE,                       -- subdomain: {slug}.treeelivine.com
  branding     JSONB DEFAULT '{}',                -- {logoPath, faviconPath, colors:{primary,accent,...},
                                                  --  loginTitle, loginSubtitle, emailFooter, hideVendor}
  default_currency TEXT DEFAULT 'SAR',
  owner_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  is_demo      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  legal_name   TEXT,
  logo_path    TEXT,
  currency     TEXT,                              -- overrides org default
  tax_number   TEXT,
  address      TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_org ON companies(org_id);

-- user ↔ organization membership with a role per org;
-- company_ids limits a member to specific companies ('{}' = all)
CREATE TABLE IF NOT EXISTS org_members (
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'employee',  -- owner | admin | manager | employee | finance | viewer | client
  company_ids  UUID[] DEFAULT '{}',
  invited_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_org_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────
-- 2. DEFAULT ORG/COMPANY + TENANCY COLUMNS ON EVERY BUSINESS TABLE
--    Existing single-org data is backfilled into one default
--    organization + company created from the settings row.
-- ─────────────────────────────────────────
DO $$
DECLARE
  v_org UUID; v_co UUID; v_name TEXT; t TEXT;
  org_tables TEXT[] := ARRAY[
    -- company-scoped business data (gets org_id + company_id)
    'customers','projects','tasks','employees','invoices','expenses',
    'quotations','leads','contracts','contract_templates','support_tickets',
    'time_entries','allocations','vacations','meetings','notes','reminders',
    'attachments','folders','templates','activities',
    -- org-scoped data (gets org_id only — company column still added for uniformity)
    'settings','channels','notifications','automations','integrations',
    'ai_conversations','ai_reports','ai_usage','ai_insights',
    'report_schedules','jobs'
  ];
BEGIN
  -- default organization (created once)
  SELECT id INTO v_org FROM organizations WHERE slug = 'default' LIMIT 1;
  IF v_org IS NULL THEN
    SELECT company_name INTO v_name FROM settings LIMIT 1;
    INSERT INTO organizations (name, slug)
      VALUES (COALESCE(v_name, 'Treeelivine'), 'default')
      RETURNING id INTO v_org;
  END IF;

  -- default company inside it
  SELECT id INTO v_co FROM companies WHERE org_id = v_org LIMIT 1;
  IF v_co IS NULL THEN
    INSERT INTO companies (org_id, name)
      VALUES (v_org, (SELECT name FROM organizations WHERE id = v_org))
      RETURNING id INTO v_co;
  END IF;

  -- tenancy columns + backfill + composite index on every table
  FOREACH t IN ARRAY org_tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL', t);
    EXECUTE format('UPDATE %I SET org_id = %L WHERE org_id IS NULL', t, v_org);
    EXECUTE format('UPDATE %I SET company_id = %L WHERE company_id IS NULL', t, v_co);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tenant ON %I(org_id, company_id)', t, t);
  END LOOP;

  -- existing users join the default org with their current role
  INSERT INTO org_members (org_id, user_id, role)
    SELECT v_org, u.id,
           CASE WHEN u.role IN ('owner','admin','manager','employee','finance','viewer','client')
                THEN u.role
                WHEN u.role = 'team' THEN 'employee'
                ELSE 'employee' END
    FROM users u
    ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE users SET active_org_id = v_org WHERE active_org_id IS NULL;
  UPDATE users SET active_company_id = v_co WHERE active_company_id IS NULL;
  UPDATE organizations SET owner_id = (
    SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1
  ) WHERE id = v_org AND owner_id IS NULL;
END $$;

-- ─────────────────────────────────────────
-- 3. WHITE LABEL: custom domains → organization resolution
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_domains (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain       TEXT NOT NULL UNIQUE,              -- app.agency.com
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','verifying','active','failed')),
  verification_token TEXT,
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 4. SUBSCRIPTION & BILLING
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id            TEXT PRIMARY KEY,                 -- starter | professional | business | enterprise
  name          TEXT NOT NULL,
  name_ar       TEXT,
  monthly_price NUMERIC DEFAULT 0,                -- USD
  yearly_price  NUMERIC DEFAULT 0,
  limits        JSONB DEFAULT '{}',               -- {users, companies, clients, storageGb, aiRequestsPerDay, apiKeys}
  features      TEXT[] DEFAULT '{}',              -- feature flags: white_label, api, automations, ai, sso, audit
  sort_order    INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true
);

INSERT INTO plans (id, name, name_ar, monthly_price, yearly_price, limits, features, sort_order)
SELECT * FROM (VALUES
  ('starter', 'Starter', 'البداية', 0, 0,
   '{"users":3,"companies":1,"clients":25,"storageGb":1,"aiRequestsPerDay":20,"apiKeys":0}'::jsonb,
   ARRAY['core'], 1),
  ('professional', 'Professional', 'الاحترافية', 29, 290,
   '{"users":10,"companies":2,"clients":200,"storageGb":10,"aiRequestsPerDay":100,"apiKeys":2}'::jsonb,
   ARRAY['core','ai','automations','api'], 2),
  ('business', 'Business', 'الأعمال', 79, 790,
   '{"users":30,"companies":5,"clients":1000,"storageGb":50,"aiRequestsPerDay":300,"apiKeys":5}'::jsonb,
   ARRAY['core','ai','automations','api','white_label','audit'], 3),
  ('enterprise', 'Enterprise', 'المؤسسات', 199, 1990,
   '{"users":-1,"companies":-1,"clients":-1,"storageGb":500,"aiRequestsPerDay":-1,"apiKeys":-1}'::jsonb,
   ARRAY['core','ai','automations','api','white_label','audit','sso','priority_support'], 4)
) v(id, name, name_ar, mp, yp, lim, feat, so)
WHERE NOT EXISTS (SELECT 1 FROM plans);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id              TEXT NOT NULL REFERENCES plans(id),
  status               TEXT DEFAULT 'trialing' CHECK (status IN
                         ('trialing','active','past_due','canceled','paused')),
  billing_interval     TEXT DEFAULT 'monthly' CHECK (billing_interval IN ('monthly','yearly')),
  provider             TEXT CHECK (provider IN ('stripe','paypal','manual')),
  provider_customer_id TEXT,
  provider_sub_id      TEXT,
  trial_ends_at        TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  coupon_id            UUID,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(org_id);

CREATE TABLE IF NOT EXISTS coupons (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  percent_off   NUMERIC CHECK (percent_off > 0 AND percent_off <= 100),
  months        INTEGER DEFAULT 1,                -- how many billing cycles it applies
  max_redemptions INTEGER,
  redeemed_count  INTEGER DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- billing history mirrored from provider webhooks
CREATE TABLE IF NOT EXISTS billing_events (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider     TEXT,
  event_type   TEXT,                              -- checkout.completed | invoice.paid | sub.updated | sub.canceled
  amount       NUMERIC,
  currency     TEXT,
  raw          JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events ON billing_events(org_id, created_at DESC);

-- metered usage per org per day (plan-limit enforcement + billing analytics)
CREATE TABLE IF NOT EXISTS usage_counters (
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric      TEXT NOT NULL,                      -- ai_requests | api_requests | storage_bytes | seats
  day         DATE NOT NULL DEFAULT CURRENT_DATE,
  value       BIGINT DEFAULT 0,
  PRIMARY KEY (org_id, metric, day)
);

-- ─────────────────────────────────────────
-- 5. ADVANCED PERMISSIONS: roles move from settings JSONB to a table
--    (per-org custom roles; templates seeded from the existing set)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = global template
  key          TEXT NOT NULL,                     -- owner | admin | manager | employee | client | custom-*
  label        TEXT NOT NULL,
  label_ar     TEXT,
  permissions  TEXT[] DEFAULT '{}',
  is_system    BOOLEAN DEFAULT false,             -- system roles are not deletable
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, key)
);

-- seed org-scoped roles from the legacy settings.roles JSONB (once per org)
INSERT INTO roles (org_id, key, label, permissions, is_system)
SELECT s.org_id, r->>'role', COALESCE(r->>'label', r->>'role'),
       ARRAY(SELECT jsonb_array_elements_text(r->'permissions')), true
FROM settings s, jsonb_array_elements(s.roles) r
WHERE s.roles IS NOT NULL AND jsonb_typeof(s.roles) = 'array'
  AND s.org_id IS NOT NULL
ON CONFLICT (org_id, key) DO NOTHING;

-- owner role template (full access marker)
INSERT INTO roles (org_id, key, label, label_ar, permissions, is_system)
SELECT o.id, 'owner', 'Owner', 'المالك', ARRAY['*'], true
FROM organizations o
ON CONFLICT (org_id, key) DO NOTHING;

-- ─────────────────────────────────────────
-- 6. AUDIT & COMPLIANCE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id   UUID,
  user_id      UUID,
  user_email   TEXT,                              -- denormalized: survives user deletion
  action       TEXT NOT NULL,                     -- create | update | delete | login | login_failed |
                                                  -- export | permission_change | settings_change | billing_change
  entity_type  TEXT,
  entity_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  ip           TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_org_time  ON audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity    ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user      ON audit_logs(user_id, created_at DESC);

-- ─────────────────────────────────────────
-- 7. ENTERPRISE SECURITY
-- ─────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret       TEXT,      -- encrypted; NULL = 2FA off
  ADD COLUMN IF NOT EXISTS totp_enabled      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovery_codes    TEXT[],    -- hashed one-time codes
  ADD COLUMN IF NOT EXISTS last_login_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_logins     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until      TIMESTAMPTZ;

-- SSO / social identities (Google, Microsoft)
CREATE TABLE IF NOT EXISTS auth_identities (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (provider IN ('google','microsoft','saml')),
  provider_uid  TEXT NOT NULL,                    -- sub claim
  email         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, provider_uid)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id);

-- device sessions: JWT carries a session id that must exist + be active
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_label  TEXT,                             -- "Chrome · Windows" parsed from UA
  ip            TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_live ON sessions(id) WHERE revoked_at IS NULL;

-- security event stream (feeds alerts + compliance reports)
CREATE TABLE IF NOT EXISTS security_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      UUID,
  user_id     UUID,
  kind        TEXT NOT NULL,                      -- login_new_device | login_failed_burst | password_changed |
                                                  -- twofa_enabled | twofa_disabled | session_revoked | api_key_created
  detail      JSONB DEFAULT '{}',
  ip          TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events ON security_events(org_id, created_at DESC);

-- ─────────────────────────────────────────
-- 8. PUBLIC API PLATFORM
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_prefix   TEXT NOT NULL,                     -- "tlv_live_abc1" shown in UI
  key_hash     TEXT NOT NULL UNIQUE,              -- sha256 of the full key; plaintext shown once
  scopes       TEXT[] DEFAULT '{}',               -- read:projects, write:tasks, ...
  rate_limit_per_min INTEGER DEFAULT 60,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  events       TEXT[] DEFAULT '{}',               -- same names as automation triggers
  secret       TEXT NOT NULL,                     -- HMAC signing secret (whsec_…)
  enabled      BOOLEAN DEFAULT true,
  fail_count   INTEGER DEFAULT 0,                 -- auto-disable after N consecutive failures
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id   UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type    TEXT,
  payload       JSONB DEFAULT '{}',
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','dead')),
  attempts      INTEGER DEFAULT 0,
  response_code INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  delivered_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries ON webhook_deliveries(endpoint_id, created_at DESC);

-- OAuth apps (third-party developers) — authorization-code flow
CREATE TABLE IF NOT EXISTS oauth_clients (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = platform-wide app
  name           TEXT NOT NULL,
  client_id      TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NOT NULL,
  redirect_uris  TEXT[] DEFAULT '{}',
  scopes         TEXT[] DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('code','access','refresh')),
  token_hash    TEXT NOT NULL UNIQUE,
  scopes        TEXT[] DEFAULT '{}',
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);

-- ─────────────────────────────────────────
-- 9. MARKETPLACE & EXTENSIONS (license-gated feature modules)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addons (
  id            TEXT PRIMARY KEY,                 -- hr | accounting | inventory | whatsapp | ai_pro
  name          TEXT NOT NULL,
  name_ar       TEXT,
  description   TEXT,
  monthly_price NUMERIC DEFAULT 0,
  version       TEXT DEFAULT '1.0.0',
  min_plan      TEXT REFERENCES plans(id),        -- lowest plan that may install it
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_addons (
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  addon_id      TEXT NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','disabled','trial')),
  installed_version TEXT,
  settings      JSONB DEFAULT '{}',
  installed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  installed_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, addon_id)
);

-- ─────────────────────────────────────────
-- 10. updated_at triggers for new tables
-- ─────────────────────────────────────────
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','companies','subscriptions','roles']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();', t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────
-- 11. Default org gets a subscription (enterprise, manual — the
--     platform owner's own org is never gated)
-- ─────────────────────────────────────────
INSERT INTO subscriptions (org_id, plan_id, status, provider, billing_interval)
SELECT o.id, 'enterprise', 'active', 'manual', 'yearly'
FROM organizations o
WHERE o.slug = 'default'
  AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.org_id = o.id);

-- RLS posture: unchanged — service-role key + API-layer authorization.
-- Tenancy enforcement lives in lib/tenant.ts (see PHASE4_ARCHITECTURE.md).
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','companies','org_members','custom_domains',
                           'plans','subscriptions','coupons','billing_events','usage_counters',
                           'roles','audit_logs','auth_identities','sessions','security_events',
                           'api_keys','webhook_endpoints','webhook_deliveries',
                           'oauth_clients','oauth_tokens','addons','org_addons']
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;
