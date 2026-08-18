# Calo Utility Dashboard

Maintenance & Stewarding logging for the UAE Central Warehouse.
Next.js on Vercel, Postgres + Auth + Storage on Supabase.

Replaces the Google Apps Script version. What changed and why:

| Apps Script | Here |
|---|---|
| `checkPassword()` returned `{ok:true}` to the browser; session was a `localStorage` key | Supabase Auth + Row Level Security — the database refuses, so the client can't lie |
| `getDashboardData()` shipped all eight tabs to every visitor before auth | `dashboard_summary()` RPC aggregates in Postgres under the caller's RLS |
| Role lived in the URL (`?role=manager`) | Role lives in `staff.role` |
| One shared password for three managers | Individual Google sign-in, restricted to `@calo.app` |
| `innerHTML` interpolation of vendor names | JSX (React escapes by default) |
| Save failed when signal dropped | IndexedDB write-behind queue, flushed on reconnect |
| Receipts on Drive, `ANYONE_WITH_LINK` fallback | Private Storage bucket, 5-minute signed URLs |
| No edit or delete path at all | Managers can correct; staff can fix their own entry for 30 min; every change lands in `audit_log` |
| Generator cycle measured from log time | Explicit `switched_at` |
| Reversed meter reading silently became 0 | Rejected, and continuity against the previous reading enforced |

---

## 1. Supabase

1. Create a project at supabase.com. **Region: `ap-south-1` (Mumbai)** — nearest to Dubai.
2. SQL Editor → run the migrations in order:
   `0001_schema.sql` → `0002_audit.sql` → `0003_rls.sql` → `0004_rpc.sql` → `0005_storage.sql` → `0006_seed.sql`
3. Authentication → Providers → **Google**: enable it, paste a Google OAuth client
   ID and secret, and add this callback URL:
   `https://<project-ref>.supabase.co/auth/v1/callback`
4. Authentication → URL Configuration → Site URL: your Vercel domain.
   Add `http://localhost:3000/**` and `https://<your-domain>/**` to redirect allow-list.
5. Settings → API → copy the project URL, the `anon` key, and the `service_role` key.

### Linking managers to staff rows

`0006_seed.sql` creates the three manager rows with no `auth_uid`. On first Google
sign-in, `/auth/callback` links the account by matching `full_name`. If a name
doesn't match the Google profile name, set `auth_uid` by hand:

```sql
update staff set auth_uid = '<uuid from auth.users>' where full_name = 'Sagar';
```

### Setting up staff PINs

Each floor staff member needs a shadow auth user plus a PIN hash:

```sql
-- 1. Create the auth user (Authentication > Users > Add user):
--    email: staff+<staff.id>@calo.app, auto-confirm, random password.
-- 2. Link it and set the PIN:
update staff
   set auth_uid = '<uuid from auth.users>',
       pin_hash = encode(digest(id::text || ':' || '4821', 'sha256'), 'hex')
 where full_name = 'Naveen Bora';
```

Replace `4821` with the actual PIN. `pgcrypto` is enabled by `0001_schema.sql`.

---

## 2. GitHub

```bash
git init
git add .
git commit -m "Calo Utility Dashboard: Supabase + Vercel"
gh repo create calo-utility --private --source=. --push
```

Or create an empty **private** repo on github.com and:

```bash
git remote add origin git@github.com:<you>/calo-utility.git
git branch -M main
git push -u origin main
```

Keep it private. Even with no secrets committed, the schema tells an attacker
exactly what to probe.

---

## 3. Vercel

1. vercel.com → **Add New** → Project → Import Git Repository → authorise the
   GitHub app for this repo.
2. Framework preset auto-detects Next.js. Leave build settings alone.
3. Environment Variables — add all of these for Production, Preview, and Development:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase Settings → API (**Sensitive**) |
   | `GEMINI_API_KEY` | Google AI Studio |
   | `GEMINI_MODEL` | `gemini-3.6-flash` |
   | `ALLOWED_EMAIL_DOMAIN` | `calo.app` |

   Mark `SUPABASE_SERVICE_ROLE_KEY` **Sensitive** so it can't be read back from
   the dashboard.
4. Deploy.
5. Settings → Domains → add `utility.calo.app`. Vercel shows the CNAME target;
   whoever runs Calo's DNS has to add it. **Start this request early — it's
   almost always the longest lead time in the project.**
6. Go back to Supabase → Authentication → URL Configuration and set Site URL to
   the real domain once DNS resolves.

Vercel Hobby isn't licensed for commercial use — budget Pro at $20/month.

---

## 4. Local development

```bash
cp .env.example .env.local   # fill in the real values
npm install
npm run dev
```

`npm run typecheck` before pushing.

---

## 5. Data migration from the Sheet

Not automated — deliberately, because your existing data will violate the new
constraints and you want to see that rather than have it silently coerced.

1. Export each tab as CSV. Normalise dates to `YYYY-MM-DD`, strip thousands
   separators from numbers.
2. Import into staging tables, then insert into the real tables resolving the
   `LOGGED BY` / `RECEIVER` name strings to `staff.id`.
3. Suspend the meter check for the import, then review what it would have caught:

   ```sql
   set local app.skip_meter_check = 'on';
   -- ... import fuel_receipts ...
   reset app.skip_meter_check;
   ```

4. Copy existing Drive receipt URLs into `legacy_photo_url`. Don't move the
   files — hundreds of Drive transfers for near-zero value.
5. **Reconcile before cutover.** For every month in the data, the six card totals
   from `dashboard_summary` must match the old dashboard exactly. Don't proceed
   on "close enough".
6. Run both in parallel two weeks. Then replace the Apps Script `doGet` with a
   "moved" notice and delete the `add*` functions so nothing can write to the
   Sheet again.

---

## Still to build

- Purchase line items + Gemini receipt parsing (schema and bucket are ready;
  port the prompt from the old `parseReceipt()` into a route handler)
- Monthly XLSX/PDF export for Kuldeep and Darius
- Slack alerts on diesel/spend thresholds
- Budget vs actual on maintenance spend
