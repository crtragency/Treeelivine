# Treeelivine — Phase 1 Architecture

CRM · Leads Pipeline · Quotations & Proposals · Client Portal · Time Tracking

This plan is grounded in the **actual codebase**, not a greenfield spec. A large part
of Phase 1 already exists and works (customers CRUD, quotations with items/tax,
client portal with brief approval + invoice PDF, role-based permissions, Arabic RTL,
dark mode, the Treeelivine design system). Phase 1 is therefore an **extension**,
not a rewrite.

## 0. Stack decision (read first)

The requested stack (Next 15 / Tailwind / shadcn/ui / React Query) differs from what
is deployed today:

| Layer | Deployed today | Requested | Recommendation |
|---|---|---|---|
| Framework | Next.js 14 App Router | Next.js 15 | Upgrade in place later; nothing in Phase 1 needs 15 |
| Styling | Custom design-token CSS (`app/globals.css`, ships the official Treeelivine design system: IBM Plex Arabic, olive/sand palette, RTL, dark mode) | Tailwind + shadcn | **Keep the token system.** It already delivers what shadcn would, is RTL/dark-complete, and a swap is a full rewrite with zero user-facing gain |
| Data fetching | `fetch` in client pages | React Query | Adopt **incrementally** for the new modules (leads board, timer) where cache/optimistic updates genuinely matter |
| Auth | Custom JWT (`treeelivine_session` cookie) + `users` table, service-role Supabase client | Supabase Auth + RLS | Keep custom auth for Phase 1; enforce authorization in the API layer (already the pattern). RLS path documented in §4 |
| DB | Supabase Postgres | same | ✔ |

## 1. Database schema

Runnable, idempotent migration: **`supabase/phase1-migration.sql`**
(tested twice on a fresh Postgres 16 — 0 errors, constraints verified).

New tables:

| Table | Purpose | Key design points |
|---|---|---|
| `leads` | Kanban sales pipeline | `stage` CHECK (7 stages), `position` for column ordering, `score` 0–100, `expected_value`, `source`, `assigned_to → employees`, `customer_id`/`quotation_id` set on conversion, `won_at`/`lost_at`, `lost_reason` |
| `activities` | One generic activity timeline for every entity | `(entity_type, entity_id)` polymorphic key + `action` + `detail JSONB` + denormalized `actor_name`; single DESC index serves all timelines |
| `reminders` | Follow-ups (lead reminder system + general) | `due_at`, `assigned_to`, `status pending/done/dismissed` |
| `notes` | Internal notes per entity | polymorphic, `pinned`, author denormalized |
| `attachments` | File metadata (binaries in Supabase Storage bucket `attachments`) | polymorphic, `client_visible` flag drives the portal Files tab |
| `contracts` | Client contracts | number, status lifecycle draft→sent→signed, value, dates, body |
| `time_entries` | Time tracking | `ended_at IS NULL` = running timer; **unique partial index enforces one running timer per employee at the DB level**; `billable`, `hourly_rate`, `source timer/manual` |

Extended tables:

- `customers` + `contact_person, whatsapp, industry, country, address, website, tax_number, tags TEXT[]` (GIN index on tags)
- `quotations` + `public_token` (unique, powers the client share link), `viewed_at`, `responded_at`, `accepted_by_name`, `discount_type none/percent/fixed`, `discount_value`; status CHECK now includes **`viewed`**

Conventions kept from the existing schema: snake_case, `gen_random_uuid()` PKs,
`is_demo` on every table (demo mode wipe/seed keeps working), shared
`update_updated_at()` trigger.

### Multi-tenancy (foundation, not yet enabled)

Deployment today is single-tenant. When multi-tenant is needed:

```sql
CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  logo_url TEXT, settings JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW()
);
-- then, for every business table:
ALTER TABLE <t> ADD COLUMN org_id UUID NOT NULL DEFAULT '<default-org>' REFERENCES organizations(id);
CREATE INDEX ON <t>(org_id, created_at DESC);   -- org first in every composite index
```

Rules: `org_id` on every row, every query filtered by it in one place (a
`scopedClient(orgId)` wrapper around the query builder), org-first composite
indexes, and RLS `USING (org_id = auth.jwt()->>'org_id')` once on Supabase Auth.
Doing this as a dedicated migration later is safer than half-adopting it now.

## 2. TypeScript types

Single source: `lib/types.ts` (new file, add as modules are built):

