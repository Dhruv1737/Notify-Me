import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { verifyPassword, fakeCompare } from "@/lib/password";
import { createSession } from "@/lib/session";
import { isSameOrigin, getIp } from "@/lib/origin";
import { isBlocked, recordHit, clearHits } from "@/lib/rateLimit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

function genericFailure() {
  return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
}

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return genericFailure();
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return genericFailure();
  const { email, password } = parsed.data;

  const emailKey = `login:email:${email}`;
  const ipKey = `login:ip:${getIp(request)}`;

  if ((await isBlocked(emailKey, MAX_FAILURES)) || (await isBlocked(ipKey, MAX_FAILURES))) {
    return Response.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await fakeCompare(password);
    await recordHit(emailKey, WINDOW_MS);
    await recordHit(ipKey, WINDOW_MS);
    return genericFailure();
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await recordHit(emailKey, WINDOW_MS);
    await recordHit(ipKey, WINDOW_MS);
    return genericFailure();
  }

  await clearHits(emailKey);
  await createSession(user.id);
  return Response.json({ ok: true, verified: !!user.verifiedAt });
}