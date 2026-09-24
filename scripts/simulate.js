// HARNESS: mô phỏng trọn 1 ngày (và ngày có câu lỗi) bằng mock, không cần mạng.
//   node scripts/simulate.js            # in các message bot sẽ gửi
//   node scripts/simulate.js --quiet    # chỉ in kết quả test
//   node scripts/simulate.js --real     # dùng LLM thật (vẫn mock Telegram + Redis), cần GROQ_API_KEY hoặc GEMINI_API_KEY trong .env
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const QUIET = args.has('--quiet');
const REAL = args.has('--real');

// ----- Env: set TRƯỚC khi import các module -----
if (REAL && existsSync('.env')) process.loadEnvFile('.env');
const MEMBERS = [
  { id: '1001', name: 'Hiếu' },
  { id: '1002', name: 'An' },
  { id: '1003', name: 'Bình' },
  { id: '1004', name: 'Chi' },
];
Object.assign(process.env, {
  TELEGRAM_MOCK: '1',
  TELEGRAM_MOCK_QUIET: QUIET ? '1' : '0',
  ALLOW_MEMORY_STORE: '1',
  TELEGRAM_CHAT_ID: '-1001234567890',
  MEMBERS: MEMBERS.map((m) => `${m.id}:${m.name}`).join(','),
  ADMIN_IDS: '1001',
});
if (REAL) {
  delete process.env.GEMINI_MOCK;
  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error('--real cần GROQ_API_KEY hoặc GEMINI_API_KEY (trong .env hoặc env)');
    process.exit(1);
  }
} else {
  process.env.GEMINI_MOCK = '1';
}
delete process.env.GEMINI_MOCK_FAIL_TOPIC;

const out = (s) => process.stdout.write(`${s}\n`);
if (QUIET) console.log = () => {};

const { TOPICS } = await import('../lib/config.js');
const { getStore } = await import('../lib/store.js');
const { mock } = await import('../lib/telegram.js');
const quiz = await import('../lib/quiz.js');
const { keys, sendQuestion, handlePollAnswer, tryReveal, retryFailedSlots } = quiz;
const { weekKey } = await import('../lib/time.js');

const store = await getStore();
const DAY1 = '2026-09-21';
const DAY2 = '2026-09-22'; // cùng tuần ISO với DAY1
const WEEK = weekKey(DAY1);

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(true);
    out(`✅ ${name}`);
  } catch (err) {
    results.push(false);
    out(`❌ ${name}\n   ${err?.stack || err}`);
  }
}

const vote = (userId, pollId, optionIds) =>
  handlePollAnswer({ poll_id: pollId, user: { id: Number(userId), first_name: 'x' }, option_ids: optionIds });
const getQ = (day, slot) => store.get(keys.q(day, slot));
const callsOf = (method) => mock.calls.filter((c) => c.method === method);

// Người chơi i (0,2) luôn đúng, (1,3) luôn sai
const pickOption = (memberIndex, q) =>
  memberIndex % 2 === 0 ? Number(q.correctIndex) : (Number(q.correctIndex) + 1) % 4;

// Bí mật (explanation + đáp án đúng) không được xuất hiện trong bất kỳ call Telegram nào trước reveal
async function assertNoLeak(day, slots) {
  const secrets = [];
  for (const s of slots) {
    const q = await getQ(day, s);
    secrets.push(q.explanation);
  }
  const text = JSON.stringify(mock.calls);
  for (const secret of secrets) assert.ok(!text.includes(secret), 'explanation bị lộ trước khi reveal');
  for (const c of callsOf('sendPoll')) assert.equal(c.payload.type, 'regular');
}

// ================= NGÀY 1 =================
mock.reset();

