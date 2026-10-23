import { prisma } from "./db.js";

// True if this key has already reached the limit inside its window.
export async function isBlocked(key, max) {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  return !!row && row.resetAt > new Date() && row.count >= max;
}

// Count one hit. Starts a fresh window if the old one expired.
export async function recordHit(key, windowMs) {
  const now = new Date();
  await prisma.rateLimit.deleteMany({ where: { key, resetAt: { lt: now } } });
  await prisma.rateLimit.upsert({
    where: { key },
    create: { key, count: 1, resetAt: new Date(now.getTime() + windowMs) },
    update: { count: { increment: 1 } },
  });
}

export async function clearHits(key) {
  await prisma.rateLimit.deleteMany({ where: { key } });
}