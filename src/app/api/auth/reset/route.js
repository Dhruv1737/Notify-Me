import { prisma } from "@/lib/db";
import { resetSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { hashToken } from "@/lib/tokens";
import { isSameOrigin, getIp } from "@/lib/origin";
import { isBlocked, recordHit } from "@/lib/rateLimit";

const INVALID = { error: "This link is invalid or has expired." };

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const ipKey = `reset:ip:${getIp(request)}`;
  if (await isBlocked(ipKey, 10)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  await recordHit(ipKey, 60 * 60 * 1000);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(INVALID, { status: 400 });
  }

  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Choose a password of 8 to 72 characters." },
      { status: 400 }
    );
  }
  const { token, password } = parsed.data;

  const record = await prisma.emailToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record || record.type !== "reset" || record.usedAt || record.expiresAt < new Date()) {
    return Response.json(INVALID, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  // Claim the token so it can only be used once.
  const claimed = await prisma.emailToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) {
    return Response.json(INVALID, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    // A reset logs the user out everywhere.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  return Response.json({ ok: true });
}