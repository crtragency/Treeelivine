# Treeelivine — Phase 2 Architecture

Contract Management · Resource Planning · Profitability Dashboard ·
Advanced Help Desk · Notifications Center · Team Chat · Digital Asset Management

Grounded in the shipped codebase: Phase 2 **upgrades** what Phase 1 built
(contracts, support_tickets, attachments, activities, the design system, the
API-layer authorization model) rather than adding parallel systems. Everything
inherits Arabic RTL, dark mode, and mobile responsiveness from the existing
token CSS for free.

Runnable migration: **`supabase/phase2-migration.sql`** — tested twice on a
fresh Postgres 16 on top of `schema.sql` + `phase1-migration.sql`; constraint
suite verified (allocation bounds, vacation date order, new ticket/contract
statuses, DM dedupe, reaction dedupe, CSAT bounds, SLA seed).

## 1. Database schema (what & why)

### Contract Management (upgrade)
| Change | Purpose |
|---|---|
| `contract_templates` table | reusable bodies + default duration/value |
| `contracts.auto_renew`, `renewal_reminder_days` | renewal engine input |
| `contracts.renewed_from_id` (self-FK) | renewal chain → renewal-rate metric |
| `contracts.public_token` (unique), `signer_email`, `signature_data` | signature-ready: `/c/[token]` signing page, same capability-URL pattern as quotations |
| status CHECK widened | `draft → pending_approval → active → expired / renewed / cancelled` (legacy `sent`/`signed` stay valid) |
| partial index on `end_date` for active contracts | "expiring soon" widget is an index scan |

Expiry/renewal sweep: a `checkContractExpiry()` helper (same pattern as the
existing `syncRecurringSalaryExpenses()`) runs on dashboard load — marks
past-`end_date` actives `expired`, and inserts `contract_expiring`
notifications when `end_date - renewal_reminder_days` is reached. No external
cron needed; a Vercel Cron hitting `/api/cron/sweep` is the later upgrade path.

### Resource Planning
| Table | Design |
|---|---|
| `employees.capacity_hours_week` (default 40) | capacity denominator |
| `allocations` | employee × project, `percent` (0–100], date-ranged; workload = Σ percent of allocations overlapping today |
| `vacations` | typed, date-ranged, approval workflow (`pending/approved/rejected`, `approved_by`) |

Computed (API, not stored): utilization = tracked hours (time_entries, Phase 1)
÷ capacity; availability today = not on approved vacation; **overloaded** =
Σ allocation % > 100 → alert list + notification.

### Profitability (inputs only — the dashboard is computed)
- `expenses.project_id` → cost per project = direct expenses + Σ(time_entries
  hours × employee hourly cost)
- `employees.hourly_cost` optional override; default `salary ÷ (capacity × 4.33)`
- Revenue per project/client already exists (invoices). Everything else is
  `GROUP BY` in `/api/profitability`.

### Advanced Help Desk (upgrade)
| Change | Purpose |
|---|---|
| status CHECK widened | `open / in_progress / waiting_client / escalated / resolved / closed` |
| `department` CHECK column | routing + filters |
| `first_response_at`, `escalated_at/to` | FRT + escalation workflow |
| `satisfaction_rating` (1–5) + note | CSAT captured from the client portal after resolve |
| `created_by` | client-created tickets (portal) |
| `sla_policies` table (per priority, minutes) | seeded: urgent 30m/4h → low 24h/7d; editable in Settings |
| `ticket_messages` | threaded conversation; `internal=true` = staff-only note; first staff reply stamps `first_response_at` |

Metrics (computed in `/api/tickets/metrics`): avg FRT, avg resolution time,
SLA compliance % (responded/resolved within policy), avg CSAT.

### Notifications Center
`notifications`: `user_id`, `type` (mention, task_assigned, contract_expiring,
ticket_reply, ticket_escalated, project_update, chat_message, reminder),
`title/body`, `entity_type/id` + `link` (in-app route), `read_at`, `emailed_at`.
Partial index on unread. Producers call one helper —
`notify(userIds, type, title, {entity, link})` in `lib/notify.ts` — from the
same API handlers that already call `logActivity`.

### Team Chat
| Table | Design |
|---|---|
| `channels` | `dm / project / team`; `dm_key` = sorted `"uidA:uidB"` with unique partial index → **one DM per pair, race-safe**; unique partial index on `project_id` → one channel per project |
| `channel_members` | membership + `last_read_at` → read receipts and unread badges without a per-message reads table |
| `messages` | body, `attachment_id` (reuses Phase-1 attachments/storage), `reply_to_id`, `mentions UUID[]` (producer inserts mention notifications), `edited_at` |
| `message_reactions` | PK (message, user, emoji) — toggle = insert/delete |

