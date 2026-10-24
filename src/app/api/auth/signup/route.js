import { prisma } from "@/lib/db";
import { signupSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { isSameOrigin, getIp } from "@/lib/origin";
import { isBlocked, recordHit } from "@/lib/rateLimit";
import { randomToken, hashToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { verifyEmail, accountExistsEmail } from "@/lib/emailTemplates";

const SAME_REPLY = {
  message: "If this email can be used, we have sent a link to verify it.",
};

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const ipKey = `signup:ip:${getIp(request)}`;
  if (await isBlocked(ipKey, 5)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  await recordHit(ipKey, 60 * 60 * 1000);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Enter a valid email and a password of 8 to 72 characters." },
      { status: 400 }
    );
  }
  const { email, password } = parsed.data;

  // Hash first, so new and existing emails take about the same time.
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    try {
      const msg = accountExistsEmail(`${process.env.APP_URL}/login`);
      await sendEmail({ to: email, ...msg });
    } catch (err) {
      console.error("Email failed:", err.message);
    }
    return Response.json(SAME_REPLY);
  }

  const user = await prisma.user.create({ data: { email, passwordHash } });

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
    await sendEmail({ to: email, ...msg });
  } catch (err) {
    console.error("Email failed:", err.message);
  }

  return Response.json(SAME_REPLY);
}