// Luồng chính: gửi câu hỏi, nhận vote, message tiến độ, công bố đáp án.
// Không log/in đáp án ở bất kỳ đâu trước khi công bố.

import {
  POLL_OPTION_MAX,
  POLL_QUESTION_MAX,
  QUESTIONS_PER_DAY,
  TOPICS,
  getChatId,
  getMembers,
  questionHeader as header,
} from './config.js';
import { fitsInPoll, generateVerifiedQuestion, LETTERS, summarizeReasons } from './gemini.js';
import { getStore } from './store.js';
import {
  TelegramError,
  editMessage,
  escapeHtml,
  isMessageMissing,
  isNotModified,
  sendMessage,
  tg,
} from './telegram.js';
import { dayKey, formatDay, weekKey } from './time.js';

const DAY_TTL = 8 * 24 * 60 * 60; // 8 ngày
const SCORE_TTL = 60 * 24 * 60 * 60; // điểm tuần giữ 60 ngày
const SEND_LOCK_TTL = 330; // > maxDuration 300s; sau khi gửi xong thì set "sent" chặn gửi trùng
const HISTORY_SIZE = 60;
const MESSAGE_LIMIT = 3800;

export const keys = {
  q: (day, slot) => `quiz:${day}:q:${slot}`,
  poll: (pollId) => `quiz:poll:${pollId}`,
  sent: (day) => `quiz:${day}:sent`,
  failed: (day) => `quiz:${day}:failed`,
  votes: (day, slot) => `quiz:${day}:votes:${slot}`,
  sendLock: (day, slot) => `quiz:${day}:sendlock:${slot}`,
  failReason: (day, slot) => `quiz:${day}:failreason:${slot}`,
  revealed: (day) => `quiz:${day}:revealed`,
  progress: (day) => `quiz:${day}:progress`,
  history: (topicKey) => `quiz:history:${topicKey}`,
  score: (week) => `quiz:score:${week}`,
};

