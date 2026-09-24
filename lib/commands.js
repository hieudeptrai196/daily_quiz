// Lệnh chat: /status /myid /chatid /reveal /help

import { getAdminIds, getChatId } from './config.js';
import { getProgressText, tryReveal } from './quiz.js';
import { escapeHtml, sendMessage } from './telegram.js';
import { dayKey, formatDay } from './time.js';

export const COMMANDS = [
  { command: 'status', description: 'Xem tiến độ làm bài hôm nay' },
  { command: 'reveal', description: '(Admin) Công bố đáp án ngay' },
  { command: 'myid', description: 'Xem user ID của bạn' },
  { command: 'chatid', description: 'Xem ID của chat này' },
  { command: 'help', description: 'Hướng dẫn' },
];

const HELP_TEXT = [
  '🤖 <b>Daily Quiz</b>',
  'Mỗi ngày 6 câu trắc nghiệm lúc 8h, 10h, 12h, 14h, 16h, 18h.',
  'Chỉ lần vote <b>đầu tiên</b> được tính, đổi vote sau đó không có tác dụng.',
  'Đáp án được công bố khi mọi người làm đủ tất cả câu, muộn nhất 23:00.',
  '',
  '/status — tiến độ hôm nay',
  '/reveal — (admin) công bố đáp án ngay',
  '/myid — xem user ID',
  '/chatid — xem chat ID',
].join('\n');

// "/status@TenBot arg" -> "status"
export function parseCommand(text) {
  const m = /^\/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\s|$)/.exec(String(text || '').trim());
  return m ? m[1].toLowerCase() : null;
}

export async function handleMessage(msg) {
  const cmd = parseCommand(msg?.text);
  if (!cmd) return { ignored: 'not-command' };
  const chatId = msg.chat.id;
  const reply = (text) => sendMessage(chatId, text, { reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true } });

  // Chạy được ở mọi chat, kể cả khi chưa cấu hình TELEGRAM_CHAT_ID / MEMBERS
  if (cmd === 'myid') {
    const u = msg.from || {};
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || '';
    await reply(`👤 ${escapeHtml(name)}\nUser ID: <code>${u.id}</code>`);
    return { handled: cmd };
  }
  if (cmd === 'chatid') {
    await reply(`💬 Chat ID: <code>${chatId}</code>`);
    return { handled: cmd };
  }

  if (!getChatId() || String(chatId) !== getChatId()) return { ignored: 'wrong-chat' };

  if (cmd === 'status') {
    await reply(await getProgressText(dayKey()));
    return { handled: cmd };
  }
  if (cmd === 'reveal') {
    if (!getAdminIds().has(String(msg.from?.id))) {
      await reply('⛔ Chỉ admin mới dùng được /reveal.');
      return { handled: cmd, denied: true };
    }
    const day = dayKey();
    const r = await tryReveal(day, { force: true });
    if (!r.revealed) {
      const why = r.reason === 'already-revealed'
        ? `Đáp án ngày ${formatDay(day)} đã được công bố rồi.`
        : `Hôm nay (${formatDay(day)}) chưa có câu nào được gửi.`;
      await reply(`ℹ️ ${why}`);
    }
    return { handled: cmd, ...r };
  }
  if (cmd === 'help' || cmd === 'start') {
    await reply(HELP_TEXT);
    return { handled: cmd };
  }
  return { ignored: 'unknown-command' };
}
