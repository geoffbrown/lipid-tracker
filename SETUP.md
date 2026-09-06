# Deploying LipidLog

Two services: **Supabase** holds the data and sends sign-in links, **Vercel**
serves the app. Roughly 30 minutes end to end, most of it waiting for a project
to provision.

Do it in this order. Supabase first, because Vercel needs its keys, and then one
step back in Supabase at the end because it needs the Vercel URL.

---

## Before you start — one thing that will bite you

Readings you enter **before** Supabase is configured are stored in your browser,
not in an account. They are **not** migrated when you connect Supabase — the app
switches stores and the local ones stay behind.

So either connect Supabase before entering anything real, or export first:
**Settings → Export CSV**. There is no import flow yet (see the end of this doc).

---

## Part 1 — Supabase

### 1.1 Create the project

1. <https://supabase.com/dashboard> → **New project**.
2. Name it `lipidlog`, pick the region closest to you, and let it generate a
   database password. You will not need the password for this app — save it
   anyway.
3. Wait for provisioning (a minute or two).

### 1.2 Create the tables

1. Left sidebar → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/migrations/0001_init.sql` from this
   repo.
3. **Run**. You should get "Success. No rows returned."

That creates `readings` and `profiles`, and enables row-level security on both
with a policy per operation. RLS is what makes the anon key safe to ship in the
browser: without a signed-in user matching `user_id`, every query returns
nothing.

To check it took: **Table Editor** should list both tables, each showing
"RLS enabled".

### 1.3 Copy your keys

**Project Settings → API**. You need two values:

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon / publishable key** — a long `eyJ...` string

Both are publishable and are meant to reach the browser. **Do not** copy the
`service_role` key; it bypasses RLS and must never be in the app.

### 1.4 Turn on email sign-in

**Authentication → Sign In / Providers**:

- **Email** enabled.
- **Confirm email** on.
- Leave "Enable email signups" on, or you cannot create your own account.

The app handles both link styles Supabase can send (PKCE `?code=` and email-OTP
`?token_hash=`), so you do not need to match a particular email template.

### 1.5 Allow your sign-in URLs

**Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` for now.
- **Redirect URLs**: add `http://localhost:3000/**`

You will come back and add the Vercel URL in Part 3.

---

## Part 2 — Run it locally against Supabase

```bash
cp .env.example .env.local
```

Fill in the two values from 1.3:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Then:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. **How to tell it worked:** the "This device only"
pill in the header disappears. That pill is the app telling you it is running
without a backend, so its absence is the signal.

Go to `/login`, enter your email, open the link from your inbox. You should land
back on the dashboard signed in. Add a reading, then check **Table Editor →
readings** in Supabase — the row should be there with your `user_id` filled in.

If the link bounces you to `/login?error=auth`, the redirect URL in 1.5 does not
match where you are running.

---

## Part 3 — Vercel

### 3.1 Push the branch

The work is on `claude/code-review-o2oe2d`. Either merge it to your default
branch, or deploy the branch directly — Vercel will build whatever you point it
at.

### 3.2 Import the project

1. <https://vercel.com/new> → import `geoffbrown/lipid-tracker`.
2. Framework preset: **Next.js** (detected automatically).
3. Leave build command and output directory alone.
4. **Do not deploy yet** — add the environment variables first, or the first
   build ships without them and runs in local-store mode.

### 3.3 Environment variables

In the import screen (or **Settings → Environment Variables**), add both, ticked
for **Production, Preview and Development**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |

Then **Deploy**. You will get a URL like `lipidlog.vercel.app`.

### 3.4 Point Supabase at the live URL

Back in **Authentication → URL Configuration**:

- **Site URL**: your Vercel production URL.
- **Redirect URLs**: add all of these —
  - `https://your-app.vercel.app/**`
  - `http://localhost:3000/**` (keep, so local dev still works)
  - `https://*-your-team.vercel.app/**` if you want preview deploys to sign in

This step is the one people skip. Without it the emailed link refuses to
complete on the deployed site.

### 3.5 Check it

Open the Vercel URL on your phone. No "This device only" pill, sign in with a
link, add a reading, and confirm it appears after a reload — and on a second
device, which is the actual proof that it is in Postgres and not the browser.

---

## Troubleshooting

**"This device only" still showing on the deployed site**
The env vars are missing or were added after the build. Redeploy after adding
them — `NEXT_PUBLIC_*` values are inlined at build time, not read at runtime.

**Sign-in link goes to `/login?error=auth`**
The URL you are on is not in the redirect allow-list (3.4), or the link has
already been used — they are single-use.

**Signed in, but no readings and saving does nothing**
The migration did not run, or ran only partly. Check both tables exist and both
show RLS enabled, then re-run `0001_init.sql` — it is written to be safe to run
twice.

**Rows visible in Table Editor but not in the app**
`user_id` on those rows does not match the signed-in user. Rows created before
you signed in, or inserted by hand in the dashboard, will not have your id.

---

## Known gaps at launch

- **No import.** Readings entered in local-store mode stay there. Export to CSV
  before switching if you have entered anything you want to keep.
- **No account deletion flow.** The schema cascades on user delete, but there is
  no button for it.
- **The Martin-Hopkins divisor is an approximation.** It selects on
  triglycerides alone; the published method also uses non-HDL. Settings says so
  where the method is chosen. See `PRD-v4-web.md` OPEN-2.