```ts
export type LeadStage = 'new'|'contacted'|'meeting_scheduled'|'proposal_sent'|'negotiation'|'won'|'lost'
export type LeadSource = 'website'|'referral'|'social'|'ads'|'cold_call'|'event'|'other'

export interface Lead {
  id: string; name: string; company?: string; email?: string; phone?: string; whatsapp?: string
  source: LeadSource; stage: LeadStage; position: number; score: number
  expectedValue: number; currency: string
  assignedTo?: string; customerId?: string; quotationId?: string
  lostReason?: string; nextReminderAt?: string; notes?: string
  wonAt?: string; lostAt?: string; createdAt: string; updatedAt: string
  assignee?: { id: string; name: string }          // embed
}

export interface Activity {
  id: string; entityType: EntityType; entityId: string
  action: string; detail: Record<string, unknown>; actorName?: string; createdAt: string
}

export interface TimeEntry {
  id: string; employeeId: string; projectId?: string; taskId?: string
  description?: string; startedAt: string; endedAt?: string; durationSeconds?: number
  billable: boolean; hourlyRate?: number; source: 'timer'|'manual'
  employee?: { id: string; name: string }; project?: { id: string; name: string }
}

export type EntityType = 'lead'|'customer'|'project'|'task'|'quotation'|'invoice'|'contract'|'ticket'
```

Conversion between DB snake_case and API camelCase stays in `lib/utils.ts`
(`toApi`/`toDb`) — already the app-wide convention.

## 3. API structure

Same pattern as the existing 30+ routes: App Router route handlers,
`getAuthUser(req)` → `hasPermission(user, perm)` → query → `toApi`.

```
app/api/
  leads/route.ts                    GET (filter: stage, assigned, source, search) · POST
  leads/[id]/route.ts               GET · PUT · DELETE
  leads/[id]/stage/route.ts         PUT   { stage, position }   → drag & drop; logs activity
  leads/[id]/convert/route.ts       POST  → creates customer, links lead, stage=won
  leads/metrics/route.ts            GET   → totals, conversion rate, won/lost, forecast
  activities/route.ts               GET   ?entityType&entityId (paginated)
  notes/route.ts                    GET/POST   · notes/[id]/route.ts PUT/DELETE
  reminders/route.ts                GET/POST   · reminders/[id]/route.ts PUT/DELETE
  attachments/route.ts              GET/POST (returns signed upload URL) · [id] DELETE
  contracts/route.ts + [id]         CRUD (client GET scoped to own customer, like invoices)
  quotations/[id]/send/route.ts     POST  → status=sent, emits activity, returns share URL
  q/[token]/route.ts                GET (public; marks viewed_at) · POST {action: accept|reject, name}
  time-entries/route.ts             GET (day/week filters) · POST (manual entry)
  time-entries/timer/route.ts       GET current · POST start · PUT stop
  time-entries/reports/route.ts     GET ?groupBy=employee|project&from&to&billable
  customers/[id]/overview/route.ts  GET → one aggregated payload for all profile tabs
```

Public quotation page: `app/q/[token]/page.tsx` — no session required, renders the
branded proposal, Download PDF (print CSS like the invoice PDF pages), and an
Accept/Reject action posting to `/api/q/[token]`. The unguessable UUID token is the
capability; acceptance stamps `responded_at` + `accepted_by_name` + activity row.

Every mutation on leads/quotations/contracts writes an `activities` row in the same
handler — the timeline is a side effect of the API layer, not client-side.

## 4. Authorization & RLS

Today: the server talks to Postgres with the service-role key, so **RLS cannot be
the enforcement layer** — the API layer is (as it already is for invoices/briefs:
clients only reach rows owned by their `customer.user_id`). Phase 1 keeps this:

- every new route guards with `hasPermission(user, '<module>.<read|write>')`
- client-facing reads (portal, `/q/[token]`) scope by ownership, never by role alone

If the app later moves to Supabase Auth, enable per-table policies of this shape:

```sql
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_read ON leads FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid()
                 AND u.role IN ('admin','manager','team')));
CREATE POLICY staff_write ON leads FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid()
                 AND u.role IN ('admin','manager')));
-- portal isolation example (attachments):
CREATE POLICY client_files ON attachments FOR SELECT
  USING (client_visible AND EXISTS (
    SELECT 1 FROM customers c WHERE c.user_id = auth.uid()
      AND attachments.entity_type = 'project'
      AND attachments.entity_id IN (SELECT id FROM projects WHERE customer_id = c.id)));
```

## 5. Permissions matrix

Existing roles map to the spec (`employee` = `team`). New permission keys:
`leads.read/write`, `contracts.read/write`, `time.read/write`, `time.reports`
(added to `settings.roles` JSON — the runtime already reads permissions from there,
and per-user overrides work).

| Module | admin | manager | team (employee) | finance | viewer | client |
|---|---|---|---|---|---|---|
| CRM customers | RW | RW | R | R | R | — (own profile via portal) |
| Leads pipeline | RW | RW | R + own leads W | — | R | — |
| Quotations | RW | RW | — | RW | R | R (own, via token/portal) |
| Contracts | RW | RW | — | R | R | R (own) |
| Invoices | RW | R | — | RW | R | R (own) |
| Files | RW | RW | RW | R | R | R (client_visible on own entities) |
| Notes / activity | RW | RW | RW | R | R | — |
| Time tracking | RW | R (team) | RW (own entries) | — | — | — |
| Time reports | R | R | own only | R (billable) | — | — |
| Settings | RW | — | — | — | — | — |