function truncate(text, max) {
  const s = String(text);
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// Lý do lỗi để báo trong group; không bao giờ chứa nội dung đề/đáp án
function describeFailure(err) {
  if (Array.isArray(err?.reasons) && err.reasons.length) {
    const n = err.reasons.length;
    return `${n} lần thử đều hỏng: ${summarizeReasons(err.reasons)}`;
  }
  if (err instanceof TelegramError && err.migrateToChatId) {
    return `group đã được nâng cấp lên supergroup, cần đổi TELEGRAM_CHAT_ID thành ${err.migrateToChatId} rồi redeploy`;
  }
  if (err instanceof TelegramError) return `Telegram từ chối gửi (${err.code}: ${err.description})`;
  return `lỗi hệ thống: ${String(err?.message || err).split('\n')[0].slice(0, 150)}`;
}

function requireChatId() {
  const chatId = getChatId();
  if (!chatId) throw new Error('Thiếu TELEGRAM_CHAT_ID');
  return chatId;
}

function toSlots(list) {
  return [...new Set((list || []).map(Number).filter((n) => Number.isInteger(n)))].sort((a, b) => a - b);
}

// ---------- Đọc trạng thái ngày ----------

async function loadDay(day, { withQuestions = false } = {}) {
  const store = await getStore();
  const [sentRaw, failedRaw] = await Promise.all([store.smembers(keys.sent(day)), store.smembers(keys.failed(day))]);
  const sent = toSlots(sentRaw);
  const failed = toSlots(failedRaw).filter((s) => !sent.includes(s));

  const votes = {};
  const questions = {};
  await Promise.all(
    sent.map(async (slot) => {
      const raw = (await store.hgetall(keys.votes(day, slot))) || {};
      votes[slot] = Object.fromEntries(Object.entries(raw).map(([uid, opt]) => [String(uid), Number(opt)]));
      if (withQuestions) questions[slot] = await store.get(keys.q(day, slot));
    }),
  );
  const failReasons = {};
  if (withQuestions) {
    await Promise.all(failed.map(async (slot) => (failReasons[slot] = await store.get(keys.failReason(day, slot)))));
  }
  return { day, sent, failed, votes, questions, failReasons };
}

function answeredCount(state, userId) {
  return state.sent.filter((slot) => state.votes[slot]?.[userId] !== undefined).length;
}

function everyoneDone(state, members) {
  return members.length > 0 && members.every((m) => answeredCount(state, m.id) === state.sent.length);
}

// ---------- Message tiến độ ----------

export function buildProgressText(state, members = getMembers()) {
  const lines = [`📊 <b>Tiến độ ngày ${formatDay(state.day)}</b> (đã gửi ${state.sent.length}/${QUESTIONS_PER_DAY} câu)`];
  for (const m of members) {
    const n = answeredCount(state, m.id);
    const done = state.sent.length > 0 && n === state.sent.length;
    lines.push(`${done ? '✅' : '⏳'} ${escapeHtml(m.name)}: ${n}/${state.sent.length}`);
  }
  if (state.failed.length) lines.push(`⚠️ Bỏ qua câu: ${state.failed.map((s) => s + 1).join(', ')}`);
  lines.push('🔒 Đáp án hiện khi mọi người làm đủ tất cả câu, muộn nhất 23:00.');
  return lines.join('\n');
}

export async function getProgressText(day = dayKey()) {
  const store = await getStore();
  if (await store.get(keys.revealed(day))) return `✅ Đã công bố đáp án ngày ${formatDay(day)}.`;
  return buildProgressText(await loadDay(day));
}

async function postProgress(day, text) {
  const store = await getStore();
  const msg = await sendMessage(requireChatId(), text, { disable_notification: true });
  await store.set(keys.progress(day), msg.message_id, { ex: DAY_TTL });
  return msg.message_id;
}

// Xoá message tiến độ cũ, gửi mới ở cuối chat
export async function repostProgress(day) {
  const store = await getStore();
  const chatId = requireChatId();
  const oldId = await store.get(keys.progress(day));
  if (oldId) {
    await tg('deleteMessage', { chat_id: chatId, message_id: Number(oldId) }).catch(() => {});
  }
  return postProgress(day, buildProgressText(await loadDay(day)));
}

// Edit tại chỗ; nếu message không còn thì gửi mới
export async function refreshProgress(day, text) {
  const store = await getStore();
  const chatId = requireChatId();
  const body = text ?? buildProgressText(await loadDay(day));
  const id = await store.get(keys.progress(day));
  if (!id) return postProgress(day, body);
  try {
    await editMessage(chatId, Number(id), body);
    return Number(id);
  } catch (err) {
    if (isNotModified(err)) return Number(id);
    if (isMessageMissing(err)) return postProgress(day, body);
    throw err;
  }
}

// ---------- Gửi câu hỏi ----------

// Tin nhắn đi kèm poll: code (nếu có) và/hoặc đề đầy đủ khi đề không vừa poll
const CODE_LABELS = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  sql: 'SQL',
  bash: 'Bash',
  dockerfile: 'Dockerfile',
  yaml: 'YAML',
  css: 'CSS',
};

export function buildIntroMessage(topic, q, { withQuestion }) {
  const parts = [`<b>${escapeHtml(header(topic))}</b>`];
  if (withQuestion) parts.push(`❓ ${escapeHtml(q.question)}`);
  if (q.code) {
    const label = CODE_LABELS[q.codeTag] || q.codeTag || 'code';
    const cls = q.codeTag ? ` class="language-${q.codeTag}"` : '';
    parts.push(`💻 <i>${escapeHtml(label)}</i>\n<pre><code${cls}>${escapeHtml(q.code)}</code></pre>`);
  }
  if (withQuestion) parts.push(q.options.map((o, i) => `<b>${LETTERS[i]}.</b> ${escapeHtml(o)}`).join('\n'));
  return parts.join('\n\n');
}

