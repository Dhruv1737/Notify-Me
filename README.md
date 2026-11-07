# Change Detector

Paste a link, and Change Detector opens that page on a schedule in the background.
When the page changes in a way you care about, it emails you what changed.
Typical uses: a college notice board, a results page, a product that might come back in stock.

## What it does

- Sign up with email and password, verify your email, log in.
- Watch up to 10 pages. Choose how often to check (5 minutes to a day) and which part of the page to watch (CSS selector).
- Four alert types: the page changes, a new line contains your keywords, keywords appear, keywords disappear.
- Each watch has a detail page with the saved text, a before-and-after view of every change, and recent check results.
- Emails for changes (at most one per page every 15 minutes), for a page that cannot be checked, and for recovery.

## How it works

```
Browser  ->  Next.js app  ->  PostgreSQL  <-  Worker  ->  watched pages
                                               |
                                               +-> email (SMTP)
```

The web app and the worker only talk through the database. If the website is down, checking
continues; if the worker is down, the website still works. The worker is a separate program
because Next.js is built for short requests, not a loop that runs forever.

One check: load the watch, fetch the page (10 s limit, 2 MB limit, 5 redirects, each one re-checked),
extract the watched part, clean it into plain text, fingerprint it with SHA-256, and compare with
the last snapshot. The first check only saves a baseline. A difference saves a new snapshot and a
change record with the added and removed lines.

## Design decisions

- **Snapshots are cleaned text, not screenshots.** Scripts, styles and hidden elements are removed,
  so the same visible content always gives the same fingerprint. A new snapshot is saved only when
  the content changed, and only the latest 20 are kept.
- **The first check never sends an email.** There is nothing to compare against, so it silently
  saves a baseline, including the starting state for keyword alerts.
- **Keyword alerts for "appear" and "disappear" remember state.** An email goes out only when the
  condition flips in the requested direction, and it re-arms when it flips back, so a keyword that
  stays on the page does not email on every check. A failed fetch never changes the state.
- **Plain-text keywords only, no regular expressions.** Patterns from users on untrusted pages
  can be slow and unsafe.
- **Two workers cannot check the same page twice.** A watch is claimed with one atomic database
  update (a lock that expires, so a crashed worker cannot block it). The database is the only
  shared state.
- **Alert delivery.** Change emails are at-least-once: a crash between sending and marking can
  repeat one email, which I chose over losing an alert. Failure emails are at-most-once, because a
  duplicate "this page is broken" mail is more annoying than useful.
- **Server-side request forgery.** The server fetches user-supplied URLs, so only http(s) on ports
  80 and 443 are allowed, and every resolved IP address must be public. The check runs when a
  watch is created, again before every fetch, at every redirect, and inside the connection's own
  DNS lookup, which closes the gap that DNS rebinding relies on.
- **Accounts.** Passwords use bcrypt. Session and email tokens are random 32-byte values and only
  their SHA-256 hashes are stored. Login, signup and reset give the same reply whether or not an
  account exists, and login does a fake password comparison for unknown emails so timing does not
  leak. Verification links are consumed by a POST so email scanners cannot use them up.
- **Everything from a watched page is shown as plain text,** never inserted as HTML.
- **Politeness.** An identifying bot name, a 5-minute minimum interval, a 10-watch cap per user,
  and random spread in check times.

## Known limitations

- It sees what a plain fetch sees. Pages that build their content with JavaScript may look empty.
- It cannot watch pages that need a login.
- Anything that changes on every load (timestamps, counters) must be excluded with a selector.
- One worker checks pages one at a time. Correctness does not depend on this (the lock handles it),
  but throughput does. See the load test below. A queue (Redis with BullMQ) and parallel workers
  are the natural next step.
- No Content-Security-Policy header yet. Other security headers are set.

## Load test

`scripts/load-test.mjs` creates N watches pointing at a local dummy server and measures how late
the worker checks them (single worker, remote Postgres).

| Watches | Total time | Checks per second | Median lateness | 95th percentile | Slowest |
|---|---|---|---|---|---|
| 300 | _fill in_ | _fill in_ | _fill in_ | _fill in_ | _fill in_ |
| 1000 | _fill in_ | _fill in_ | _fill in_ | _fill in_ | _fill in_ |

## Run it locally

Requires Node 22 and a PostgreSQL database.

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL and the SMTP settings
npx prisma migrate dev
npm run dev                 # the website
npm run worker              # in a second terminal: the checker
```

Or with Docker (own local Postgres): `docker compose up --build`.

## Tests

```bash
npm test
```

Covers URL safety, HTML cleaning, diffs, tokens, the origin check, status logic, the keyword
matcher, alert decisions, email texts, cooldown timing and the fetcher (against a local server).

## Stack

Next.js (App Router), PostgreSQL with Prisma, a Node worker, bcrypt, Zod, cheerio, undici,
Nodemailer, Vitest, Docker, GitHub Actions.