// Gửi THẬT 1 câu hỏi vào group từ máy local (LLM thật + Telegram thật), không cần deploy.
//   npm run send-test -- <topicKey|slot>
// Trạng thái lưu trong bộ nhớ (không dùng Redis) nên vote trên group sẽ KHÔNG được ghi nhận;
// chỉ dùng để xem câu hỏi hiển thị thế nào. Không in đáp án.
process.env.ALLOW_MEMORY_STORE = '1';
delete process.env.TELEGRAM_MOCK;
delete process.env.GEMINI_MOCK;

const { TOPICS, getChatId, getModelLabel, getTopic } = await import('../lib/config.js');
const { sendQuestion } = await import('../lib/quiz.js');

const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const topic = arg ? getTopic(arg) : null;
if (!topic) {
  console.log('Cách dùng: npm run send-test -- <topicKey|slot>');
  console.log(`topicKey: ${TOPICS.map((t) => `${t.key} (${t.slot})`).join(', ')}`);
  process.exit(1);
}
if (!getChatId()) {
  console.error('❌ Thiếu TELEGRAM_CHAT_ID trong .env');
  process.exit(1);
}

console.log(`Gửi câu ${topic.emoji} ${topic.name} vào chat ${getChatId()} (model ${getModelLabel()})...`);
const result = await sendQuestion(topic.slot);
console.log(result.ok ? '✅ Đã gửi, mở Telegram để xem.' : '❌ Gửi lỗi, xem log ở trên.');
console.log(JSON.stringify(result));
process.exit(result.ok ? 0 : 1);