Demo users: all writes blocked (existing `isDemo` guard applies to every new route).

## 6. Folder structure (feature-based)

Stay inside the App Router; group *feature* code, keep shared primitives flat:

```
app/
  app/
    crm/                       # upgraded customers module
      page.tsx                 # list: search, filters, tags
      [customerId]/page.tsx    # profile with tabs (overview/projects/quotations/
                               #   invoices/contracts/files/activity/notes)
    leads/
      page.tsx                 # Kanban board + metrics header
      components/              # LeadCard, StageColumn, LeadDrawer, ScoreBadge
    quotations/                # existing page + send/share/discount UI
    time/
      page.tsx                 # timer bar + daily/weekly logs
      reports/page.tsx
  q/[token]/page.tsx           # public proposal (no shell)
  portal/
    files/page.tsx             # NEW: client files
    contracts/page.tsx         # NEW: client contracts
    activity/page.tsx          # NEW: client activity feed
  api/...                      # §3
components/ui/                 # shared primitives (Modal, StatusBadge, PasswordInput, …)
components/entity/             # NEW shared: ActivityTimeline, NotesPanel,
                               #   AttachmentsPanel, ReminderList  (reused by every module)
lib/
  auth.ts  supabase.ts  utils.ts  types.ts
  services/                    # thin server-side query helpers per feature
    leads.ts  timeEntries.ts  activities.ts
```

Principle: polymorphic panels (`ActivityTimeline`, `NotesPanel`, `AttachmentsPanel`)
are written once against `entityType/entityId` and dropped into customer profile,
lead drawer, project page, and portal.

## 7. UI components & dashboard widgets

New components (all on existing design tokens — `card-surface`, `t-table`, `pill`,
`kpi`, `seg`, `page-head`; RTL + dark come free):

- **Kanban board** — CSS grid of stage columns; HTML5 drag & drop (no dependency);
  optimistic `PUT /stage`, revert on failure. Column header: stage pill + count +
  sum of expected value.
- **Lead drawer** — kit drawer pattern (`--drawer-w`): details, score slider,
  reminders, timeline, notes, "Convert to customer".
- **Customer profile tabs** — `seg` control + one `overview` fetch; lazy-fetch heavy tabs.
- **TimerBar** — persistent compact bar in the app shell topbar: running task name +
  elapsed ticker + stop button; backed by `GET /timer` on mount.
- **Proposal public page** — branded (logo lockup from `public/assets`), print CSS.
- **Shared panels** — ActivityTimeline / NotesPanel / AttachmentsPanel / ReminderList.

Dashboard widgets (extend `/api/dashboard` + `app/app/page.tsx` grid):

| Widget | Source |
|---|---|
| Pipeline value by stage (exists as customer funnel → switch to leads) | `leads/metrics` |
| Conversion rate + won/lost this period | `leads/metrics` |
| Revenue forecast (Σ expected_value × stage weight) | `leads/metrics` |
| Due reminders today | `reminders` |
| Hours this week / billable share | `time-entries/reports` |
| Quotations awaiting response (sent/viewed) | existing quotations |

## 8. Performance considerations

- **Indexes** shipped in the migration for every hot path: stage+position (board),
  polymorphic entity indexes, partial index on running timers, GIN on tags,
  reminder due-date partial index.
- **Aggregated endpoints** (`customers/[id]/overview`, `leads/metrics`,
  `time-entries/reports`) — one round trip per screen instead of tab-by-tab N+1;
  reports aggregate in SQL (`SUM(duration_seconds) GROUP BY`), never in JS.
- **Pagination** on activities/notes/time logs (`?limit=30&before=<cursor>` keyset,
  not OFFSET).
- **React Query** for the two live surfaces (board, timer): optimistic updates,
  `staleTime` on lookups (customers/employees lists), invalidation on mutation.
- **Timer correctness**: elapsed time is always `now - started_at` computed
  client-side from server timestamps — no drift, survives refresh; the unique
  partial index makes double-running impossible even under race.
- **Storage**: browser uploads via short-lived signed URLs (API never proxies
  bytes); metadata row after upload confirms.
- **PDF**: keep print-CSS approach (zero server cost); revisit headless rendering
  only if pixel-perfect PDFs become a requirement.
- **Denormalize** `actor_name`/`author_name` in timeline/notes — no joins to render.

## 9. Build order (each step ships alone)

1. Run `phase1-migration.sql` · add types + permission keys
2. Shared panels (activity/notes/attachments) + wire into customer profile tabs
3. CRM profile page (tabs, extended fields, tags filter)
4. Leads Kanban + metrics + convert-to-customer
5. Quotation share link, public accept page, viewed tracking, discounts
6. Portal: files / contracts / activity pages
7. Time tracking: timer bar, logs, reports
8. Dashboard widgets

Steps 2–3 unblock 4–6; time tracking (7) is fully independent.
