// Gọi Telegram Bot API trực tiếp bằng fetch.
// TELEGRAM_MOCK=1: không gọi mạng, in ra những gì bot sẽ gửi và trả về id giả (dùng cho harness).
// TELEGRAM_MOCK_QUIET=1: mock không in gì.

export class TelegramError extends Error {
  constructor(method, code, description) {
    super(`Telegram ${method} lỗi ${code}: ${description}`);
    this.method = method;
    this.code = code;
    this.description = String(description || '');
  }
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const mock = {
  calls: [],
  nextMessageId: 1000,
  nextPollId: 1,
  reset() {
    this.calls = [];
  },
};

function mockPrint(method, payload, result) {
  if (process.env.TELEGRAM_MOCK_QUIET === '1') return;
  const line = '─'.repeat(60);
  if (method === 'sendPoll') {
    const opts = payload.options.map((o) => `   ○ ${o.text}`).join('\n');
    console.log(`${line}\n[mock → sendPoll #${result.message_id} poll=${result.poll.id}]\n${payload.question}\n${opts}`);
  } else if (method === 'sendMessage') {
    console.log(`${line}\n[mock → sendMessage #${result.message_id}]\n${payload.text}`);
  } else if (method === 'editMessageText') {
    console.log(`${line}\n[mock → editMessageText #${payload.message_id}]\n${payload.text}`);
  } else {
    console.log(`[mock → ${method}] ${JSON.stringify(payload)}`);
  }
}

function mockCall(method, payload) {
  let result = true;
  if (method === 'sendMessage') {
    result = { message_id: mock.nextMessageId++, chat: { id: payload.chat_id }, text: payload.text };
  } else if (method === 'sendPoll') {
    result = {
      message_id: mock.nextMessageId++,
      chat: { id: payload.chat_id },
      poll: { id: `mockpoll${mock.nextPollId++}`, question: payload.question },
    };
  } else if (method === 'stopPoll') {
    result = { id: 'stopped', is_closed: true };
  } else if (method === 'getWebhookInfo') {
    result = { url: '' };
  }
  mock.calls.push({ method, payload, result });
  mockPrint(method, payload, result);
  return result;
}

export async function tg(method, payload = {}) {
  if (process.env.TELEGRAM_MOCK === '1') return mockCall(method, payload);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Thiếu TELEGRAM_BOT_TOKEN');

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({ ok: false, error_code: res.status, description: res.statusText }));
    if (data.ok) return data.result;

    const retryAfter = data.parameters?.retry_after;
    if (data.error_code === 429 && attempt === 0 && retryAfter && retryAfter <= 10) {
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }
    throw new TelegramError(method, data.error_code, data.description);
  }
}

export function sendMessage(chatId, text, extra = {}) {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

export function editMessage(chatId, messageId, text, extra = {}) {
  return tg('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

export function isNotModified(err) {
  return /message is not modified/i.test(err?.description || err?.message || '');
}

export function isMessageMissing(err) {
  return /message to edit not found|message to delete not found|message can't be edited|MESSAGE_ID_INVALID/i.test(
    err?.description || err?.message || '',
  );
}
