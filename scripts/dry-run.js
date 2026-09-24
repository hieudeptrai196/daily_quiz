// Sinh thử 1 câu bằng LLM thật (Groq/Gemini). Không gửi Telegram, không ghi Redis.
//   npm run dry-run -- <topicKey|slot> [--show]
// Mặc định ẨN đáp án và giải thích; thêm --show để xem.
import { TOPICS, getModelLabel, getTopic } from '../lib/config.js';
import { generateVerifiedQuestion, LETTERS } from '../lib/gemini.js';

const argv = process.argv.slice(2);
const show = argv.includes('--show');
const topicArg = argv.find((a) => !a.startsWith('--'));
const topic = topicArg ? getTopic(topicArg) : null;

if (!topic) {
  console.log('Cách dùng: npm run dry-run -- <topicKey|slot> [--show]');
  console.log(`topicKey: ${TOPICS.map((t) => `${t.key} (${t.slot})`).join(', ')}`);
  process.exit(1);
}

console.log(`Model: ${getModelLabel()} — chủ đề: ${topic.emoji} ${topic.name}\n`);
const started = Date.now();
try {
  const q = await generateVerifiedQuestion(topic, { history: [] });
  console.log(`\n⏱  ${((Date.now() - started) / 1000).toFixed(1)}s, ${q.attempts} lần thử, sub-topic: ${q.subtopic}\n   dạng: ${q.style ?? '-'}\n`);
  console.log(`❓ ${q.question}\n`);
  if (q.code) console.log(`\`\`\`${q.codeTag}\n${q.code}\n\`\`\`\n`);
  q.options.forEach((o, i) => console.log(`   ${LETTERS[i]}. ${o}`));
  console.log(`\n📝 summary: ${q.summary}`);
  if (show) {
    console.log(`\n✅ Đáp án: ${LETTERS[q.correctIndex]}. ${q.options[q.correctIndex]}`);
    console.log(`💡 ${q.explanation}`);
  } else {
    console.log('\n🔒 Đáp án đang ẩn. Thêm --show để xem.');
  }
} catch (err) {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
}
