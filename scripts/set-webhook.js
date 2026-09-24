// Đăng ký webhook + danh sách lệnh cho bot. Chạy ở local: npm run set-webhook
import { COMMANDS } from '../lib/commands.js';
import { tg } from '../lib/telegram.js';

const publicUrl = String(process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ Thiếu TELEGRAM_BOT_TOKEN trong .env');
  process.exit(1);
}
if (!/^https:\/\//.test(publicUrl)) {
  console.error('❌ PUBLIC_URL phải là https://..., ví dụ https://ten-app.vercel.app');
  process.exit(1);
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  console.error('❌ TELEGRAM_WEBHOOK_SECRET chỉ được gồm A-Z a-z 0-9 _ - (1-256 ký tự)');
  process.exit(1);
}

try {
  const url = `${publicUrl}/api/telegram`;
  await tg('setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'poll_answer'],
    drop_pending_updates: true,
  });
  console.log(`✅ setWebhook: ${url}`);

  await tg('setMyCommands', { commands: COMMANDS });
  console.log(`✅ setMyCommands: ${COMMANDS.map((c) => `/${c.command}`).join(' ')}`);

  const info = await tg('getWebhookInfo');
  console.log('ℹ️  getWebhookInfo:');
  console.log(JSON.stringify(info, null, 2));
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