### Digital Asset Management (builds on attachments)
- `folders`: self-nesting tree, rooted at a customer or project ("client
  folders" / "project folders")
- `attachments` + `folder_id`, `tags TEXT[]` (GIN), `version` +
  `version_group` — uploading a new version of a file inserts a row with the
  same group and `version+1`; history = group ordered by version
- Search: `file_name` prefix index + tag GIN; preview by `mime_type`
  (images/PDF inline via the authed download endpoint, video `<video>`, else
  download card)

## 2. Realtime strategy

Two live surfaces: notifications and chat. `supabase_realtime` publication now
includes both tables (migration §10).

- **Today (custom JWT + service key):** Realtime *to the browser* can't be
  authorized per-user without Supabase Auth. Ship with **smart polling**:
  unread-count endpoint piggybacked on an 8s interval only while the tab is
  visible (`document.visibilityState`), chat polls the open channel every 3s.
  This is invisible at agency scale (tens of users).
- **Upgrade path:** move sessions to Supabase Auth → browser subscribes with
  `postgres_changes` filtered `user_id=eq.<uid>` (notifications) and
  `channel_id=in.(...)` (chat), guarded by the RLS policies in §5. The UI
  layer doesn't change — swap the poller for a subscription in one hook
  (`useLiveQuery(fetcher, { table, filter })`).
- **Email:** a fan-out step (Vercel Cron → `/api/cron/email-digest`) selects
  `read_at IS NULL AND emailed_at IS NULL AND created_at < now()-'10 min'` and
  sends via Resend, stamping `emailed_at`. Instant-read notifications never
  become email — inbox stays quiet.

## 3. API structure

```
app/api/
  contracts/…                       existing CRUD +
    templates/route.ts              GET/POST · [id] PUT/DELETE
    [id]/renew/route.ts             POST → clones contract, links renewed_from_id, status active
    [id]/send/route.ts              POST → pending_approval→sent, returns /c/[token] URL
    metrics/route.ts                GET → expiring soon, active count, renewal rate, total value
  c/[token]/route.ts                GET public view · POST sign {name, email, signatureData}
  resources/route.ts                GET → per-employee workload%, capacity, utilization,
                                          availability, overload flags (one aggregated payload)
  allocations/route.ts + [id]       CRUD
  vacations/route.ts + [id]         CRUD (+ approve/reject via PUT status)
  profitability/route.ts            GET ?from&to → revenue/expenses/profit/margin,
                                          per-project & per-client tables, monthly trend, forecast
  tickets/…                         existing +
    [id]/messages/route.ts          GET (client sees internal=false) · POST (stamps first_response_at)
    [id]/escalate/route.ts          POST {toEmployeeId}
    [id]/satisfaction/route.ts      POST {rating, note}   (client, own ticket, once)
    metrics/route.ts                GET → FRT, resolution, SLA compliance, CSAT
  portal/tickets/route.ts           GET own · POST create (client portal help desk)
  notifications/route.ts            GET (?unread) · PUT mark-all-read
  notifications/[id]/route.ts       PUT read · DELETE
  chat/channels/route.ts            GET mine (+unread counts) · POST (dm via dm_key upsert | project | team)
  chat/channels/[id]/messages/…     GET keyset (before cursor) · POST (mentions → notifications)
  chat/channels/[id]/read/route.ts  PUT → last_read_at = now
  chat/messages/[id]/reactions/…    POST toggle
  dam/folders/route.ts + [id]       CRUD (tree by customer/project root)
  dam/files/route.ts                GET ?folderId|?search|?tags · attachments API reused for
                                          upload (accepts folderId, tags, versionGroup)
```

Every handler keeps the established contract: `getAuthUser` → permission gate →
demo write-block → query → `toApi` → `logActivity`/`notify` side effects.

## 4. TypeScript types (lib/types — additions)

```ts
export interface Allocation { id: string; employeeId: string; projectId: string; percent: number
  startDate: string; endDate?: string; employee?: Ref; project?: Ref }
export interface Vacation { id: string; employeeId: string; type: 'vacation'|'sick'|'unpaid'|'other'
  startDate: string; endDate: string; status: 'pending'|'approved'|'rejected' }
export interface EmployeeLoad { employeeId: string; name: string; capacityHours: number
  allocatedPercent: number; trackedHours: number; utilization: number
  onVacation: boolean; overloaded: boolean }
export interface Notification { id: string; type: NotificationType; title: string; body?: string
  entityType?: string; entityId?: string; link?: string; readAt?: string; createdAt: string }
export interface Channel { id: string; type: 'dm'|'project'|'team'; name?: string; projectId?: string
  unread: number; lastMessage?: Message; members?: Ref[] }
export interface Message { id: string; channelId: string; authorId?: string; authorName?: string
  body?: string; attachmentId?: string; replyToId?: string; mentions: string[]
  reactions?: { emoji: string; userIds: string[] }[]; editedAt?: string; createdAt: string }
export interface TicketMessage { id: string; ticketId: string; body: string; internal: boolean
  authorName?: string; createdAt: string }
export interface Folder { id: string; name: string; parentId?: string
  customerId?: string; projectId?: string }
type Ref = { id: string; name: string }
```

## 5. RLS policies (for the Supabase-Auth future; disabled today)

Enforcement today = API layer (service-role key bypasses RLS — unchanged).
When Realtime-to-browser lands, enable per-table policies; representative set:

```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_notifications ON notifications
  FOR ALL USING (user_id = auth.uid());

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_messages ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM channel_members m
                 WHERE m.channel_id = messages.channel_id AND m.user_id = auth.uid()));
CREATE POLICY member_post ON messages FOR INSERT
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM channel_members m
                 WHERE m.channel_id = messages.channel_id AND m.user_id = auth.uid()));

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_ticket_thread ON ticket_messages FOR SELECT
  USING (NOT internal AND EXISTS (
    SELECT 1 FROM support_tickets st JOIN customers c ON c.id = st.customer_id
    WHERE st.id = ticket_messages.ticket_id AND c.user_id = auth.uid()));
```

## 6. Permissions matrix (additions; migration §9 applies them)

| Module | admin | manager | team | finance | viewer | client |
|---|---|---|---|---|---|---|
| Contracts (+templates/renew/sign-link) | RW | RW | — | R | R | R own + sign via token |
| Resource planning | RW | RW | R (own load) | — | R | — |
| Vacations | RW approve | RW approve | request own | — | — | — |
| Profitability | R | R | — | R | — | — |
| Help desk manage (escalate/departments/SLA) | RW | RW | assigned tickets | — | R | own tickets + CSAT |
| Notifications | own | own | own | own | own | own |
| Chat | ✓ | ✓ | ✓ | ✓ | — | — |
| DAM | RW | RW | RW | R | R | client-visible files only |

Demo users: read-only everywhere (existing guard applies to every new route).

## 7. Dashboard & UI components (existing design system only)

| Component | Pattern reused |
|---|---|
| Contracts page `/app/contracts` + widgets row (expiring soon, active, renewal rate %, total value) | `page-head` + `kpi` row + `t-table`; expiring rows get the warning pill |
| Resource board `/app/resources` | per-employee row: name + capacity + **workload progress bar** (`.progress`, red >100%) + vacation pill; heatmap-lite via pipeline tint tokens |
| Profitability `/app/profitability` | KPI row (revenue/expenses/profit/margin) + monthly trend chart (**reuse the validated dashboard chart component/colors — dataviz-checked**) + two `t-table` cards: top clients, top projects |
| Ticket drawer upgrade | conversation thread (public vs internal toggle), SLA countdown chip (mono, danger when breached), escalate button |
| Portal: `/portal/support` | create ticket + own-thread view + CSAT stars after resolve |
| NotificationBell (topbar) | `iconbtn` + unread dot; dropdown = card-surface list; page `/app/notifications` |
| Chat `/app/chat` | two-pane: channel list (unread badges = nav `count` style) + thread (bubbles on `bg-surface-2`, reactions as pills, @mention autocomplete from employees) |
| DAM `/app/files` | folder breadcrumb + grid of file cards (mime icon/thumb, tags as pills, version badge vN), search input + tag filter |

All of it is tokens + existing primitives — zero new visual language, RTL/dark
included by construction.

## 8. Performance strategy

- **Aggregated single-fetch endpoints** for the three heavy screens
  (`resources`, `profitability`, `tickets/metrics`) — SQL `GROUP BY`, never
  N+1 from the client (same pattern as `leads/metrics`).
- **Partial indexes** where the hot query is a filter: unread notifications,
  active-contract end dates, approved vacations, running timers (Phase 1).
- **Keyset pagination** on messages and notifications (`before` cursor on
  `created_at`, DESC index) — no OFFSET.
- **Unread counts** without scanning messages: `messages.created_at >
  channel_members.last_read_at` per channel, computed in one join for the
  channel list.
- **Polling discipline** (pre-Realtime): only while tab visible; single
  `/api/notifications?unread=1&count=1` HEAD-style call; chat polls only the
  open channel.
- **Denormalized names** (`author_name`, `actor_name`) — timeline/chat render
  without user joins.
- **Version storage**: DAM versions are separate storage objects (no
  overwrite) — history is free, cleanup is a delete of the version group.
- **CSAT/SLA math in SQL** over indexed timestamp columns; date-bounded.

## 9. Build order (each step ships alone)

1. Migration + `lib/notify.ts` + NotificationBell (polling) — unblocks every other module's alerts
2. Contracts page + templates + renew/expiry sweep + signing page `/c/[token]` + widgets
3. Help desk upgrade (thread, SLA, escalation, departments) + portal support + CSAT + metrics
4. Resource planning (allocations, vacations, board, overload alerts → notifications)
5. Profitability dashboard (needs `expenses.project_id` backfill habit)
6. Team chat (channels/DMs/reactions/read receipts, mentions → notifications)
7. DAM (folders, tags, versions, search, previews) on top of attachments
8. Realtime swap-in when/if Supabase Auth migration happens (§2)