await test('1. Gửi đủ 6 câu cho một ngày cố định', async () => {
  for (const t of TOPICS) {
    const r = await sendQuestion(t.slot, { day: DAY1 });
    assert.equal(r.ok, true, `slot ${t.slot} phải gửi được`);
    assert.ok(!r.skipped, `slot ${t.slot} không được skip`);
    assert.ok(!('correctIndex' in r), 'kết quả sendQuestion không được chứa đáp án');
  }
  assert.equal(callsOf('sendPoll').length, 6);
  const sent = (await store.smembers(keys.sent(DAY1))).map(Number).sort();
  assert.deepEqual(sent, [0, 1, 2, 3, 4, 5]);
  for (const t of TOPICS) {
    const q = await getQ(DAY1, t.slot);
    assert.ok(q && q.pollId, `thiếu q:${t.slot}`);
    assert.equal(q.options.length, 4);
    assert.ok(Number.isInteger(Number(q.correctIndex)));
    const ref = await store.get(keys.poll(q.pollId));
    assert.equal(String(ref.day), DAY1);
    assert.equal(Number(ref.slot), t.slot);
  }
  for (const c of callsOf('sendPoll')) {
    assert.ok(c.payload.question.length <= 300);
    assert.equal(c.payload.is_anonymous, false);
    assert.equal(c.payload.allows_multiple_answers, false);
    c.payload.options.forEach((o) => assert.ok(o.text.length <= 100));
  }
  for (const c of callsOf('sendMessage')) assert.equal(c.payload.parse_mode, 'HTML');
  // Code đã được escape trong <pre><code>
  const codeMsg = callsOf('sendMessage').find((c) => c.payload.text.includes('<pre><code'));
  if (!REAL) {
    assert.ok(codeMsg, 'phải có ít nhất 1 message code');
    assert.ok(codeMsg.payload.text.includes('&lt;') && codeMsg.payload.text.includes('&amp;'));
  }
  assert.equal(await store.get(keys.revealed(DAY1)), null);
  await assertNoLeak(DAY1, [0, 1, 2, 3, 4, 5]);
});

await test('2. Gọi sendQuestion lại cùng slot thì bị skip', async () => {
  const before = callsOf('sendPoll').length;
  const r = await sendQuestion(0, { day: DAY1 });
  assert.ok(r.skipped, 'phải skip');
  // Kể cả khi lock đã hết hạn thì set "sent" vẫn chặn gửi trùng
  await store.del(keys.sendLock(DAY1, 3));
  const r2 = await sendQuestion(3, { day: DAY1 });
  assert.equal(r2.skipped, 'already-sent');
  assert.equal(callsOf('sendPoll').length, before);
});

const q0 = await getQ(DAY1, 0);

await test('3. User ngoài MEMBERS vote thì bị bỏ qua', async () => {
  const r = await vote('999999', q0.pollId, [0]);
  assert.equal(r.ignored, 'not-member');
  const votes = await store.hgetall(keys.votes(DAY1, 0));
  assert.equal(votes, null);
  const r2 = await vote(MEMBERS[0].id, 'poll-khong-ton-tai', [0]);
  assert.equal(r2.ignored, 'unknown-poll');
});

await test('4. Chỉ lần vote đầu tiên được ghi; rút vote và đổi vote bị bỏ qua', async () => {
  const first = pickOption(0, q0);
  const r1 = await vote(MEMBERS[0].id, q0.pollId, [first]);
  assert.equal(r1.recorded, true);
  assert.equal(r1.revealed, false);
  const r2 = await vote(MEMBERS[0].id, q0.pollId, []);
  assert.equal(r2.ignored, 'retracted');
  const r3 = await vote(MEMBERS[0].id, q0.pollId, [(first + 2) % 4]);
  assert.equal(r3.ignored, 'already-voted');
  const votes = await store.hgetall(keys.votes(DAY1, 0));
  assert.equal(Number(votes[MEMBERS[0].id]), first);
});

await test('5. Còn thiếu 1 vote của 1 người thì chưa reveal', async () => {
  for (let slot = 0; slot < 6; slot++) {
    const q = await getQ(DAY1, slot);
    for (let i = 0; i < MEMBERS.length; i++) {
      if (slot === 0 && i === 0) continue; // đã vote ở case 4
      if (slot === 5 && i === 3) continue; // để dành vote cuối
      const r = await vote(MEMBERS[i].id, q.pollId, [pickOption(i, q)]);
      assert.equal(r.recorded, true);
      assert.equal(r.revealed, false);
    }
  }
  assert.equal(await store.get(keys.revealed(DAY1)), null);
  assert.equal(callsOf('stopPoll').length, 0);
  await assertNoLeak(DAY1, [0, 1, 2, 3, 4, 5]);
  // Message tiến độ được edit tại chỗ
  assert.ok(callsOf('editMessageText').length > 0);
});

