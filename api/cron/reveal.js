// Cron 23:00 giờ VN: công bố bắt buộc

import { isCronAuthorized } from '../../lib/auth.js';
import { tryReveal } from '../../lib/quiz.js';
import { dayKey } from '../../lib/time.js';

export default async function handler(req, res) {
  if (!isCronAuthorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

  try {
    const result = await tryReveal(dayKey(), { force: true });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error(`[cron/reveal] lỗi: ${String(err?.message || err).split('\n')[0]}`);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
}
