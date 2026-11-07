import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import Header from "@/components/Header";
import WatchControls from "@/components/WatchControls";
import LocalTime from "@/components/LocalTime";
import { STATUS, INTERVAL_LABEL, MODE_LABEL } from "@/lib/watchLabels";

const MAX_SHOWN_CHARS = 20_000;

function Time({ date }) {
  return date ? <LocalTime iso={date.toISOString()} /> : "Not yet";
}

const DAY_MS = 24 * 60 * 60 * 1000;

// What happened with the email for one change.
function alertStatus(change, mode) {
  if (change.emailedAt) return { text: "Email sent", time: change.emailedAt };
  if (change.alertable) {
    return Date.now() - change.createdAt.getTime() > DAY_MS
      ? { text: "No alert sent. The email could not be delivered in time." }
      : { text: "Email waiting to be sent (at most one email every 15 minutes)" };
  }
  return {
    text:
      mode === "PAGE_CHANGES"
        ? "No alert sent. Emails were off."
        : "No alert sent. Emails were off, or the change did not match your keywords.",
  };
}

export default async function WatchPage({ params }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.verifiedAt) redirect("/check-inbox");

  // Ownership lives in the query: someone else's watch is just "not found".
  const watch = await prisma.watch.findFirst({ where: { id, userId: user.id } });
  if (!watch) notFound();

  const [snapshot, changes, logs] = await Promise.all([
    prisma.snapshot.findFirst({
      where: { watchId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.change.findMany({
      where: { watchId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.checkLog.findMany({
      where: { watchId: id },
      orderBy: { checkedAt: "desc" },
      take: 10,
    }),
  ]);

  const s = STATUS[watch.status] || STATUS.PENDING;
  const usesKeywords = watch.alertMode !== "PAGE_CHANGES";
  const shownText =
    snapshot && snapshot.content.length > MAX_SHOWN_CHARS
      ? `${snapshot.content.slice(0, MAX_SHOWN_CHARS)}…`
      : snapshot?.content;

  return (
    <>
      <Header email={user.email} />
      <main>
        <Link className="back" href="/dashboard">Back to dashboard</Link>
        <h1 style={{ wordBreak: "break-all" }}>{watch.name || watch.url}</h1>

        {watch.warning && <p className="warning">{watch.warning}</p>}
        {watch.status === "ERROR" && watch.lastError && (
          <p className="error">The last check failed: {watch.lastError}</p>
        )}

        <dl className="facts">
          <div><dt>Address</dt><dd>{watch.url}</dd></div>
          <div><dt>Last email</dt><dd><Time date={watch.lastAlertAt} /></dd></div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`dot ${s.cls}`} />{s.label}
              {watch.status === "PENDING" && " · Taking the first snapshot"}
            </dd>
          </div>
          <div><dt>Checks</dt><dd>{INTERVAL_LABEL[watch.intervalMinutes] || `${watch.intervalMinutes} minutes`}</dd></div>
          <div><dt>Last checked</dt><dd><Time date={watch.lastCheckedAt} /></dd></div>
          <div>
            <dt>Next check</dt>
            <dd>{watch.status === "PAUSED" ? "Paused" : <Time date={watch.nextCheckAt} />}</dd>
          </div>
          <div><dt>Last changed</dt><dd><Time date={watch.lastChangedAt} /></dd></div>
          {watch.selector && <div><dt>Watching</dt><dd>{watch.selector}</dd></div>}
          <div>
            <dt>Emails</dt>
            <dd>{watch.alertsEnabled ? `When ${MODE_LABEL[watch.alertMode]}` : "Off"}</dd>
          </div>
          {usesKeywords && (
            <div>
              <dt>Keywords</dt>
              <dd>{watch.keywords.join(", ")} ({watch.matchMode === "ALL" ? "all" : "any"})</dd>
            </div>
          )}
        </dl>

        <WatchControls id={watch.id} status={watch.status} alertsEnabled={watch.alertsEnabled} />

                <section className="section">
          <h2>Changes</h2>
          {changes.length === 0 ? (
            <p className="muted">
              {snapshot ? "No changes since the first snapshot." : "Waiting for the first snapshot."}
            </p>
          ) : (
            changes.map((c) => {
              const alert = alertStatus(c, watch.alertMode);
              return (
                <div className="change" key={c.id}>
                  <p className="muted">
                    <Time date={c.createdAt} />
                    {" · "}
                    {alert.text}
                    {alert.time && <> · <Time date={alert.time} /></>}
                  </p>
                  {c.matchedKeywords.length > 0 && (
                    <p className="muted">Matched: {c.matchedKeywords.join(", ")}</p>
                  )}
                  {c.removed.map((line, i) => (
                    <div className="diff-line remove" key={`r${i}`}>− {line}</div>
                  ))}
                  {c.added.map((line, i) => (
                    <div className="diff-line add" key={`a${i}`}>+ {line}</div>
                  ))}
                  {c.truncated && <p className="muted">Only the first 200 lines are shown.</p>}
                </div>
              );
            })
          )}
        </section>

        <section className="section">
          <h2>Changes</h2>
          {changes.length === 0 ? (
            <p className="muted">
              {snapshot ? "No changes since the first snapshot." : "Waiting for the first snapshot."}
            </p>
          ) : (
            changes.map((c) => (
              <div className="change" key={c.id}>
                <p className="muted"><Time date={c.createdAt} /></p>
                {c.removed.map((line, i) => (
                  <div className="diff-line remove" key={`r${i}`}>− {line}</div>
                ))}
                {c.added.map((line, i) => (
                  <div className="diff-line add" key={`a${i}`}>+ {line}</div>
                ))}
                {c.truncated && <p className="muted">Only the first 200 lines are shown.</p>}
              </div>
            ))
          )}
        </section>

        <section className="section">
          <h2>Recent checks</h2>
          {logs.length === 0 ? (
            <p className="muted">No checks yet.</p>
          ) : (
            logs.map((l) => (
              <div className="watch-meta" key={l.id}>
                <Time date={l.checkedAt} />
                {" · "}
                {l.success ? (l.changed ? "Changed" : "No change") : `Failed: ${l.error}`}
                {l.statusCode ? ` · ${l.statusCode}` : ""}
                {` · ${l.durationMs} ms`}
              </div>
            ))
          )}
        </section>
      </main>
    </>
  );
}