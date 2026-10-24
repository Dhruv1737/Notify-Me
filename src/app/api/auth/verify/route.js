import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { isSameOrigin } from "@/lib/origin";

const INVALID = { error: "This link is invalid or has expired." };

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let token;
  try {
    ({ token } = await request.json());
  } catch {
    return Response.json(INVALID, { status: 400 });
  }
  if (typeof token !== "string" || token.length < 10 || token.length > 200) {
    return Response.json(INVALID, { status: 400 });
  }

  const record = await prisma.emailToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.type !== "verify" || record.usedAt || record.expiresAt < new Date()) {
    return Response.json(INVALID, { status: 400 });
  }

  // Claim the token atomically so it can only be used once.
  const claimed = await prisma.emailToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) {
    return Response.json(INVALID, { status: 400 });
  }

  await prisma.user.update({
    where: { id: record.userId },
    data: { verifiedAt: new Date() },
  });

  return Response.json({ ok: true });
}