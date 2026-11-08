# Change Detector (Notify-Me)

Paste a link, and Change Detector opens that page on a schedule in the background.
When the page changes in a way you care about, it emails you what changed.
Typical uses: a college notice board, a results page, a product that might come back in stock.

**Live demo:** https://notify-me-five-alpha.vercel.app
**Source:** https://github.com/Dhruv1737/Notify-Me

## What it does

- Sign up with email and password, verify your email, log in.
- Watch up to 10 pages. Choose how often to check (5 minutes to a day) and which part of the
  page to watch (a CSS selector).
- Four alert types: the page changes, a new line contains your keywords, keywords appear,
  keywords disappear.
- Every watch has a detail page with the saved text, a before-and-after view of each change,
  whether its email was sent, and the most recent checks.
- Emails for changes (at most one per page every 15 minutes), for a page that cannot be checked
  (after 3 failures in a row), and for recovery.

## How it works

```
Browser  ->  Next.js app  ->  PostgreSQL  <-  Checker  ->  watched pages
                                               |
                                               +-> email (SMTP)
```

The web app and the checker only talk through the database. If the website is down, checking
continues; if the checker is down, the website still works. The checker is a separate program
because Next.js is built for short requests, not a loop that runs forever.

The same checker code runs in two ways:

- **Scheduled job (used in the live deployment):** a GitHub Actions workflow starts every 5 minutes,
  does all the work that is due, and exits (`npm run tick`).
- **Long-running worker:** `npm run worker` loops every 10 seconds. It is what the Docker image
  runs, for hosts that keep a process alive.

One check: load the watch, fetch the page (10 s limit, 2 MB limit, 5 redirects, each one
re-checked), extract the watched part, clean it into plain text, fingerprint it with SHA-256, and
compare with the last snapshot. The first check only saves a baseline. A difference saves a new
snapshot and a change record with the added and removed lines. A separate step then decides
which changes should send an email.

## Design decisions

- **Snapshots are cleaned text, not screenshots.** Scripts, styles and hidden elements are removed,
  so the same visible content always gives the same fingerprint. A new snapshot is saved only
  when the content changed, and only the latest 20 are kept.
- **The first check never sends an email.** There is nothing to compare against, so it silently
  saves a baseline, including the starting state for keyword alerts.
- **"Appear" and "disappear" alerts remember state.** An email goes out only when the keywords
  flip in the requested direction, and it re-arms when they flip back, so a keyword that stays on
  the page does not email on every check. A failed fetch never changes the state.
- **Keywords are plain text, never regular expressions.** Patterns supplied by users and run
  against untrusted pages can be slow and unsafe. Matching ignores case and extra spaces.
- **Two checkers cannot check the same page twice.** A watch is claimed with one atomic database
  update, a lock that expires so a crashed checker cannot block it. The database is the only
  shared state.
- **Email delivery.** Change emails are at-least-once: a crash between sending and marking can
  repeat one email, which I chose over losing an alert. Failure emails are at-most-once, because a
  duplicate "this page is broken" mail is more annoying than useful.
- **Server-side request forgery.** The server fetches user-supplied URLs, so only http(s) on ports
  80 and 443 are allowed, and every resolved IP address must be public. The check runs when a
  watch is created, again before every fetch, at every redirect, and inside the connection's own
  DNS lookup, which closes the gap that DNS rebinding relies on.
- **Accounts.** Passwords use bcrypt. Session and email tokens are random 32-byte values and only
  their SHA-256 hashes are stored. Login, signup and password reset give the same reply whether
  or not an account exists, and login does a fake password comparison for unknown emails so timing
  does not leak. Verification links are consumed by a POST so email scanners cannot use them up.
  Every state-changing request also has its origin checked, and rate limits apply to login,
  signup, reset, resend and watch creation.
- **Everything from a watched page is shown as plain text,** never inserted as HTML.
- **Politeness.** An identifying bot name, a 5-minute minimum interval, a 10-watch cap per user,
  and random spread in check times.
- **Housekeeping.** Old check logs (30 days), old changes (90 days), expired sessions, used email
  tokens and expired rate-limit counters are deleted automatically.

## Known limitations

- It sees what a plain fetch sees. Pages that build their content with JavaScript may look empty,
  and pages that need a login (for example a private chat page) cannot be watched.
- Anything that changes on every load (timestamps, counters) must be excluded with a selector,
  or the page will look changed on every check.
- In the scheduled deployment, checks start within a few minutes of being due, not instantly,
  because GitHub starts scheduled runs late at busy times. "Check now" runs at the next tick.
- One checker handles pages one at a time. Correctness does not depend on this (the lock handles
  it), but throughput does. See the load test below. A queue (Redis with BullMQ) and parallel
  workers are the natural next step.
- No Content-Security-Policy header yet. The other common security headers are set.
- Email goes through a Gmail account for the demo, which has daily sending limits.

## Load test

`scripts/load-test.mjs` creates N watches pointing at a local dummy server and measures how late
a single checker handles them. Lateness is the time between a watch becoming due and being
checked.

| Setup | Watches | Total time | Checks per second | Median lateness | 95th percentile | Slowest |
|---|---|---|---|---|---|---|
| One worker, laptop to a database in Singapore | 300 | 411 s | 0.73 | 180 s | 389 s | 411 s |

Every watch was fetched exactly once (300 requests for 300 watches) and no check failed. Almost
all of the roughly 1.4 s per check is database round trips, so running the checker next to the
database should raise throughput a lot.

## Run it locally

Requires Node 22 and a PostgreSQL database.

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL and the SMTP settings
npx prisma migrate dev
npm run dev                 # the website
npm run worker              # in a second terminal: the long-running checker
# or: npm run tick          # one pass over everything that is due, then exit
```

Environment variables: `DATABASE_URL`, `APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `EMAIL_FROM`. Without SMTP settings, emails are printed to the terminal in
development.

## Tests and CI

```bash
npm test
```

138 tests across 15 files: URL safety, HTML cleaning, diffs, tokens, the origin check, status
logic, the keyword matcher, alert decisions, email texts, cooldown timing, cleanup rules and the
fetcher (against a local server). GitHub Actions runs lint, tests and a production build on every
push, and builds the Docker image.

## Deployment

- **Website:** Vercel (Next.js).
- **Database:** Neon PostgreSQL.
- **Checker:** a scheduled GitHub Actions workflow (`.github/workflows/worker-tick.yml`), every
  5 minutes, using repository secrets.
- **Container:** one Dockerfile runs either the website (`npm start`) or the worker
  (`npm run worker`). `docker-compose.yml` runs both with their own local PostgreSQL. The image
  is built in CI.

## Project layout

```
src/app          pages and API routes (auth, watches, check now, health)
src/components   forms, watch list, controls
src/lib          shared logic: validation, sessions, tokens, rate limits, URL safety, keywords, email
worker/          fetcher, cleaner, differ, alert decisions, notifiers, scheduler, cleanup
prisma/          database schema and migrations
tests/           unit tests
scripts/         API check script and load test
.github/         CI and the scheduled checker
```

## Stack

Next.js (App Router), PostgreSQL with Prisma, a Node worker, bcrypt, Zod, cheerio, undici,
Nodemailer, Vitest, Docker, GitHub Actions, Vercel, Neon.
