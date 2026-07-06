# Treeelivine — Phase 3 Architecture

AI Business Assistant · AI Proposal Generator · AI Project Planner ·
Workflow Automation Builder · AI Reports & Insights · AI Meeting Summaries ·
Smart Notifications · Integrations Hub · Client AI Assistant ·
Executive Intelligence Dashboard

Grounded in the shipped codebase: Phase 3 layers an **AI + automation brain**
on top of what Phases 1–2 built. It reuses the established contracts —
`getAuthUser → hasPermission → demo-guard → query → toApi → logActivity/notify`,
the design-token UI kit, `is_demo` scoping, and the notifications center —
rather than adding parallel systems. Everything inherits Arabic RTL, dark
mode, and mobile responsiveness for free.

Runnable migration: **`supabase/phase3-migration.sql`** — tested twice on a
fresh Postgres 16 on top of schema + phase 1 + phase 2; constraint suite
verified (status/provider/severity CHECKs, per-provider dedupe, permission
append, seeded automation templates). The pgvector section is guarded: it
creates the `embeddings` table only where the `vector` extension exists
(enable it in Supabase → Database → Extensions, then re-run).

## 0. AI platform layer (`lib/ai.ts`) — one gateway, every feature uses it

**Provider: Google Gemini API — 100% free tier, no credit card.** The key
comes from Google AI Studio (https://aistudio.google.com/apikey — sign in
with any Google account → "Create API key"). The free tier covers chat,
tool use, structured JSON output, streaming, **embeddings** and **native
audio understanding**, which removes two paid dependencies at once (no
separate embeddings provider, no separate transcription provider).

- **Transport:** plain `fetch` to the Gemini REST API
  (`generativelanguage.googleapis.com/v1beta/...:generateContent` /
  `:streamGenerateContent?alt=sse`) — zero new npm dependencies. Key in
  `GEMINI_API_KEY` (Vercel env), server-side only, never in the browser.
- **Provider-agnostic gateway:** every feature calls
  `aiChat/aiStream/aiJson/aiEmbed` from `lib/ai.ts`; nothing else touches
  the HTTP layer. If a paid key (Anthropic/OpenAI) shows up later, only
  `lib/ai.ts` changes.
- **Model routing** (env-overridable, one place to change):

  | Tier | Default model | Free-tier limits* | Used by |
  |---|---|---|---|
  | `smart` | `gemini-2.5-flash` | ~10 req/min, ~250 req/day | assistant, proposals, project plans, reports, meeting summaries, executive brief |
  | `fast` | `gemini-2.5-flash-lite` | ~15 req/min, ~1000 req/day | insight recommendation texts, conversation titles, classification |
  | `embed` | `gemini-embedding-001` (768-dim) | generous free quota | RAG indexing + search |

  *Limits change over time — the gateway reads them as soft config and
  handles 429s with retry-after + a polite Arabic error. For an agency
  team these daily quotas are far more than enough.
- **Function calling:** Gemini `tools.functionDeclarations` +
  `functionCall`/`functionResponse` turns drive the assistant loop —
  same design, different wire format.
- **Structured outputs:** `generationConfig.responseMimeType:
  "application/json"` + `responseSchema` for every machine-consumed result
  (proposal JSON, plan JSON, meeting summary JSON, report narrative JSON).
  No regex-parsing of prose.
- **Streaming always** for the assistant (`:streamGenerateContent?alt=sse`
  piped through a route-handler `ReadableStream`); Vercel route config
  `maxDuration: 300`.
- **Audio natively:** Gemini accepts audio parts directly (inline base64
  ≤20MB or via the free Files API) — meeting recordings are transcribed
  and summarized in one call, free.
- **Usage accounting:** every call logs `usageMetadata` token counts into
  `ai_usage` (cost 0 on the free tier — the table future-proofs a paid
  switch), plus a **daily request counter per tier** so the gateway
  budgets itself under the free quotas (env `AI_DAILY_REQUEST_BUDGET`,
  default 200 smart/day) and degrades politely when exhausted.
- **Language:** replies follow the caller's `lang` (ar/en) — one
  instruction in the system prompt; all generated artifacts store `lang`.
  Gemini's Arabic quality is strong on both tiers.

## 1. AI Business Assistant (`/app/assistant`)

ChatGPT-style chat over the ERP — implemented as a **tool-use agent loop,
not text-to-SQL**. The model never writes SQL; it calls a fixed set of
**permission-scoped data tools**, each of which wraps the same query logic
the existing API routes already use:

