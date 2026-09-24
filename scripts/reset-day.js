// Xoá dữ liệu 1 ngày trong Redis để test lại từ đầu (không in nội dung key nên không lộ đáp án).
//   npm run reset-day                 # xoá dữ liệu hôm nay
//   npm run reset-day -- 2026-09-24   # xoá dữ liệu ngày chỉ định
//   npm run reset-day -- --scores     # xoá thêm điểm của tuần chứa ngày đó
// Cần KV_REST_API_URL / KV_REST_API_TOKEN (hoặc UPSTASH_REDIS_REST_*) trong .env: copy từ Vercel → Settings → Environment Variables.
import { getStore } from '../lib/store.js';
import { dayKey, weekKey } from '../lib/time.js';

const argv = process.argv.slice(2);
const day = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || dayKey();
const withScores = argv.includes('--scores');

const store = await getStore();
if (typeof store.scan !== 'function') {
  console.error('❌ Script này chỉ chạy với Redis thật');
  process.exit(1);
}

async function scanKeys(match) {
  const found = [];
  let cursor = '0';
  do {
    const [next, keys] = await store.scan(cursor, { match, count: 200 });
    found.push(...keys);
    cursor = String(next);
  } while (cursor !== '0');
  return found;
}

const keys = await scanKeys(`quiz:${day}:*`);
if (withScores) keys.push(`quiz:score:${weekKey(day)}`);

if (!keys.length) {
  console.log(`Không có dữ liệu nào của ngày ${day}.`);
  process.exit(0);
}
const deleted = await store.del(...keys);
console.log(`✅ Đã xoá ${deleted} key của ngày ${day}${withScores ? ` (kèm điểm tuần ${weekKey(day)})` : ''}.`);
console.log('Giờ có thể gửi lại câu hỏi cho ngày này. Lưu ý: poll cũ trong group sẽ không còn được tính vote.');
