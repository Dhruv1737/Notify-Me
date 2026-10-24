import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isSameOrigin } from "@/lib/origin";
import { isBlocked, recordHit } from "@/lib/rateLimit";
import { randomToken, hashToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { verifyEmail } from "@/lib/emailTemplates";

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not logged in" }, { status: 401 });
  }
  if (user.verifiedAt) {
    return Response.json({ error: "Email is already verified." }, { status: 400 });
  }

  const minKey = `resend:min:${user.id}`;
  const dayKey = `resend:day:${user.id}`;

  if (await isBlocked(minKey, 1)) {
    return Response.json({ error: "Wait a minute before asking again." }, { status: 429 });
  }
  if (await isBlocked(dayKey, 5)) {
    return Response.json({ error: "Daily limit reached. Try again tomorrow." }, { status: 429 });
  }
  await recordHit(minKey, 60 * 1000);
  await recordHit(dayKey, 24 * 60 * 60 * 1000);

  // Old unused verify links stop working.
  await prisma.emailToken.deleteMany({
    where: { userId: user.id, type: "verify", usedAt: null },
  });

  const token = randomToken();
  await prisma.emailToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      type: "verify",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  try {
    const msg = verifyEmail(`${process.env.APP_URL}/verify?token=${token}`);
    await sendEmail({ to: user.email, ...msg });
  } catch (err) {
    console.error("Email failed:", err.message);
  }

  return Response.json({ message: "We sent a new link." });
}