| Tool | Wraps | Gate |
|---|---|---|
| `get_dashboard_metrics` | dashboard aggregation | role scope (team → personal) |
| `list_projects(status, overdueOnly)` | projects + task rollup | projects.read |
| `get_profitability(from,to)` | `/api/profitability` logic | profitability.read |
| `list_invoices(status)` | invoices | finance.read |
| `get_team_workload` | `/api/resources` board | resources.read |
| `get_ticket_metrics` | FRT/SLA/CSAT | staff only |
| `list_leads(stage)` / `get_pipeline` | leads | leads.read |
| `search_knowledge(query)` | RAG over notes/tickets/meetings (§9) | per-entity scope |

Answers to the spec's canonical questions fall out directly: delayed
projects → `list_projects(overdueOnly)`; top clients → `get_profitability`;
unpaid invoices → `list_invoices('unpaid')`; team performance/workload →
`get_team_workload`; project profitability → `get_profitability`.

**Loop:** manual agentic loop (`client.messages.stream` → collect
`tool_use` blocks → execute server-side with the *requesting user's*
permission set → append `tool_result`s in one user message → repeat until
`end_turn`), streaming text deltas to the browser between iterations.
Context awareness = conversation history from `ai_messages.blocks`
(raw content blocks replayed verbatim), capped at the last N turns.

**Why not text-to-SQL:** the service-role key bypasses RLS, so a generated
query is an injection surface and a permission bypass in one. Fixed tools
make authorization identical to the REST API — `hasPermission` per tool,
`is_demo` scoping inside each tool, team members automatically see only
their own scope.

**Storage:** `ai_conversations` + `ai_messages` (UI text + raw blocks).
Titles auto-generated with the fast tier. Demo users get the assistant
read-only over demo data (tools already scope by `is_demo`).

## 2. AI Proposal Generator (`/app/quotations` → "توليد بالذكاء")

Input form: client (picker or free text), industry, services (multi),
budget, timeline, tone. → one smart-tier call with a JSON schema returning
`{title, executiveSummary, scopeOfWork[], deliverables[], timeline[{phase,
weeks}], items[{description, qty, price}], notes}` → rendered as an
**editable draft quotation** (existing quotation editor, `ai_generated:
true`, `ai_brief` stored for regeneration). PDF export = the existing
print pipeline; public share = the existing `/q/[token]` capability URL.
Nothing new to build for output — the generator *feeds the Phase-1
quotation system*.

## 3. AI Project Planner (`/app/projects` → "تخطيط بالذكاء")

Input: project description (+ optional customer, budget, deadline).
The planner call gets grounding context in the prompt: team roster with
positions and current workload (from the resources aggregation) so team
recommendations are real people with real availability. Structured output:

```json
{ "milestones": [{ "name", "weeks", "tasks": [{ "title", "days",
    "dependsOn", "suggestedRole" }] }],
  "teamRecommendations": [{ "employeeId", "reason" }],
  "risks": [{ "risk", "likelihood", "mitigation" }],
  "totalWeeks": 8 }
```

Preview screen (editable) → one click creates the project + tasks with
`milestone` labels and `depends_on` links (new task columns), stores the
full plan in `projects.ai_plan`, and optionally creates allocations for
the recommended team. Kanban/tasks pages group by milestone.

## 4. Workflow Automation Builder (`/app/automations`)

**Event system:** `lib/events.ts` exposes `emitEvent(type, payload)` —
one call added to each existing mutation route (project created, invoice
paid, ticket created/resolved, contract signed, lead stage changed, task
completed, quotation accepted, vacation requested, customer created).
`emitEvent` loads enabled automations for the type (one indexed query),
evaluates `conditions` (field/op/value against the payload — `eq, neq, gt,
lt, contains, in`), executes `actions` in order, and writes an
`automation_runs` row. Never throws into the caller (same contract as
`logActivity`/`notify`).

**Action registry** (v1): `create_task`, `assign_project_team`
(allocations), `notify` (roles or users — reuses `lib/notify.ts`),
`update_status`, `create_reminder`, `log_activity`, `ai_generate`
(e.g. draft a summary note), `send_email` / `slack_message` /
`calendar_event` (available once the matching integration is connected —
enqueued as jobs). `{{entity.field}}` templating in string params.
Slow/external actions enqueue into `jobs`; cheap ones run inline —
the event emit adds single-digit ms when no automation matches.

