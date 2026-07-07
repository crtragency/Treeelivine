# Treeelivine — Phase 4 Architecture

Multi-Company Management · White Label · Subscription & Billing ·
Mobile Apps · Public API Platform · Marketplace & Extensions ·
Advanced Permissions · Audit & Compliance · Enterprise Security ·
Business Intelligence

Phase 4 turns the single-agency product of Phases 1–3 into a **commercial
multi-tenant SaaS**. The center of gravity is one structural change —
tenancy — and eight products layered on it. Everything reuses the
established contracts (API-layer authorization, design tokens, RTL/dark,
the notifications/events/jobs plumbing from Phases 2–3).

Runnable migration: **`supabase/phase4-migration.sql`** — tested twice on
a fresh Postgres 16 on top of phases 1–3; verified: full backfill of all
existing rows into a default organization + company (customers 8/8,
users 6/6 memberships), 4 seeded plans, roles table seeded from the legacy
settings JSONB + owner template, one-subscription-per-org, all CHECK
constraints.

## 1. Multi-tenant model (the load-bearing decision)

**Two levels, one database (shared-schema tenancy):**

```
organization  = the paying tenant → billing, white-label, API keys, security policy
  └── company = a business inside the org → separate clients/projects/finances/employees
        └── every business row: (org_id, company_id)
```

- Every business table now carries `org_id` (CASCADE) + `company_id` +
  a composite `(org_id, company_id)` index — added and **backfilled by
  the migration** with zero downtime (existing data lands in a "default"
  org/company; the current deployment keeps working unchanged).
- `org_members(org_id, user_id, role, company_ids[])` — one user can
  belong to several orgs; `company_ids = '{}'` means all companies,
  otherwise the member is confined to the listed ones. `users.active_org_id`
  / `active_company_id` remember the last selection; a **company switcher**
  in the topbar sets them.
- **Why shared-schema** (vs schema-per-tenant / DB-per-tenant): one
  Supabase project, one migration path, one connection pool — the only
  model that stays operable from a Vercel serverless runtime at this
  team size. Isolation is enforced in the data-access layer (below);
  the upgrade path to DB-per-tenant for a single huge enterprise
  customer stays open because all access already flows through one
  helper.

**Enforcement — `lib/tenant.ts`:** `getAuthUser` grows into
`getAuthContext(req)` → `{user, org, company, membership, plan}` resolved
from the JWT + `org_members` (+ the custom-domain/subdomain hint). A
`tenantQuery(table, ctx)` helper replaces today's `.eq('is_demo', …)`
pattern with `.eq('org_id', ctx.org.id)` (+ `.eq('company_id', …)` for
company-scoped tables) and **every route migrates to it** — the demo flag
becomes just a demo *organization*. Cross-company reporting = org-level
endpoints that aggregate across the member's allowed `company_ids`
(executive/BI only).

## 2. Multi-Company Management (`/app/settings` → الشركات + switcher)

- Companies CRUD (plan-limited count), per-company currency/branding
  basics, activate/deactivate.
- The topbar switcher writes `active_company_id`; every page re-fetches —
  no other UI change, because scoping happens server-side.
- Employees/clients/projects/finances are company-rows by `company_id`;
  moving an entity between companies is an explicit admin action (audited).
- Cross-company rollup lives in the BI dashboard (§11), gated to org
  admins/owners.

## 3. White Label Platform

- `organizations.branding` JSONB: logo, favicon, color overrides
  (mapped onto the existing CSS custom properties — the token system from
  the redesign makes re-skinning a pure variable swap), login title/
  subtitle, email footer, `hideVendor`.
- **Delivery:** the root layout reads branding server-side and injects a
  `<style>:root{--brand-primary:…}</style>` block + logo URLs; login page
  and email templates (Phase 3 integrations) render the same object.
- **Custom domains:** `custom_domains` table; `middleware.ts` resolves
  `Host` → org (cached), sets the org hint for `getAuthContext`.
  Wildcard `*.treeelivine.com` subdomains work out of the box
  (`slug.treeelivine.com`); full custom domains are added to the Vercel
  project via the Domains API + TXT verification token (status machine:
  pending → verifying → active).