export async function sendQuestion(slot, { day = dayKey(), budgetMs, retry = false } = {}) {
  const topic = TOPICS[Number(slot)];
  if (!topic) throw new Error(`Slot không hợp lệ: ${slot}`);
  const store = await getStore();
  const chatId = requireChatId();
  const n = topic.slot + 1;

  if (await store.get(keys.revealed(day))) {
    return { ok: true, skipped: 'revealed', day, slot: topic.slot };
  }
  const lock = await store.set(keys.sendLock(day, topic.slot), Date.now(), { nx: true, ex: SEND_LOCK_TTL });
  if (lock !== 'OK') return { ok: true, skipped: 'locked', day, slot: topic.slot };
  if (toSlots(await store.smembers(keys.sent(day))).includes(topic.slot)) {
    return { ok: true, skipped: 'already-sent', day, slot: topic.slot };
  }

  const history = ((await store.lrange(keys.history(topic.key), 0, HISTORY_SIZE - 1)) || []).map(String);

  let q;
  let poll;
  try {
    q = await generateVerifiedQuestion(topic, { history, ...(budgetMs ? { budgetMs } : {}) });

    // Đề vừa poll: poll hiện đủ đề (code gửi trước nếu có). Đề dài: gửi đề đầy đủ trong tin nhắn,
    // poll chỉ để chọn A/B/C/D.
    const fits = fitsInPoll(topic, q.question, q.options);
    let introMessageId = null;
    if (q.code || !fits) {
      const intro = await sendMessage(chatId, buildIntroMessage(topic, q, { withQuestion: !fits }));
      introMessageId = intro.message_id;
    }

    // Poll thường (không phải quiz mode) để không lộ đáp án khi vote; câu hỏi poll là plain text
    poll = await tg('sendPoll', {
      chat_id: chatId,
      question: fits
        ? `${header(topic)}\n${q.question}`
        : `${header(topic)}\n👆 Đề và các đáp án ở tin nhắn trên. Chọn đáp án:`,
      options: q.options.map((o, i) => ({ text: truncate(`${LETTERS[i]}. ${o}`, POLL_OPTION_MAX) })),
      is_anonymous: false,
      type: 'regular',
      allows_multiple_answers: false,
      ...(introMessageId ? { reply_parameters: { message_id: introMessageId, allow_sending_without_reply: true } } : {}),
    });
  } catch (err) {
    console.error(`[send] day=${day} slot=${topic.slot} lỗi trước khi gửi poll: ${String(err?.message || err).split('\n')[0]}`);
    await store.del(keys.sendLock(day, topic.slot));
    await store.sadd(keys.failed(day), topic.slot);
    await store.expire(keys.failed(day), DAY_TTL);
    const reason = describeFailure(err);
    await store.set(keys.failReason(day, topic.slot), reason, { ex: DAY_TTL });
    const later = topic.slot < QUESTIONS_PER_DAY - 1 ? 'bot sẽ thử lại ở lượt gửi sau' : 'bỏ qua';
    const title = retry
      ? `⚠️ Thử lại câu ${n} (${escapeHtml(topic.name)}) vẫn lỗi.`
      : `⚠️ Câu ${n} hôm nay tạo lỗi, ${later}.`;
    await sendMessage(chatId, `${title}\n<b>Lý do:</b> ${escapeHtml(reason)}`).catch((e) =>
      console.error(`[send] không gửi được thông báo lỗi: ${e.message}`),
    );
    const r = await tryReveal(day);
    if (!r.revealed) await repostProgress(day).catch((e) => console.error(`[send] progress lỗi: ${e.message}`));
    return { ok: false, failed: true, day, slot: topic.slot, revealed: r.revealed };
  }

  // Poll đã gửi thành công: từ đây lỗi chỉ log, không coi là câu lỗi
  const pollId = String(poll.poll.id);
  await store.set(
    keys.q(day, topic.slot),
    {
      slot: topic.slot,
      topic: topic.key,
      label: topic.name,
      question: q.question,
      code: q.code,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      summary: q.summary,
      pollId,
      messageId: poll.message_id,
    },
    { ex: DAY_TTL },
  );
  await store.set(keys.poll(pollId), { day, slot: topic.slot }, { ex: DAY_TTL });
  await store.sadd(keys.sent(day), topic.slot);
  await store.expire(keys.sent(day), DAY_TTL);
  await store.srem(keys.failed(day), topic.slot);
  await store.del(keys.failReason(day, topic.slot));
  await store.lpush(keys.history(topic.key), q.summary);
  await store.ltrim(keys.history(topic.key), 0, HISTORY_SIZE - 1);

  await repostProgress(day).catch((e) => console.error(`[send] progress lỗi: ${e.message}`));

  console.log(`[send] day=${day} slot=${topic.slot} topic=${topic.key} đã gửi poll (thử ${q.attempts} lần)`);
  return { ok: true, day, slot: topic.slot, pollId, attempts: q.attempts, ...(retry ? { retried: true } : {}) };
}

