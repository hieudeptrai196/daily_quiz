import { timingSafeEqual } from 'node:crypto';

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// Vercel Cron gửi header "Authorization: Bearer <CRON_SECRET>"
export function isCronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers?.authorization || '';
  return safeEqual(header, `Bearer ${secret}`);
}