**Schedules:** `schedule.daily` / `schedule.weekly` triggers are virtual
events fired by the cron worker.

**UI:** builder page = trigger picker → condition rows → action rows
(no code, select + inputs, live "when X and Y then Z" sentence preview) +
runs log tab + seeded templates (project welcome, invoice-paid follow-up,
urgent-ticket escalation) shipped disabled.

## 5. Background jobs & queue (no new infra)

Vercel has no resident worker, so the queue is **DB-backed**: a `jobs`
table + `/api/cron/worker` (protected by `CRON_SECRET` header) that
Vercel Cron hits every 5 minutes. The worker claims a batch
(`status='pending' AND run_at <= now()` with an atomic
`UPDATE … RETURNING`), runs each handler (report generation, meeting
processing, embedding indexing, integration sends, insight sweep), retries
with backoff up to `max_attempts`, then marks `dead`. Fallback for the
Hobby plan (daily-only crons): the opportunistic sweep-on-load pattern
already used by `syncRecurringSalaryExpenses`/`checkContractExpiry` also
drains a few due jobs. Long AI jobs set `maxDuration: 300` on the worker
route.

## 6. AI Reports & Insights (`/app/reports`)

Five report types (weekly summary, monthly performance, team productivity,
client performance, financial overview). Generation = **aggregate first,
narrate second**: the handler computes the numbers with the same SQL/JS
used by the dashboards (revenue, per-client, per-employee hours, SLA…),
stores them in `ai_reports.data`, then a smart-tier call turns *those
numbers only* into `narrative` JSON `{summary, highlights[], risks[],
recommendations[], trends[]}` — grounded generation, no hallucinated
figures, and the UI renders numbers from `data` (charts reuse the
validated `--chart-*` components) with prose from `narrative`.
`report_schedules` + the cron worker generate on cadence and `notify`
recipients; PDF = print-friendly page (existing pattern). Trend analysis
compares the stored `data` of the previous period's report.

## 7. AI Meeting Summaries (`/app/meetings`)

Upload transcript text (v1) or audio (v1.1). Audio goes to storage and a
`summarize_meeting` job sends it **directly to Gemini** — the smart tier
understands audio natively (inline base64 up to ~20MB, or the free Gemini
Files API for bigger recordings), so transcription + extraction happen in
one free call, no extra provider or key. Output is structured
`{transcript?, summary, decisions[], actionItems[{title, assigneeName,
due}], deadlines[]}` (schema-constrained, Arabic-aware). Review screen
maps `assigneeName` → employees (fuzzy match, editable) and one click
creates tasks + reminders (`tasks_created` flag). Linked to customer/
project for the timeline.

## 8. Smart Notifications (predictive `ai_insights`)

An **insight sweep** (cron job + opportunistic on dashboard load, throttled
like the contract sweep) computes deterministic risk signals — the numbers
decide, the AI only *explains*:

| Kind | Signal |
|---|---|
| `project_delay_risk` | overdue-task ratio + progress vs elapsed-time vs due date |
| `budget_overrun` | project costs (expenses + labor from profitability logic) ≥ 80% of budget |
| `churn_risk` | client: no activity N days + unpaid invoices + no active project |
| `invoice_followup` | unpaid past due D days |
| `contract_renewal` / `resource_overload` | already shipped in Phase 2 — folded into the same table/UI |

New open insights get a fast-tier one-liner `recommendation`, insert once
(deduped on `(kind, entity_id)` open partial index), fan out through the
existing `notify()` bell, and power an "توصيات ذكية" panel on the dashboard
and the executive page. Statuses: open → acknowledged/resolved/dismissed.

## 9. RAG architecture (knowledge search)

- **Store:** pgvector `embeddings` table — chunked text per entity
  (notes, ticket threads, meeting transcripts/summaries, contract bodies,
  file names/tags, customer profiles), `vector(768)`, HNSW cosine index.
- **Embedder:** Gemini `gemini-embedding-001` at 768 dimensions
  (`outputDimensionality: 768`) — same free `GEMINI_API_KEY`, batched;
  no extra provider or cost.
- **Indexing:** `index_embeddings` jobs enqueued from the same routes that
  call `logActivity` (create/update of indexable entities); nightly
  reconcile job catches drift. Upsert on `(entity_type, entity_id,
  chunk_index)`.