// Thử gửi lại các câu lỗi trước đó trong ngày (gọi từ cron của lượt sau), trong khoảng thời gian còn lại
export async function retryFailedSlots(day = dayKey(), { deadline, beforeSlot = QUESTIONS_PER_DAY } = {}) {
  const store = await getStore();
  const results = [];
  const failed = toSlots(await store.smembers(keys.failed(day))).filter((s) => s < beforeSlot);
  for (const slot of failed) {
    const budgetMs = deadline ? deadline - Date.now() : undefined;
    if (budgetMs !== undefined && budgetMs < 60_000) break;
    results.push(await sendQuestion(slot, { day, retry: true, ...(budgetMs ? { budgetMs } : {}) }));
  }
  return results;
}

// ---------- Nhận vote ----------

export async function handlePollAnswer(pollAnswer) {
  const userId = String(pollAnswer?.user?.id ?? '');
  const optionIds = pollAnswer?.option_ids || [];
  if (optionIds.length === 0) return { ignored: 'retracted' };
  if (!getMembers().some((m) => m.id === userId)) return { ignored: 'not-member' };

  const store = await getStore();
  const ref = await store.get(keys.poll(String(pollAnswer.poll_id)));
  if (!ref) return { ignored: 'unknown-poll' };
  const day = String(ref.day);
  const slot = Number(ref.slot);
  if (await store.get(keys.revealed(day))) return { ignored: 'revealed' };

  // Chỉ lưu lần vote ĐẦU TIÊN
  const added = await store.hsetnx(keys.votes(day, slot), userId, Number(optionIds[0]));
  await store.expire(keys.votes(day, slot), DAY_TTL);
  if (!added) return { ignored: 'already-voted' };

  const r = await tryReveal(day);
  if (!r.revealed) await refreshProgress(day);
  return { recorded: true, day, slot, revealed: r.revealed };
}

// ---------- Công bố ----------

function rankEmoji(rank) {
  return ['🥇', '🥈', '🥉'][rank] || `${rank + 1}.`;
}

function splitMessages(blocks, limit = MESSAGE_LIMIT) {
  const out = [];
  let cur = '';
  for (const block of blocks) {
    const candidate = cur ? `${cur}\n\n${block}` : block;
    if (candidate.length <= limit) {
      cur = candidate;
      continue;
    }
    if (cur) out.push(cur);
    if (block.length <= limit) {
      cur = block;
    } else {
      // block đơn quá dài (hiếm): cắt theo dòng
      cur = '';
      for (const line of block.split('\n')) {
        const c = cur ? `${cur}\n${line}` : line;
        if (c.length <= limit) cur = c;
        else {
          if (cur) out.push(cur);
          cur = line.slice(0, limit);
        }
      }
    }
  }
  if (cur) out.push(cur);
  return out;
}