- Branding editor UI with live preview; gated by the `white_label` plan
  feature.

## 4. Subscription & Billing

- **Catalog:** `plans` (Starter free / Professional / Business /
  Enterprise; monthly + yearly prices; `limits` JSONB — users, companies,
  clients, storage, AI requests/day, API keys; `features[]` flags —
  `white_label`, `api`, `sso`, `audit`, …). Seeded by the migration;
  `-1` = unlimited.
- **State:** one `subscriptions` row per org (status: trialing → active →
  past_due → canceled; 14-day default trial), `coupons`
  (percent-off × N cycles, redemption caps), `billing_events` (webhook
  mirror), `usage_counters` (org × metric × day — AI requests and API
  requests already counted by the Phase-3 gateway, storage summed from
  attachments, seats from members).
- **Providers:** **Stripe first** (Checkout for subscribe/upgrade,
  Customer Portal for card/cancel, webhooks `checkout.session.completed`,
  `invoice.paid`, `customer.subscription.updated/deleted` — endpoint
  already scaffolded in Phase 3's integrations). **PayPal Subscriptions**
  second (create-subscription redirect + webhooks). Both normalize into
  `subscriptions` + `billing_events`; the app never trusts client-side
  state.
- **Gating:** `lib/plan.ts` — `hasFeature(ctx, 'api')` and
  `checkLimit(ctx, 'users' | 'companies' | …)` called in the relevant
  POST routes (invite user, create company, create API key, AI gateway).
  Over-limit → 402-style JSON the UI turns into an upgrade prompt.
  Downgrade keeps data but blocks *new* creation beyond the lower limit.
- **UI:** `/app/settings/billing` — current plan, usage meters vs limits,
  plan matrix, coupon field, invoices history. Platform-owner console
  `/app/platform` (owner of the "default" org only): orgs list, MRR,
  trials, coupons management.

## 5. Mobile Applications (pragmatic path)

1. **Stage A — PWA (ships with Phase 4):** manifest + service worker
   (offline shell + cached GET responses), install banners, **Web Push**
   wired into the existing `notify()` fan-out (`push_subscriptions`
   table, VAPID keys — free). The UI is already responsive/RTL; this
   delivers "app on the phone" for iOS 16.4+/Android at ~zero cost.
2. **Stage B — Expo React Native (store presence):** one TypeScript
   codebase for iOS+Android consuming the **public API (§6)**; modules
   in order: dashboard, tasks, notifications, chat, CRM, projects, files.
   Push via Expo Notifications (FCM/APNs). **Offline mode:** SQLite
   (expo-sqlite) mirror of the member's working set, `updated_at`-cursor
   delta sync against `/api/v1/sync` (per-entity `since` params), writes
   queued locally and replayed with idempotency keys; conflicts resolve
   last-write-wins with an audit trail.
3. Realtime sync piggybacks the polling model first (chat already polls);
   upgrade path is Supabase Realtime once auth migrates (unchanged from
   Phase 2 §2).

## 6. Public API Platform (`/api/v1`, docs at `/developers`)

- **Versioned surface:** `/api/v1/{customers,projects,tasks,invoices,
  leads,contracts,tickets,time-entries,files,webhooks}` — thin wrappers
  over the same service logic, stable snake_case JSON, keyset pagination,
  `X-Request-Id` echo.
- **Auth:** `Authorization: Bearer tlv_live_…` API keys (SHA-256 hash
  stored, plaintext shown once, org-bound, scoped `read:*`/`write:*`,
  expiry + revocation) **or** OAuth2 authorization-code for third-party
  apps (`oauth_clients`/`oauth_tokens`, hashed, refresh rotation) — the
  resolved principal enters the same `getAuthContext` so tenancy and
  permissions apply identically.
- **Rate limiting:** fixed-window per key per minute (`rate_limit_per_min`)
  via `usage_counters`-style atomic upserts; headers
  `X-RateLimit-Remaining` / `Retry-After`; plan-level daily caps on top.
- **Outbound webhooks:** `webhook_endpoints` subscribe to the **same event
  names the automation builder uses** — `emitEvent()` (Phase 3) gains one
  extra consumer that enqueues `webhook_deliveries` into the jobs queue:
  HMAC-SHA256 signature header, retries with backoff, auto-disable after
  20 consecutive failures, delivery log UI.
- **Docs:** hand-maintained OpenAPI 3 spec served at `/developers`
  (rendered reference + key management + webhook tester).

## 7. Marketplace & Extensions

Vercel serverless can't hot-load third-party code, so extensions are
**two honest tiers** instead of a fake plugin runtime:

1. **First-party addons (license-gated modules):** `addons` catalog
   (HR+, Accounting, Inventory, WhatsApp, AI Pro) × `org_addons`
   installs (status, version, settings). "Installing" flips capability
   flags — nav items/routes check `hasAddon(ctx,'inventory')` exactly like
   plan features; billing folds into the subscription as recurring add-on
   items. Versioning = catalog `version` vs `installed_version` with
   per-addon migration hooks.
2. **Third-party extensions = API + webhooks + OAuth (§6):** external
   apps integrate the way Slack/Stripe apps do — no untrusted code in
   the tenant runtime. The marketplace page lists both tiers.

## 8. Advanced Permission System

- **Roles move from `settings.roles` JSONB to a `roles` table** — global
  templates (Owner/Admin/Manager/Employee/Client) + per-org custom roles;
  the migration seeds each org's roles from its legacy JSONB so nothing
  changes behavior on day one. `getEffectivePermissions` reads the table
  (kept behind the existing 30s settings-style cache).
- Permission keys stay the proven `module.action` strings and grow
  approval-grade actions: `contracts.approve`, `reports.export`,
  `users.manage`, `billing.manage`, `companies.manage`, `audit.read`,
  `apikeys.manage`. Owner = `['*']`.
- Scope model: **role per org membership** (+ optional per-company
  confinement via `company_ids`), user-level overrides preserved.
  A permissions matrix editor UI (roles × grouped permission checkboxes)
  replaces the current settings section.

## 9. Audit & Compliance Center (`/app/audit`)

- `audit_logs`: org, company, user (+denormalized email), action, entity,
  **old_value/new_value JSONB diffs**, ip, user_agent, timestamp.
- `lib/audit.ts` `auditLog(ctx, action, entity, old, new)` — wired into
  every mutation route next to `logActivity` (activity = user-facing
  timeline; audit = tamper-evident compliance record; different
  retentions). Reads (exports) are also logged (`action: 'export'`).
- UI: filterable log (user/action/entity/date), diff viewer, CSV export;
  compliance reports (access report per user, change report per entity,
  login report); security monitoring feed from `security_events`.
- Scale note: monthly range partitioning once volume demands it — the
  table is insert-only and indexed `(org_id, created_at DESC)`.
- Gated by the `audit` plan feature; `audit.read` permission.

## 10. Enterprise Security

- **2FA (TOTP):** `otplib` — secret (encrypted with the Phase-3
  `INTEGRATION_SECRET` AES-GCM helper) + QR enrollment + hashed recovery
  codes; login becomes two-step when `totp_enabled`. Org policy flag can
  *require* 2FA for members.
- **SSO / social login:** Google + Microsoft OAuth (OIDC `sub` →
  `auth_identities`), auto-link by verified email, JIT membership per org
  policy; SAML deferred to an enterprise milestone (protocol noted, not
  built).
- **Device & session management:** login creates a `sessions` row; the
  JWT carries `sid`, and `getAuthContext` validates the session is live
  (cached ~60s) — enabling the devices page (label/IP/last-seen),
  per-device revoke, revoke-all, and hard logout that actually works.
- **Security alerts:** `security_events` (new-device login, failed-login
  bursts with account lock via `failed_logins`/`locked_until`, password
  change, 2FA toggles, API-key creation) → in-app `notify()` + email.
- Baseline hardening: bcrypt stays, login rate-limit per IP+email,
  password policy, encrypted secrets at rest, audit on everything above.

## 11. Business Intelligence Dashboard (`/app/bi`)

The org-level, cross-company superset of Phase 3's executive page:

- Revenue & growth (MoM/YoY) per company and consolidated (multi-currency
  normalized at org default), retention & cohort table (client-months),
  team efficiency (utilization × billable ratio), forecast (weighted
  pipeline + recurring contracts — Phase 3 logic per company, summed),
  risk panel (ai_insights rollup), health score per company + org blend.
- Company-comparison chart set (existing dataviz-validated palette),
  period selector, CSV export (`reports.export`).
- Computed endpoints only — reuses per-company aggregations in parallel
  and sums; no data duplication.

## 12. Permissions matrix (role templates)

| Capability | Owner | Admin | Manager | Employee | Client |
|---|---|---|---|---|---|
| Billing / plan / addons | ✓ | — | — | — | — |
| Companies manage / white label | ✓ | ✓ | — | — | — |
| Users & roles manage | ✓ | ✓ | — | — | — |
| Audit & security center | ✓ | ✓ | — | — | — |
| API keys / webhooks / OAuth apps | ✓ | ✓ | — | — | — |
| Approve contracts / export reports | ✓ | ✓ | ✓ | — | — |
| Business modules (per `module.action`) | ✓ | ✓ | ✓ | scoped | portal only |
| BI dashboard | ✓ | ✓ | ✓ (own companies) | — | — |

(Finance/Viewer remain as specialized employee-tier roles; all editable
per org.)

## 13. Deployment & scalability strategy

- **Runtime:** Vercel (Edge middleware for domain→org resolution; Node
  runtimes for API; `maxDuration` on AI/worker routes) + one Supabase
  Postgres. Background work = the Phase-3 jobs queue on Vercel Cron.
- **Path to 100k+ users:** (1) pgBouncer/Supavisor pooling — serverless-
  safe connections; (2) covering `(org_id, company_id)` indexes everywhere
  (done in the migration); (3) read replicas for BI/reports reads;
  (4) partition `audit_logs`/`messages`/`activities` by month;
  (5) storage via Supabase CDN with per-org prefixes + storage metering;
  (6) per-tenant rate limits already at the gateway; (7) if one tenant
  outgrows shared infra: lift-out to a dedicated project — possible
  because every query goes through `tenantQuery`.
- **Environments:** staging project + production; migrations are the
  numbered idempotent SQL files (1→4) applied in order; secrets per env.
- **Observability:** `X-Request-Id` through logs, billing/security/audit
  event streams double as ops telemetry; Vercel analytics for edge.

## 14. Build order (each step ships alone)

1. **Tenancy core** — migration + `lib/tenant.ts` + migrate all routes
   from `is_demo` filters to `tenantQuery` + company switcher (the big
   one; everything else depends on it)
2. Roles table + permissions editor + org membership management (invites)
3. Audit log helper + `/app/audit` + security events
4. Enterprise security: sessions/devices + 2FA + Google/Microsoft login
5. Billing: plans UI + Stripe checkout/portal/webhooks + gating helpers
   (+ PayPal after)
6. White label: branding editor + subdomains + custom domains
7. Public API v1 + API keys + rate limits + outbound webhooks + docs page
8. Marketplace: addons catalog + install/gating (+ third-party via §6)
9. BI dashboard (cross-company rollups)
10. Mobile: PWA + Web Push now; Expo app on the public API next

**New env vars:** `NEXT_PUBLIC_APP_DOMAIN` (for subdomains),
`STRIPE_SECRET_KEY`+`STRIPE_WEBHOOK_SECRET` (billing), `PAYPAL_*`,
`GOOGLE_CLIENT_ID/SECRET`, `MS_CLIENT_ID/SECRET` (SSO),
`VAPID_PUBLIC/PRIVATE_KEY` (web push — free, generated once),
`VERCEL_TOKEN` (custom-domain automation, optional).
