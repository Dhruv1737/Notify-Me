import { prisma } from "@/lib/db";
import { forgotSchema } from "@/lib/validation";
import { isSameOrigin, getIp } from "@/lib/origin";
import { isBlocked, recordHit } from "@/lib/rateLimit";
import { randomToken, hashToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { resetEmail } from "@/lib/emailTemplates";

const SAME_REPLY = {
  message: "If an account exists for this email, we have sent a link to reset the password.",
};
const HOUR = 60 * 60 * 1000;

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid email." }, { status: 400 });
  }
  const { email } = parsed.data;

  const ipKey = `forgot:ip:${getIp(request)}`;
  const emailKey = `forgot:email:${email}`;
  if ((await isBlocked(ipKey, 5)) || (await isBlocked(emailKey, 3))) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  // Counted for every email, real or not, so the limit reveals nothing.
  await recordHit(ipKey, HOUR);
  await recordHit(emailKey, HOUR);

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    await prisma.emailToken.deleteMany({
      where: { userId: user.id, type: "reset", usedAt: null },
    });

    const token = randomToken();
    await prisma.emailToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        type: "reset",
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    try {
      const msg = resetEmail(`${process.env.APP_URL}/reset-password?token=${token}`);
      await sendEmail({ to: email, ...msg });
    } catch (err) {
      console.error("Email failed:", err.message);
    }
  }

  return Response.json(SAME_REPLY);
}