function buildRevealBlocks({ day, state, members, force, todayScores, weekTotals, week }) {
  const blocks = [`🎯 <b>ĐÁP ÁN NGÀY ${formatDay(day)}</b>${force ? ' (hết giờ)' : ''}`];

  for (const topic of TOPICS) {
    const slot = topic.slot;
    if (state.failed.includes(slot)) {
      const why = state.failReasons?.[slot];
      blocks.push(
        `<b>${escapeHtml(header(topic))}</b>\n⚠️ Câu này tạo lỗi, bỏ qua.${why ? `\nLý do: ${escapeHtml(String(why))}` : ''}`,
      );
      continue;
    }
    const q = state.questions[slot];
    if (!q) continue;
    const correct = Number(q.correctIndex);
    const votes = state.votes[slot] || {};
    const who = members
      .map((m) => {
        const v = votes[m.id];
        if (v === undefined) return `${escapeHtml(m.name)}: —`;
        return `${escapeHtml(m.name)}: ${LETTERS[v] ?? '?'} ${v === correct ? '✅' : '❌'}`;
      })
      .join(' · ');
    blocks.push(
      [
        `<b>${escapeHtml(header(topic))}</b>`,
        `❓ ${escapeHtml(q.question)}`,
        `✅ <b>${LETTERS[correct]}. ${escapeHtml(q.options[correct])}</b>`,
        `💡 ${escapeHtml(q.explanation)}`,
        `👥 ${who}`,
      ].join('\n'),
    );
  }

  const total = state.sent.length;
  const ranked = [...members].sort((a, b) => todayScores[b.id] - todayScores[a.id]);
  const distinctScores = [...new Set(ranked.map((m) => todayScores[m.id]))]; // xếp hạng dense: đồng điểm cùng hạng
  const scoreLines = ranked.map(
    (m) => `${rankEmoji(distinctScores.indexOf(todayScores[m.id]))} ${escapeHtml(m.name)}: ${todayScores[m.id]}/${total}`,
  );
  const weekLine = [...members]
    .sort((a, b) => weekTotals[b.id] - weekTotals[a.id])
    .map((m) => `${escapeHtml(m.name)}: ${weekTotals[m.id]}`)
    .join(' · ');
  blocks.push(`🏆 <b>Điểm hôm nay</b>\n${scoreLines.join('\n')}\n\n📅 <b>Tổng tuần ${week}</b>\n${weekLine}`);
  return blocks;
}

export async function tryReveal(day = dayKey(), { force = false } = {}) {
  const store = await getStore();
  if (await store.get(keys.revealed(day))) return { revealed: false, reason: 'already-revealed' };

  const members = getMembers();
  const state = await loadDay(day);
  if (state.sent.length === 0) return { revealed: false, reason: 'nothing-sent' };
  if (!force) {
    if (state.sent.length + state.failed.length < QUESTIONS_PER_DAY) return { revealed: false, reason: 'not-all-sent' };
    if (!everyoneDone(state, members)) return { revealed: false, reason: 'waiting-votes' };
  }

  const lock = await store.set(keys.revealed(day), Date.now(), { nx: true, ex: DAY_TTL });
  if (lock !== 'OK') return { revealed: false, reason: 'already-revealed' };

  try {
    const chatId = requireChatId();
    const full = await loadDay(day, { withQuestions: true });

    // Đóng poll để không ai vote thêm
    for (const slot of full.sent) {
      const q = full.questions[slot];
      if (!q?.messageId) continue;
      await tg('stopPoll', { chat_id: chatId, message_id: Number(q.messageId) }).catch(() => {});
    }

    // Tính điểm
    const todayScores = {};
    for (const m of members) {
      todayScores[m.id] = full.sent.filter((slot) => {
        const q = full.questions[slot];
        return q && full.votes[slot]?.[m.id] === Number(q.correctIndex);
      }).length;
    }
    const week = weekKey(day);
    const weekRaw = (await store.hgetall(keys.score(week))) || {};
    const weekTotals = {};
    for (const m of members) weekTotals[m.id] = Number(weekRaw[m.id] || 0) + todayScores[m.id];

    const messages = splitMessages(
      buildRevealBlocks({ day, state: full, members, force, todayScores, weekTotals, week }),
    );
    for (const text of messages) await sendMessage(chatId, text);

    // Chỉ cộng điểm sau khi đã công bố thành công
    for (const m of members) await store.hincrby(keys.score(week), m.id, todayScores[m.id]);
    await store.expire(keys.score(week), SCORE_TTL);
  } catch (err) {
    // Công bố hỏng: nhả lock để cron/admin có thể thử lại
    await store.del(keys.revealed(day));
    throw err;
  }

  await refreshProgress(day, `✅ Đã công bố đáp án ngày ${formatDay(day)}.`).catch((e) =>
    console.error(`[reveal] không cập nhật được progress: ${e.message}`),
  );
  console.log(`[reveal] day=${day} force=${force} questions=${state.sent.length}`);
  return { revealed: true, day, force, count: state.sent.length };
}