- **Query path:** the assistant's `search_knowledge` tool embeds the query,
  `ORDER BY embedding <=> $1 LIMIT 8`, then **filters results by the
  caller's permissions** (entity-type → permission map; clients only get
  their own entities) before returning chunks + citations.
- **Degradation:** if the extension/table is absent, the tool falls back to
  ILIKE search over the same sources — the assistant works on day one
  without pgvector.

## 10. Integrations Hub (`/app/settings` → التكاملات)

- **Tables:** `integrations` (one row per provider, `credentials` encrypted
  AES-256-GCM with `INTEGRATION_SECRET` — write-only, never serialized to
  the client) + `integration_sync_logs` (every send/receive/webhook).
- **OAuth:** `/api/integrations/[provider]/connect` (state-signed redirect)
  → `/callback` (code exchange, encrypt, store). Google (gmail/calendar/
  drive) one app with per-product scopes; Slack OAuth; Zoom OAuth; Meta
  (whatsapp/ads) via Meta app; Stripe via restricted API key + webhook.
- **Webhooks:** `/api/webhooks/stripe` (signature-verified;
  `invoice.paid` events mark invoices paid → fires the automation event),
  `/api/webhooks/whatsapp` (message → support ticket, v1.1).
- **Capabilities exposed to automations/features:** Gmail send (reports,
  proposal emails), Calendar events (planner milestones, meeting
  action-item deadlines), Slack notify (mirror of `notify`), Drive import
  (file picker → DAM), Zoom (fetch recording/transcript → meetings),
  Stripe (payment links on invoices + paid webhooks), Meta Ads read-only
  spend (feeds profitability marketing costs), WhatsApp templated sends.
- **Build order:** Slack + Stripe + Google first (highest value, simplest
  OAuth), then Zoom, then Meta/WhatsApp.

## 11. Client AI Assistant (portal)

Same agent loop and gateway, different **toolset** — every tool scopes by
`customer.user_id = auth user` exactly like the portal routes:
`get_my_projects`, `get_my_invoices`, `get_my_quotes_contracts`,
`get_my_files`, `get_upcoming_milestones`, `get_my_tickets`. System prompt
forbids off-account topics; conversations stored with `scope='client'`;
`search_knowledge` restricted to the client's own entities. Chat bubble
in the portal layout. The security boundary is the toolset, not the
prompt — there is literally no tool that can read another client's data.

## 12. Executive Intelligence Dashboard (`/app/executive`)

`executive.read` (admin/manager). One aggregated endpoint computes:

- **Revenue forecast:** weighted pipeline (lead stage × historical
  conversion) + active recurring contracts + 3-month collected trend —
  chart with actuals vs forecast (existing chart system).
- **Risk forecast:** open `ai_insights` grouped by severity/kind.
- **Team efficiency:** billable tracked hours ÷ capacity, per employee.
- **Client churn risk:** the `churn_risk` insight list with scores.
- **Growth trends:** MoM revenue, new clients, win rate.
- **Business health score (0–100):** weighted blend — collection rate 25,
  pipeline coverage 15, utilization 15, margin 20, churn risk 15, SLA 10 —
  each factor shown with its contribution so the number is explainable.
- **AI commentary:** a daily `executive_brief` row in `ai_reports`
  (cron-cached, smart tier) — narrative + top-3 recommended actions;
  regenerate on demand.

## 13. API structure

```
app/api/
  ai/
    assistant/route.ts               POST {conversationId?, message} → SSE stream
    conversations/route.ts (+[id])   GET list · DELETE
    proposal/route.ts                POST brief → proposal JSON (then normal quotation POST)
    planner/route.ts                 POST description → plan JSON
    planner/apply/route.ts           POST plan → project + tasks (+allocations)
    usage/route.ts                   GET spend per feature/day (ai.admin)
  automations/route.ts + [id]        CRUD · [id]/runs · [id]/toggle
  reports/route.ts + [id]            GET list/one · POST generate {type, period}
  reports/schedules/route.ts + [id]  CRUD
  meetings/route.ts + [id]           CRUD · POST upload · [id]/apply-tasks
  insights/route.ts + [id]           GET list · PUT status
  executive/route.ts                 GET aggregated payload (+ cached brief)
  integrations/route.ts              GET all (sans credentials)
  integrations/[provider]/connect|callback|route.ts(DELETE disconnect)|test
  webhooks/stripe/route.ts           POST (signature-verified)
  cron/worker/route.ts               GET/POST (CRON_SECRET) → drain jobs
```