await test('6. Vote cuối cùng thì tự reveal', async () => {
  const q5 = await getQ(DAY1, 5);
  const r = await vote(MEMBERS[3].id, q5.pollId, [pickOption(3, q5)]);
  assert.equal(r.recorded, true);
  assert.equal(r.revealed, true);
  assert.ok(await store.get(keys.revealed(DAY1)));
  assert.equal(callsOf('stopPoll').length, 6);
  const reveal = callsOf('sendMessage').filter((c) => c.payload.text.includes('ĐÁP ÁN NGÀY 21/09'));
  assert.equal(reveal.length, 1);
  assert.ok(!reveal[0].payload.text.includes('(hết giờ)'));
  const allText = callsOf('sendMessage').map((c) => c.payload.text).join('\n');
  assert.ok(allText.includes('🥇 Hiếu: 6/6'));
  assert.ok(allText.includes(`Tổng tuần ${WEEK}`));
  for (const c of callsOf('sendMessage')) assert.ok(c.payload.text.length <= 4096);
  const score = await store.hgetall(keys.score(WEEK));
  assert.deepEqual(
    Object.fromEntries(MEMBERS.map((m) => [m.id, Number(score[m.id])])),
    { 1001: 6, 1002: 0, 1003: 6, 1004: 0 },
  );
});

await test('7. Vote sau reveal bị bỏ qua; force reveal lần nữa không công bố 2 lần', async () => {
  const q2 = await getQ(DAY1, 2);
  const r = await vote(MEMBERS[1].id, q2.pollId, [0]);
  assert.equal(r.ignored, 'revealed');
  const before = callsOf('sendMessage').length;
  const r2 = await tryReveal(DAY1, { force: true });
  assert.equal(r2.revealed, false);
  assert.equal(callsOf('sendMessage').length, before);
  const score = await store.hgetall(keys.score(WEEK));
  assert.equal(Number(score[MEMBERS[0].id]), 6, 'điểm không được cộng 2 lần');
  const r3 = await sendQuestion(1, { day: DAY1 });
  assert.equal(r3.skipped, 'revealed');
});

// ================= NGÀY 2: chủ đề devops lỗi =================
mock.reset();

await test('8. Ngày có GEMINI_MOCK_FAIL_TOPIC=devops: slot 1 lỗi, 3/4 người làm đủ thì chưa reveal', async () => {
  if (REAL) {
    out('   (bỏ qua ép lỗi ở chế độ --real, mô phỏng lỗi bằng mock)');
    process.env.GEMINI_MOCK = '1';
  }
  process.env.GEMINI_MOCK_FAIL_TOPIC = 'devops';
  try {
    for (const t of TOPICS) {
      const r = await sendQuestion(t.slot, { day: DAY2 });
      if (t.key === 'devops') assert.equal(r.failed, true);
      else assert.equal(r.ok, true);
    }
  } finally {
    delete process.env.GEMINI_MOCK_FAIL_TOPIC;
    if (REAL) delete process.env.GEMINI_MOCK;
  }
  assert.deepEqual((await store.smembers(keys.failed(DAY2))).map(Number), [1]);
  assert.deepEqual((await store.smembers(keys.sent(DAY2))).map(Number).sort(), [0, 2, 3, 4, 5]);
  assert.equal(await store.get(keys.sendLock(DAY2, 1)), null, 'lock của câu lỗi phải được xoá');
  const warnMsg = callsOf('sendMessage').find((c) => c.payload.text.includes('⚠️ Câu 2 hôm nay tạo lỗi'));
  assert.ok(warnMsg);
  assert.ok(
    warnMsg.payload.text.includes('<b>Lý do:</b> 5 lần thử đều hỏng: 5× LLM trả về sai định dạng'),
    'phải ghi rõ lý do lỗi',
  );
  assert.equal(callsOf('sendPoll').length, 5);

  for (const slot of [0, 2, 3, 4, 5]) {
    const q = await getQ(DAY2, slot);
    for (let i = 0; i < 3; i++) {
      const r = await vote(MEMBERS[i].id, q.pollId, [pickOption(i, q)]);
      assert.equal(r.revealed, false);
    }
  }
  assert.equal(await store.get(keys.revealed(DAY2)), null);
  const progress = callsOf('editMessageText').at(-1)?.payload.text || '';
  assert.ok(progress.includes('⚠️ Bỏ qua câu: 2'));
  assert.ok(progress.includes('⏳ Chi: 0/5'));
  await assertNoLeak(DAY2, [0, 2, 3, 4, 5]);
});

