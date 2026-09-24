# Daily Quiz Bot 🧠

Telegram bot cho một group 4 người. Mỗi ngày gửi 6 câu trắc nghiệm kỹ thuật (A/B/C/D) do LLM sinh ra (mặc định Groq `openai/gpt-oss-120b`, có thể đổi sang Gemini). Đáp án **chỉ** được công bố khi cả 4 người đã làm đủ các câu, muộn nhất lúc 23:00 (giờ VN).

- Chạy trên Vercel Serverless Functions (Hobby, miễn phí) + Vercel Cron
- Lưu trạng thái trên Upstash Redis (free)
- Sinh câu hỏi bằng Groq (free tier) hoặc Gemini. Mỗi câu được model **kiểm tra chéo** (giải lại độc lập), đáp án được **xáo ngẫu nhiên**.
- Poll dạng thường (không dùng quiz mode) nên không lộ đáp án khi vote. **Chỉ lần vote đầu tiên được tính.**

## Lịch (giờ Việt Nam)

| Giờ | Chủ đề |
|---|---|
| 08:00 | 🧮 Thuật toán & CTDL |
| 10:00 | 🛠️ DevOps |
| 12:00 | 🏗️ Solution / System Design |
| 14:00 | 🗄️ Database |
| 16:00 | 🔐 Backend / Network / Security |
| 18:00 | 🎨 Frontend |
| 23:00 | Công bố đáp án bắt buộc |

> Cron của Vercel Hobby chỉ chính xác theo giờ: job 08:00 có thể chạy bất kỳ lúc nào từ 08:00 tới 08:59.

## Cấu trúc

```
api/telegram.js            # webhook (poll_answer + lệnh)
api/cron/send/[slot].js    # cron gửi câu hỏi slot 0..5
api/cron/reveal.js         # cron 23h công bố bắt buộc
lib/                       # config, time, auth, store, telegram, prompts, gemini (sinh + kiểm tra đề), groq, quiz, commands
scripts/set-webhook.js     # đăng ký webhook + lệnh
scripts/dry-run.js         # sinh thử 1 câu bằng LLM thật
scripts/simulate.js        # harness test cả ngày bằng mock
```

## Setup

