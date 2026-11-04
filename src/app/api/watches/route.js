import { prisma } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth";
import { createWatchSchema } from "@/lib/validation";
import { checkUrl } from "@/lib/urlSafety";
import { isSameOrigin } from "@/lib/origin";
import { isBlocked, recordHit } from "@/lib/rateLimit";
import { MAX_WATCHES_PER_USER } from "@/lib/constants";

export async function GET() {
  const { user, error } = await requireVerifiedUser();
  if (error) return error;

  const watches = await prisma.watch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ watches });
}

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { user, error } = await requireVerifiedUser();
  if (error) return error;

  // Each create triggers a DNS lookup, so limit how fast a user can try.
  const rateKey = `watch:create:${user.id}`;
  if (await isBlocked(rateKey, 20)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  await recordHit(rateKey, 60 * 60 * 1000);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = createWatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  const check = await checkUrl(data.url);
  if (!check.ok) {
    return Response.json({ error: check.reason }, { status: 400 });
  }

  // Count and insert in one serializable transaction, so two requests
  // sent at the same moment can't both slip past the cap.
  let created;
  try {
    created = await prisma.$transaction(
      async (tx) => {
        const count = await tx.watch.count({ where: { userId: user.id } });
        if (count >= MAX_WATCHES_PER_USER) return null;
        return tx.watch.create({
          data: {
            userId: user.id,
            url: check.url,
            name: data.name,
            selector: data.selector,
            intervalMinutes: data.intervalMinutes,
            alertsEnabled: data.alertsEnabled,
            alertMode: data.alertMode,
            keywords: data.keywords,
            matchMode: data.matchMode,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (err) {
    if (err.code === "P2034") {
      return Response.json({ error: "Please try again." }, { status: 409 });
    }
    throw err;
  }

  if (!created) {
    return Response.json(
      { error: `You can watch up to ${MAX_WATCHES_PER_USER} pages.` },
      { status: 403 }
    );
  }

  return Response.json({ watch: created }, { status: 201 });
}