# Treeelivine ERP

Internal agency ERP (CRM, projects, tasks, briefs, invoices, quotations, HR/payroll, support tickets, client portal) built with Next.js 14 + Supabase.

## Setup (one command)

You need a [Supabase](https://supabase.com/dashboard) project and a personal access token (Dashboard → Account → Access Tokens).

```bash
npm install
SUPABASE_ACCESS_TOKEN=sbp_xxx npm run setup:supabase
npm run dev
```

The setup script:

1. Finds your Supabase project (pass `-- --ref <project-ref>` if you have several)
2. Applies `supabase/schema.sql` (idempotent — safe to re-run)
3. Fetches the project URL and API keys
4. Writes `.env.local` with everything the app needs, including a generated `JWT_SECRET`

Then open [http://localhost:3000](http://localhost:3000) and click **🚀 جرّب الديمو / Try Demo** — it seeds demo data and signs you in as a read-only demo admin.

> ⚠️ Rotate your `sbp_` token after setup — it grants full access to your Supabase account.

### Manual setup (alternative)

1. Run `supabase/schema.sql` in the Supabase SQL Editor
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project Settings → API → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → Project API keys
   - `JWT_SECRET` — any long random string
   - `DEMO_MODE=true`

## Deploying (Vercel)

Set the same five environment variables in Vercel → Project → Settings → Environment Variables, then deploy. The demo button works in production once the schema is applied and the env vars are set.

## Demo mode

The **Try Demo** button calls `POST /api/seed`, which wipes rows flagged `is_demo` and re-creates demo employees, customers, projects, tasks, invoices, expenses, quotations, tickets and templates, then signs you in as `demo@treeelivine.com` (admin, read-only — writes are blocked for demo users).