### 1. Tạo bot
Nhắn [@BotFather](https://t.me/BotFather) → `/newbot` → lấy **token**.
Giữ nguyên privacy mode mặc định (bật). Bot vẫn nhận được lệnh bắt đầu bằng `/` và các vote poll của chính nó.

### 2. Lấy API key LLM
Mặc định dùng **Groq**: vào [console.groq.com/keys](https://console.groq.com/keys) → **Create API Key** (free, key dạng `gsk_...`).
Muốn dùng Gemini thì lấy key ở [Google AI Studio](https://aistudio.google.com/apikey) và đặt `LLM_PROVIDER=gemini`.

### 3. Đưa code lên Vercel
Push repo này lên GitHub → trên Vercel chọn **Add New → Project** → import repo. Không cần chỉnh build setting.

### 4. Tạo Redis
Trong project Vercel → tab **Storage** → **Create Database** → chọn **Upstash for Redis** (Marketplace, gói free) → connect vào project.
Vercel sẽ tự thêm `KV_REST_API_URL` và `KV_REST_API_TOKEN`; bot tự đọc 2 biến này nếu không có `UPSTASH_REDIS_REST_*`.

### 5. Điền biến môi trường
Trong **Settings → Environment Variables**, điền theo [.env.example](.env.example):

| Biến | Ghi chú |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token từ BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | tự nghĩ, chỉ gồm `A-Z a-z 0-9 _ -` |
| `TELEGRAM_CHAT_ID` | **tạm để trống** |
| `MEMBERS` | **tạm để trống** |
| `ADMIN_IDS` | có thể điền sau (userId, cách nhau dấu phẩy) |
| `LLM_PROVIDER` | `groq` (mặc định nếu có `GROQ_API_KEY`) hoặc `gemini` |
| `GROQ_API_KEY` | key Groq; nhiều key cách nhau dấu phẩy để xoay vòng (chỉ tăng quota khi các key thuộc **tài khoản Groq khác nhau**) |
| `GROQ_FALLBACK_MODEL` | mặc định `openai/gpt-oss-20b`, dùng khi model chính hết quota; `none` để tắt |
| `GROQ_MODEL` | mặc định `openai/gpt-oss-120b` (cần hỗ trợ structured outputs strict) |
| `GEMINI_API_KEY` | chỉ cần khi dùng Gemini |
| `GEMINI_MODEL` | mặc định `gemini-flash-latest` |
| `QUIZ_DIFFICULTY` | tuỳ chọn, mô tả độ khó bằng lời |
| `CRON_SECRET` | tự nghĩ, dài và ngẫu nhiên; Vercel tự gửi kèm khi gọi cron |

Sau đó **Deploy**.

Mẹo tạo chuỗi ngẫu nhiên:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

### 6. Đăng ký webhook (chạy ở máy local)
```bash
cp .env.example .env
```
Điền `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (giống hệt trên Vercel) và `PUBLIC_URL=https://<app>.vercel.app`, rồi chạy:
```bash
npm install
```
```bash
npm run set-webhook
```
Script sẽ gọi `setWebhook`, `setMyCommands` và in ra `getWebhookInfo` để kiểm tra.

### 7. Lấy ID group và thành viên
- Thêm bot vào group.
- Trong group gõ `/chatid` → được ID dạng `-100xxxxxxxxxx`.
- **Từng người** gõ `/myid` → được user ID.
- Điền trên Vercel:
  - `TELEGRAM_CHAT_ID=-100xxxxxxxxxx`
  - `MEMBERS=111:Hiếu,222:An,333:Bình,444:Chi`
  - `ADMIN_IDS=111`
- **Redeploy** (Deployments → ⋯ → Redeploy) để env mới có hiệu lực.

### 8. Test gửi tay
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/send/0
```
Mỗi slot chỉ gửi được 1 lần/ngày. Nếu câu bị lỗi, gọi lại cùng slot để thử lại.
Công bố ngay: gõ `/reveal` trong group (chỉ admin) hoặc gọi `/api/cron/reveal` với cùng header.

## Lệnh trong group

| Lệnh | Mô tả |
|---|---|
| `/status` | tiến độ hôm nay |
| `/reveal` | (admin) công bố đáp án ngay |
| `/myid` | xem user ID (chạy ở mọi chat) |
| `/chatid` | xem chat ID (chạy ở mọi chat) |
| `/help` | hướng dẫn |

## Luật chơi
- Mỗi câu chỉ tính **lần vote đầu tiên**. Rút vote hay đổi vote đều không có tác dụng, để không ai xem người khác chọn gì rồi sửa.
- Đáp án hiện khi cả 4 người đã làm đủ mọi câu đã gửi (câu lỗi được bỏ qua), muộn nhất 23:00.
- Điểm cộng dồn theo tuần ISO (thứ 2 → chủ nhật).

## Phát triển & test

```bash
npm run simulate
```
Harness chạy offline (mock Telegram, Redis trong bộ nhớ, Gemini giả) và kiểm tra cả ngày: gửi 6 câu, chống gửi trùng, chỉ tính vote đầu, tự công bố, câu lỗi, công bố bắt buộc 23h. Thêm `--quiet` để chỉ in kết quả, `--real` để dùng LLM thật (cần `GROQ_API_KEY` hoặc `GEMINI_API_KEY` trong `.env`).

```bash
npm run dry-run -- dsa
```
Sinh thử 1 câu bằng LLM thật, **ẩn đáp án**. Topic key: `dsa`, `devops`, `design`, `db`, `backend`, `frontend` (hoặc số slot 0-5). Thêm `--show` để xem đáp án và giải thích. Không gửi Telegram, không ghi Redis.

## Lưu ý
- **Cron Hobby có thể lệch trong vòng 1 giờ** so với giờ đặt.
- **Đừng mở Redis (Upstash console) trong ngày** nếu bạn cũng chơi: đáp án nằm trong key `quiz:<ngày>:q:<slot>`. Code không log đáp án ở bất kỳ đâu trước khi công bố.
- Mỗi câu tốn 2–10 lần gọi LLM (sinh đề + kiểm tra chéo, tối đa 5 lần thử trong 240 giây). Free tier của Groq giới hạn ~8000 token/phút cho `gpt-oss-120b`; bot tự đợi theo `retry-after` khi bị 429, xoay sang key khác, rồi sang model dự phòng. Quota free: 8K token/phút và 200K token/ngày cho mỗi model, tính theo tài khoản Groq.
- Đề dài hơn giới hạn poll của Telegram vẫn dùng được: bot gửi đề + code + 4 đáp án trong 1 tin nhắn, poll chỉ để chọn A/B/C/D.
- Nếu cả 5 lần thử đều hỏng, bot báo "⚠️ Câu n hôm nay tạo lỗi, bot sẽ thử lại ở lượt gửi sau": cron của lượt sau gửi câu của nó xong sẽ thử lại câu lỗi. Câu 6 (18h) lỗi thì bỏ qua và không tính vào điều kiện công bố.
- Webhook luôn trả 200 cho Telegram (lỗi chỉ được `console.error`) để Telegram không gửi lại update; xem log trong Vercel → Logs.
