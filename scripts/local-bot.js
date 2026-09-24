// Chạy TOÀN BỘ luồng bot ở local, không cần deploy: LLM thật + Telegram thật, nhận vote/lệnh bằng
// long polling (getUpdates) thay cho webhook, trạng thái lưu trong bộ nhớ.
//   npm run local-bot                      # gửi đủ 6 câu, chỉ mình admin là người chơi
//   npm run local-bot -- --slots 0,2       # chỉ gửi vài câu (công bố bằng /reveal)
//   npm run local-bot -- --all-members     # giữ nguyên MEMBERS trong .env
// Chỉ chạy được khi bot CHƯA set webhook (Telegram không cho getUpdates khi có webhook).
// Ctrl+C để dừng. Trạng thái mất khi dừng.
process.env.ALLOW_MEMORY_STORE = '1';
delete process.env.TELEGRAM_MOCK;
delete process.env.GEMINI_MOCK;

const argv = process.argv.slice(2);
const argValue = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};

const { TOPICS, getAdminIds, getChatId, getMembers, getModelLabel } = await import('../lib/config.js');

// ----- Người chơi: mặc định chỉ admin đầu tiên -----
if (!argv.includes('--all-members')) {
  const adminId = [...getAdminIds()][0];
  if (!adminId) {
    console.error('❌ Cần ADMIN_IDS trong .env (hoặc dùng --all-members)');
    process.exit(1);
  }
  const me = getMembers().find((m) => m.id === adminId) || { id: adminId, name: 'Admin' };
  process.env.MEMBERS = `${me.id}:${me.name}`;
}
if (!getChatId()) {
  console.error('❌ Thiếu TELEGRAM_CHAT_ID trong .env');
  process.exit(1);
}

const slots = (argValue('--slots') ?? TOPICS.map((t) => t.slot).join(','))
  .split(',')
  .map(Number)
  .filter((n) => Number.isInteger(n) && n >= 0 && n < TOPICS.length);

const { tg } = await import('../lib/telegram.js');
const { handlePollAnswer, retryFailedSlots, sendQuestion } = await import('../lib/quiz.js');
const { handleMessage } = await import('../lib/commands.js');
const { dayKey } = await import('../lib/time.js');

const info = await tg('getWebhookInfo');
if (info.url) {
  console.error(`❌ Bot đang có webhook (${info.url}). Local bot chỉ chạy khi chưa set webhook.`);
  process.exit(1);
}

console.log(`Model: ${getModelLabel()} — chat ${getChatId()} — ngày ${dayKey()}`);
console.log(`Người chơi: ${getMembers().map((m) => m.name).join(', ')}`);
console.log(`Sẽ gửi câu: ${slots.map((s) => s + 1).join(', ')}${slots.length < 6 ? ' (chưa đủ 6 câu → dùng /reveal để công bố)' : ''}`);
console.log('Lệnh trong group: /status /reveal /help — Ctrl+C để dừng.\n');

// Bỏ qua update cũ
let offset = 0;
const old = await tg('getUpdates', { offset: -1, timeout: 0 });
if (old.length) offset = old[old.length - 1].update_id + 1;

let stopping = false;
process.on('SIGINT', () => {
  console.log('\nDừng local bot.');
  stopping = true;
  process.exit(0);
});

async function pollLoop() {
  while (!stopping) {
    let updates = [];
    try {
      updates = await tg('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'poll_answer'] });
    } catch (err) {
      console.error(`[poll] lỗi getUpdates: ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    for (const u of updates) {
      offset = u.update_id + 1;
      try {
        if (u.poll_answer) {
          const r = await handlePollAnswer(u.poll_answer);
          console.log(`[vote] ${JSON.stringify(r)}`);
          if (r.revealed) console.log('🎉 Đã tự công bố đáp án. Có thể thử /status, rồi Ctrl+C để dừng.');
        } else if (u.message) {
          const r = await handleMessage(u.message);
          if (!r.ignored) console.log(`[cmd] ${JSON.stringify(r)}`);
        }
      } catch (err) {
        console.error(`[update] lỗi: ${String(err?.message || err).split('\n')[0]}`);
      }
    }
  }
}

async function sendLoop() {
  for (const slot of slots) {
    try {
      const r = await sendQuestion(slot);
      console.log(`[send] ${JSON.stringify(r)}`);
    } catch (err) {
      console.error(`[send] slot=${slot} lỗi: ${err.message}`);
    }
  }
  // Giống cron thật: thử lại câu lỗi
  for (const r of await retryFailedSlots(dayKey())) console.log(`[retry] ${JSON.stringify(r)}`);
  console.log('✅ Đã gửi xong các câu. Vào group vote nhé.');
}

await Promise.all([pollLoop(), sendLoop()]);
