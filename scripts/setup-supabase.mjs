#!/usr/bin/env node
/**
 * One-shot Supabase setup for Treeelivine ERP.
 *
 * What it does:
 *   1. Finds your Supabase project via the Management API
 *   2. Applies supabase/schema.sql to the database
 *   3. Fetches the project URL + anon/service_role keys
 *   4. Writes .env.local ready for `npm run dev`
 *   5. Prints the exact env vars to copy into Vercel/production
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/setup-supabase.mjs
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/setup-supabase.mjs --ref <project-ref>
 *
 * Requires Node 18+. Never commit your access token.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://api.supabase.com'
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('❌ Set SUPABASE_ACCESS_TOKEN first, e.g.:')
  console.error('   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/setup-supabase.mjs')
  process.exit(1)
}

const refArg = (() => {
  const i = process.argv.indexOf('--ref')
  return i > -1 ? process.argv[i + 1] : null
})()

async function api(pathname, opts = {}) {
  const res = await fetch(API + pathname, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  if (!res.ok) {
    throw new Error(`${opts.method || 'GET'} ${pathname} → ${res.status}: ${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`)
  }
  return body
}

async function main() {
  // 1. Pick the project
  const projects = await api('/v1/projects')
  if (!projects.length) {
    console.error('❌ No Supabase projects found on this account. Create one at https://supabase.com/dashboard first.')
    process.exit(1)
  }
  let project = refArg ? projects.find(p => p.id === refArg) : null
  if (refArg && !project) {
    console.error(`❌ Project ref "${refArg}" not found. Available: ${projects.map(p => `${p.id} (${p.name})`).join(', ')}`)
    process.exit(1)
  }
  if (!project) {
    if (projects.length > 1) {
      console.log('ℹ️  Multiple projects found, using the first one. Pass --ref <ref> to pick another:')
      for (const p of projects) console.log(`   - ${p.id}  ${p.name}  [${p.status}]`)
    }
    project = projects[0]
  }
  console.log(`✅ Project: ${project.name} (${project.id}) — ${project.status}`)

  // 2. Apply schema
  const here = path.dirname(fileURLToPath(import.meta.url))
  const schema = await readFile(path.join(here, '..', 'supabase', 'schema.sql'), 'utf8')
  console.log('⏳ Applying supabase/schema.sql ...')
  await api(`/v1/projects/${project.id}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: schema }),
  })
  console.log('✅ Schema applied')

  // 3. Sanity check: tables exist
  const tables = await api(`/v1/projects/${project.id}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name" }),
  })
  const names = (Array.isArray(tables) ? tables : []).map(r => r.table_name)
  const required = ['users', 'employees', 'customers', 'projects', 'tasks', 'invoices', 'expenses', 'templates', 'settings', 'support_tickets', 'quotations']
  const missing = required.filter(t => !names.includes(t))
  if (missing.length) {
    console.error(`❌ Missing tables after apply: ${missing.join(', ')}`)
    process.exit(1)
  }
  console.log(`✅ All ${required.length} tables present`)

  // 4. Fetch API keys
  const keys = await api(`/v1/projects/${project.id}/api-keys`)
  const anon = keys.find(k => k.name === 'anon')?.api_key
  const service = keys.find(k => k.name === 'service_role')?.api_key
  if (!anon || !service) {
    console.error('❌ Could not read anon/service_role keys from the Management API.')
    process.exit(1)
  }
  const url = `https://${project.id}.supabase.co`
  const jwtSecret = randomBytes(32).toString('hex')

  // 5. Write .env.local (gitignored)
  const env = [
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    `JWT_SECRET=${jwtSecret}`,
    `NEXT_PUBLIC_APP_URL=http://localhost:3000`,
    `DEMO_MODE=true`,
    '',
  ].join('\n')
  await writeFile(path.join(here, '..', '.env.local'), env)
  console.log('✅ Wrote .env.local — you can now run: npm run dev')

  console.log('\n────────────────────────────────────────────')
  console.log('For production (Vercel → Project → Settings → Environment Variables), set:')
  console.log(`  NEXT_PUBLIC_SUPABASE_URL   = ${url}`)
  console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY = (anon key — see .env.local)`)
  console.log(`  SUPABASE_SERVICE_ROLE_KEY  = (service_role key — see .env.local)`)
  console.log(`  JWT_SECRET                 = (any long random string — one was generated in .env.local)`)
  console.log(`  DEMO_MODE                  = true`)
  console.log('Then redeploy. The demo button seeds data on first click.')
  console.log('⚠️  Rotate your sbp_ access token after setup: https://supabase.com/dashboard/account/tokens')
}

main().catch(e => { console.error('❌ ' + e.message); process.exit(1) })