await test('9. Force reveal (cron 23h) công bố 5 câu', async () => {
  const r = await tryReveal(DAY2, { force: true });
  assert.equal(r.revealed, true);
  assert.equal(r.count, 5);
  const text = callsOf('sendMessage').map((c) => c.payload.text.replace(/<[^>]+>/g, '')).join('\n');
  assert.ok(text.includes('ĐÁP ÁN NGÀY 22/09 (hết giờ)'));
  assert.ok(text.includes('Câu này tạo lỗi, bỏ qua.\nLý do: 5 lần thử đều hỏng'));
  assert.ok(text.includes('Chi: —'));
  const score = await store.hgetall(keys.score(WEEK));
  assert.deepEqual(
    Object.fromEntries(MEMBERS.map((m) => [m.id, Number(score[m.id])])),
    { 1001: 11, 1002: 0, 1003: 11, 1004: 0 },
  );
  const again = await tryReveal(DAY2, { force: true });
  assert.equal(again.revealed, false);
});

// ================= NGÀY 3: thử lại câu lỗi + đề dài =================
const DAY3 = '2026-09-23';
const withMock = async (env, fn) => {
  const saved = { GEMINI_MOCK: process.env.GEMINI_MOCK };
  process.env.GEMINI_MOCK = '1';
  Object.assign(process.env, env);
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(env)) delete process.env[k];
    if (saved.GEMINI_MOCK === undefined) delete process.env.GEMINI_MOCK;
    else process.env.GEMINI_MOCK = saved.GEMINI_MOCK;
  }
};
mock.reset();

await test('10. Câu lỗi được thử lại ở lượt gửi sau', async () => {
  await withMock({ GEMINI_MOCK_FAIL_TOPIC: 'devops' }, async () => {
    assert.equal((await sendQuestion(0, { day: DAY3 })).ok, true);
    assert.equal((await sendQuestion(1, { day: DAY3 })).failed, true);
  });
  const warn = callsOf('sendMessage').filter((c) => c.payload.text.includes('⚠️ Câu 2 hôm nay tạo lỗi'));
  assert.equal(warn.length, 1);
  assert.ok(warn[0].payload.text.includes('thử lại'));
  // Cron slot 2: gửi câu của nó rồi thử lại câu 2
  await withMock({}, async () => {
    assert.equal((await sendQuestion(2, { day: DAY3 })).ok, true);
    const retried = await retryFailedSlots(DAY3, { beforeSlot: 2 });
    assert.equal(retried.length, 1);
    assert.equal(retried[0].ok, true);
    assert.equal(retried[0].retried, true);
  });
  assert.deepEqual((await store.smembers(keys.sent(DAY3))).map(Number).sort(), [0, 1, 2]);
  assert.deepEqual(await store.smembers(keys.failed(DAY3)), []);
});

await test('11. Đề dài hơn poll: gửi đề đầy đủ trong tin nhắn, poll chỉ để chọn', async () => {
  const before = mock.calls.length;
  await withMock({ GEMINI_MOCK_LONG_TOPIC: 'db' }, async () => {
    assert.equal((await sendQuestion(3, { day: DAY3 })).ok, true);
  });
  const calls = mock.calls.slice(before);
  const poll = calls.find((c) => c.method === 'sendPoll');
  const intro = calls.find((c) => c.method === 'sendMessage' && c.payload.text.includes('Bối cảnh dài dòng'));
  const q = await getQ(DAY3, 3);
  assert.ok(q.question.length > 300);
  assert.ok(intro, 'phải gửi đề đầy đủ trong tin nhắn');
  assert.ok(intro.payload.text.includes('<b>A.</b>') && intro.payload.text.includes('<b>D.</b>'));
  assert.ok(intro.payload.text.includes('<pre><code class="language-sql">'));
  assert.ok(poll.payload.question.includes('ở tin nhắn trên'));
  assert.ok(poll.payload.question.length <= 300);
  assert.equal(poll.payload.reply_parameters.message_id, intro.result.message_id);
});

const failed = results.filter((ok) => !ok).length;
out(`\n${results.length - failed}/${results.length} case pass`);
process.exit(failed ? 1 : 0);