Every handler keeps the established contract; demo users are read-only on
all new write routes; AI routes additionally check the `ai.use` gate and
the daily budget.

## 14. Permissions matrix (migration §11 applies it)

| Module | admin | manager | team | finance | viewer | client |
|---|---|---|---|---|---|---|
| AI assistant (`ai.use`) | ✓ | ✓ | ✓ (own scope) | ✓ | — | portal assistant (own data) |
| AI admin: budget/usage/keys | ✓ | — | — | — | — | — |
| Proposal/Planner generators | ✓ | ✓ | — | proposal only | — | — |
| Automations (`automations.manage`) | ✓ | ✓ | — | — | — | — |
| Reports (`reports.read/manage`) | RW | RW | — | R | R | — |
| Meetings | RW | RW | R (linked) | — | — | — |
| Insights | RW | RW | — | R | — | — |
| Integrations (`integrations.manage`) | ✓ | — | — | — | — | — |
| Executive (`executive.read`) | ✓ | ✓ | — | — | — | — |

## 15. Security & multi-tenancy

- Assistant tools inherit the caller's permission set — the model cannot
  widen access (no SQL, no service-role reach-through). Tool results are
  the only data the model sees.
- Prompt-injection containment: retrieved content (notes, tickets, RAG
  chunks) is wrapped as data in tool results; system prompt instructs the
  model to treat it as untrusted; client toolset is structurally scoped.
- Integration credentials encrypted at rest (AES-256-GCM), decrypted only
  inside server handlers; webhook signatures verified; OAuth `state` HMAC.
- `is_demo` scoping on every new table; migration path to `org_id`
  multi-tenancy unchanged (add column + backfill + index — the API layer
  already funnels every query through shared helpers).
- RLS stays disabled (service-role model); representative policies to
  enable on a Supabase-Auth migration mirror Phase 2 §5 (own-rows for
  `ai_conversations`/`ai_messages`, admin-only for `integrations`).

## 16. Performance & scale strategy (100k+ users)

- **Aggregated single-fetch endpoints** for executive/reports (same
  pattern as `resources`/`profitability`) — no client-side N+1.
- **Model routing keeps the free quota healthy:** the lite tier absorbs
  high-volume small tasks, the smart tier is reserved for generation that
  needs quality; the gateway's per-tier daily counters throttle before
  Google does, and 429s retry with backoff.
- **Streaming everywhere** for perceived latency; optimistic UI already
  established in Phase 2 chat.
- **DB-backed queue** with atomic claims scales horizontally with worker
  invocations; partial indexes on `jobs(pending)`, `ai_insights(open)`,
  `automations(enabled by trigger)` keep hot queries index-only.
- **HNSW** vector index (no training step, good recall at this scale);
  embeddings batched and upserted, nightly reconcile.
- **Caches:** settings row (exists), daily executive brief, per-period
  report `data` reused for trend comparisons.
- **Budgets:** `ai_usage` powers per-day cost caps and per-user rate limits
  (N assistant messages/min) enforced in the gateway.
- The `notify`/`emitEvent`/`logActivity` trio all no-throw and run in
  parallel with `Promise.all` in hot paths (pattern set in Phase 2).

## 17. Build order (each step ships alone)

1. `lib/ai.ts` gateway + `ai_usage` + migration — unblocks everything
2. AI Business Assistant (tools over existing aggregations, streaming chat UI)
3. AI Proposal Generator + AI Project Planner (feed existing quotations/projects)
4. Workflow Automation Builder (`emitEvent` + registry + builder UI + logs)
5. Jobs worker + AI Reports (+schedules) + Smart Notifications sweep
6. Executive Intelligence Dashboard (aggregation + cached AI brief)
7. Meeting Summaries (transcript v1 → audio v1.1)
8. Client AI Assistant (portal toolset)
9. Integrations Hub (Slack + Stripe + Google → Zoom → Meta/WhatsApp)
10. RAG (`pgvector` + Gemini embeddings + `search_knowledge`) — last, the
    assistant already works without it

**New env vars:** `GEMINI_API_KEY` (required — free from
https://aistudio.google.com/apikey, Google account only, no credit card),
`CRON_SECRET`, `INTEGRATION_SECRET` (32-byte),
`AI_DAILY_REQUEST_BUDGET` (optional), per-provider OAuth client
ids/secrets (integrations only). **Everything AI runs at $0.**
