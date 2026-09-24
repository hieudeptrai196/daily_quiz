// Webhook Telegram. Luôn trả 200 (trừ sai secret) để Telegram không gửi lại update.

import { safeEqual } from '../lib/auth.js';
import { handleMessage } from '../lib/commands.js';
import { handlePollAnswer } from '../lib/quiz.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const got = req.headers['x-telegram-bot-api-secret-token'] || '';
  if (!secret || !safeEqual(got, secret)) return res.status(401).json({ ok: false });

  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (update.poll_answer) await handlePollAnswer(update.poll_answer);
    else if (update.message) await handleMessage(update.message);
  } catch (err) {
    console.error(`[webhook] lỗi: ${String(err?.message || err).split('\n')[0]}`);
  }
  return res.status(200).json({ ok: true });
}
