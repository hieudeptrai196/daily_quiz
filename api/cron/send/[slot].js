// Cron gửi câu hỏi: /api/cron/send/0 ... /api/cron/send/5
// Gửi câu của slot này trước, sau đó dùng thời gian còn lại để thử lại các câu lỗi trước đó trong ngày.

import { isCronAuthorized } from '../../../lib/auth.js';
import { retryFailedSlots, sendQuestion } from '../../../lib/quiz.js';
import { dayKey } from '../../../lib/time.js';

const FUNCTION_BUDGET_MS = 280_000; // maxDuration 300s, chừa 20s

export default async function handler(req, res) {
  const startedAt = Date.now();
  if (!isCronAuthorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const slot = Number(req.query.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot > 5) {
    return res.status(400).json({ ok: false, error: 'slot phải là 0-5' });
  }

  try {
    // Kết quả chỉ gồm trạng thái/pollId, không chứa nội dung câu hỏi hay đáp án
    const day = dayKey();
    const result = await sendQuestion(slot, { day });
    const retried = await retryFailedSlots(day, { deadline: startedAt + FUNCTION_BUDGET_MS, beforeSlot: slot });
    return res.status(200).json({ ...result, retried });
  } catch (err) {
    console.error(`[cron/send/${slot}] lỗi: ${String(err?.message || err).split('\n')[0]}`);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
}
