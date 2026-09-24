// Cấu hình chủ đề + đọc biến môi trường.
// Env luôn được đọc lúc gọi hàm (không cache lúc import) để harness có thể đổi env giữa các case.

export const QUESTIONS_PER_DAY = 6;

// Áp dụng cho mọi chủ đề: nhóm mỗi người 1 stack nên hỏi solution / khái niệm dùng chung
export const GLOBAL_GUIDANCE = [
  'Nhóm người chơi mỗi người dùng một stack khác nhau (Java, Node.js, PHP, Python, React, Vue, ...). Câu hỏi phải trả lời được bằng hiểu biết chung, KHÔNG phụ thuộc kinh nghiệm với một ngôn ngữ/framework cụ thể.',
  'Trọng tâm là solution: cách tiếp cận, nguyên lý, đánh đổi, xử lý tình huống thực tế.',
  'KHÔNG hỏi cú pháp, tên hàm/API, flag, cấu hình ít gặp hay hành vi đặc thù (quirk) của một ngôn ngữ/framework/phiên bản.',
  'Nếu có code: ngắn, dễ đọc với người dùng stack khác, và câu hỏi xoáy vào logic chứ không vào đặc điểm ngôn ngữ.',
  'FORMAT CODE (đọc trên điện thoại): thụt lề 2 space, mỗi lệnh 1 dòng, mỗi dòng tối đa ~50 ký tự, tên biến có nghĩa, không dồn nhiều lệnh vào 1 dòng. SQL: viết hoa keyword, mỗi mệnh đề (SELECT, FROM, JOIN, WHERE, GROUP BY, HAVING, ORDER BY) 1 dòng; dữ liệu mẫu mỗi dòng dữ liệu 1 dòng.',
  'NGẮN GỌN, DỄ HIỂU (quan trọng nhất, người chơi đọc trên điện thoại): question 1-2 câu, tối đa ~200 ký tự, chỉ hỏi 1 ý; tình huống mô tả trong 1 câu, bỏ mọi chi tiết không cần để trả lời. Mỗi đáp án 1 ý, tối đa ~70 ký tự, không giải thích kèm. Đọc 1 lần là hiểu đề hỏi gì.',
  'ĐỘ KHÓ nằm ở suy luận chứ KHÔNG nằm ở độ dài hay độ rối của đề: câu hỏi phải cần suy luận ít nhất 2 bước, không trả lời được chỉ bằng cách đọc lướt hay loại trừ đáp án vô lý. Mỗi đáp án sai là một cái bẫy thật mà người có 1-2 năm kinh nghiệm hay chọn nhầm (đúng một phần, đúng trong bối cảnh khác, hoặc là cách làm phổ biến nhưng sai ở đây).',
  'NGÔN NGỮ: viết TOÀN BỘ question, options, explanation, summary bằng tiếng Việt. Chỉ giữ nguyên tiếng Anh cho thuật ngữ, tên header/lệnh/hàm/biến và code; mọi câu văn diễn giải phải là tiếng Việt, kể cả khi đề tài quen được viết bằng tiếng Anh.',
  'KHÔNG tự nhận xét trong đáp án: không ghi chú kiểu "(không an toàn)", "(sai)", "nhưng chỉ dùng được cho GET", "insecure" làm lộ đáp án sai/đúng.',
  'CHỐNG ĐOÁN MÒ: đáp án đúng KHÔNG được dài hơn, chi tiết hơn hay "đầy đủ, cẩn thận" hơn các đáp án sai. Cả 4 đáp án cùng cấu trúc câu, cùng mức chi tiết, chênh lệch độ dài không quá ~20%. Không để đáp án đúng là cái duy nhất có giải thích "vì sao" hay có từ như "và", "sau đó", "tuỳ".',
].join('\n');

const COMMON_STYLES = [
  'tình huống thực tế: chọn solution / cách xử lý phù hợp nhất',
  'câu hỏi phỏng vấn phổ biến (dạng hay gặp khi phỏng vấn vị trí liên quan)',
  'debug: mô tả triệu chứng, hỏi nguyên nhân khả dĩ nhất hoặc bước xử lý đúng',
  'đánh đổi: so sánh các cách tiếp cận trong một bối cảnh cụ thể',
];

export const TOPICS = [
  {
    slot: 0,
    key: 'dsa',
    name: 'Thuật toán & CTDL',
    emoji: '🧮',
    // Stack chung của nhóm; chỉ dùng cú pháp cơ bản để câu hỏi không xoáy vào đặc thù ngôn ngữ
    languages: [
      { name: 'JavaScript cơ bản (cú pháp đơn giản, đọc như pseudocode)', tag: 'javascript' },
      { name: 'TypeScript cơ bản (cú pháp đơn giản, đọc như pseudocode)', tag: 'typescript' },
    ],
    styles: [
      'bài toán mô tả bằng lời: hỏi hướng giải tốt nhất hoặc độ phức tạp',
      'đọc 1 hàm thuật toán cơ bản ngắn (bắt buộc kèm code) rồi hỏi kết quả trên 1 input cụ thể',
      'câu hỏi tư duy / logic ngắn kiểu phỏng vấn (không cần code)',
      'tìm lỗi logic hoặc edge case làm thuật toán sai',
    ],
    guidance: [
      'Hỏi về TƯ DUY THUẬT TOÁN: nhận ra pattern, chọn hướng giải, độ phức tạp, tính đúng sai, edge case, trace thuật toán trên input nhỏ.',
      'Khi hỏi kết quả của code: dùng thuật toán cơ bản (sort, search, đệ quy, stack/queue, duyệt mảng/đồ thị, DP nhỏ), input nhỏ để tính tay được trong 1-2 phút.',
    ].join('\n'),
    subtopics: [
      'ước lượng độ phức tạp thời gian / bộ nhớ của một cách giải',
      'two pointers',
      'sliding window',
      'binary search, kể cả binary search trên đáp án',
      'heap / priority queue: top-k, merge k danh sách',
      'BFS vs DFS: chọn cái nào cho bài toán nào',
      'dynamic programming: xác định state và công thức truy hồi',
      'greedy: khi nào greedy đúng, phản ví dụ khi greedy sai',
      'trie cho bài toán tiền tố',
      'union-find: thành phần liên thông, phát hiện chu trình',
      'prefix sum + hash map',
      'stack / monotonic stack',
      'đệ quy / backtracking: đếm số trạng thái, cắt nhánh',
      'topological sort và phụ thuộc vòng',
      'shortest path: Dijkstra vs BFS vs Bellman-Ford',
      'sắp xếp: merge sort, quick sort, quickselect, tính ổn định',
      'cấu trúc dữ liệu phù hợp cho yêu cầu thao tác (LRU cache, interval, ...)',
      'bài phỏng vấn kinh điển: two sum, valid parentheses, reverse linked list, detect cycle',
    ],
  },
  {
    slot: 1,
    key: 'devops',
    name: 'DevOps',
    emoji: '🛠️',
    languages: [
      { name: 'Dockerfile', tag: 'dockerfile' },
      { name: 'YAML (docker-compose / Kubernetes / CI)', tag: 'yaml' },
      { name: 'bash cơ bản', tag: 'bash' },
    ],
    styles: COMMON_STYLES,
    guidance:
      'Tập trung vào nguyên lý vận hành và xử lý sự cố mà dev nào cũng nên biết (deploy, container, scaling, monitoring). Nếu có code/config thì ngắn, dạng phổ biến, hỏi về ý nghĩa/hệ quả chứ không hỏi flag hiếm.',
    subtopics: [
      'Docker layer cache và thứ tự lệnh trong Dockerfile',
      'Docker multi-stage build, giảm kích thước image',
      'container vs VM',
      'Kubernetes liveness / readiness probe',
      'Kubernetes resource requests / limits, OOMKilled',
      'rolling update, blue-green, canary: chọn chiến lược nào',
      'zero-downtime deploy và rollback',
      'CI/CD pipeline: các stage, cache, artifact',
      'load balancer: thuật toán phân tải, health check, sticky session',
      'reverse proxy, SSL termination',
      'graceful shutdown, SIGTERM vs SIGKILL',
      'log, metric, trace: dùng cái nào để điều tra sự cố',
      'alerting: chọn metric để cảnh báo (latency, error rate, saturation)',
      'phỏng vấn: service production đột nhiên chậm, điều tra thế nào',
      'phỏng vấn: horizontal vs vertical scaling, autoscaling',
      'secret management, 12-factor app, config qua biến môi trường',
      'Infrastructure as Code, drift, idempotency',
    ],
  },
  {
    slot: 2,
    key: 'design',
    name: 'Solution / System Design',
    emoji: '🏗️',
    languages: [],
    styles: COMMON_STYLES,
    subtopics: [
      'cache-aside, write-through, write-back',
      'cache stampede / thundering herd',
      'cache invalidation',
      'message queue: at-least-once, ordering, consumer group',
      'idempotency key cho API thanh toán',
      'rate limiting: token bucket, sliding window',
      'database replication và replication lag',
      'sharding / partitioning, chọn shard key',
      'CAP và PACELC trong tình huống thực tế',
      'distributed lock và fencing token',
      'circuit breaker, retry với exponential backoff và jitter',
      'saga pattern và transactional outbox',
      'consistent hashing',
      'event sourcing / CQRS',
      'phỏng vấn: thiết kế URL shortener',
      'phỏng vấn: thiết kế hệ thống notification / news feed',
      'phỏng vấn: thiết kế hệ thống chat realtime (WebSocket, fan-out)',
      'phỏng vấn: thiết kế upload / xử lý file lớn',
      'phỏng vấn: xử lý flash sale, chống bán quá số lượng tồn kho',
      'monolith vs microservices: khi nào tách',
      'sync vs async giữa các service, backpressure',
    ],
  },
  {
    slot: 3,
    key: 'db',
    name: 'Database',
    emoji: '🗄️',
    languages: [{ name: 'SQL chuẩn (tránh cú pháp riêng của từng hệ quản trị)', tag: 'sql' }],
    styles: [
      ...COMMON_STYLES,
      'đọc SQL đoán kết quả (bắt buộc kèm code): code gồm dữ liệu mẫu 1-2 bảng nhỏ (tối đa 4 dòng mỗi bảng, ghi gọn dạng comment hoặc 1 lệnh INSERT) và 1 câu query; hỏi query trả về gì (số dòng, giá trị cụ thể, hoặc tập kết quả). Nếu chủ đề con không hợp với dạng này thì chọn tình huống SQL gần nhất (JOIN, NULL, GROUP BY/HAVING, window function, subquery, DISTINCT, ORDER BY/LIMIT)',
    ],
    guidance: [
      'Hỏi nguyên lý chung áp dụng cho các RDBMS phổ biến (MySQL, PostgreSQL, ...) và NoSQL/cache; nếu hành vi khác nhau giữa các hệ thì phải ghi rõ hệ nào trong đề.',
      'Với câu đọc SQL đoán kết quả: dùng cú pháp chạy giống nhau trên MySQL 8 và PostgreSQL; kết quả phải xác định duy nhất (có ORDER BY nếu hỏi thứ tự, không phụ thuộc thứ tự dòng mặc định); các đáp án sai là kết quả khi hiểu nhầm NULL, JOIN, GROUP BY, thứ tự thực thi WHERE/HAVING...; tự tính lại kết quả thật cẩn thận trước khi trả lời.',
    ].join('\n'),
    subtopics: [
      'composite index và thứ tự cột (leftmost prefix)',
      'khi nào index không được dùng',
      'transaction isolation level và các hiện tượng đọc',
      'deadlock và cách phòng tránh',
      'optimistic lock vs pessimistic lock',
      'N+1 query',
      'MVCC',
      'keyset pagination vs OFFSET',
      'Redis: dùng làm cache, TTL, eviction',
      'JOIN và NULL, LEFT JOIN với điều kiện WHERE',
      'GROUP BY / HAVING / window function',
      'phỏng vấn: ACID là gì trong tình huống cụ thể',
      'phỏng vấn: SQL vs NoSQL, chọn loại nào cho bài toán',
      'phỏng vấn: query chậm, tối ưu thế nào',
      'chuẩn hoá vs phi chuẩn hoá',
      'connection pool',
      'migration schema không downtime',
      'đếm / chống trùng khi nhiều request ghi đồng thời',
    ],
  },
  {
    slot: 4,
    key: 'backend',
    name: 'Backend / Network / Security',
    emoji: '🔐',
    languages: [{ name: 'JavaScript cơ bản (đọc như pseudocode)', tag: 'javascript' }],
    styles: COMMON_STYLES,
    guidance:
      'Hỏi kiến thức backend dùng chung cho mọi ngôn ngữ (HTTP, auth, bảo mật, network, concurrency, thiết kế API). Không hỏi riêng về framework hay runtime của một ngôn ngữ.',
    subtopics: [
      'HTTP status code trong tình huống thực tế',
      'phỏng vấn: điều gì xảy ra khi gõ URL vào trình duyệt',
      'REST: idempotent methods, PUT vs PATCH vs POST',
      'REST vs GraphQL vs gRPC',
      'thiết kế API: pagination, versioning, error format',
      'session/cookie vs token (JWT): ưu nhược điểm, thu hồi',
      'OAuth2 / SSO ở mức nguyên lý',
      'CORS và preflight request',
      'HTTP caching: Cache-Control, ETag, 304',
      'TCP vs UDP, keep-alive, WebSocket',
      'SQL injection, XSS, CSRF và cách phòng',
      'hash mật khẩu: bcrypt, salt; hash vs encrypt',
      'race condition khi xử lý request đồng thời',
      'xử lý tác vụ chạy lâu: background job, queue',
      'timeout, retry, graceful shutdown',
      'phỏng vấn: stateless service và scale ngang',
      'HTTPS / TLS ở mức nguyên lý',
      'DNS và TTL',
    ],
  },
  {
    slot: 5,
    key: 'frontend',
    name: 'Frontend',
    emoji: '🎨',
    languages: [
      { name: 'JavaScript', tag: 'javascript' },
      { name: 'CSS', tag: 'css' },
    ],
    styles: COMMON_STYLES,
    guidance:
      'Hỏi kiến thức nền của web/browser/JavaScript mà dev nào cũng gặp. Nếu hỏi về component framework thì dùng khái niệm chung (component, state, re-render, virtual DOM, hydration) chứ không hỏi API riêng của React/Vue/Angular.',
    subtopics: [
      'event loop: microtask vs macrotask, thứ tự log',
      'closure và this',
      'Promise, async/await và xử lý lỗi',
      'debounce vs throttle',
      'event delegation, bubbling / capturing',
      'virtual DOM và re-render không cần thiết',
      'state management: khi nào cần global state',
      'CSS specificity, box model',
      'CSS flexbox / grid: chọn cái nào',
      'CSR vs SSR vs SSG, ảnh hưởng tới SEO',
      'hydration và hydration mismatch',
      'reflow / repaint, layout thrashing',
      'Core Web Vitals: LCP, INP, CLS',
      'phỏng vấn: tối ưu trang load chậm',
      'phỏng vấn: render danh sách 10.000 dòng (virtualization, pagination)',
      'lưu token ở đâu: cookie HttpOnly vs localStorage',
      'bundle size, code splitting, lazy loading, tree shaking',
      'browser caching, service worker ở mức nguyên lý',
    ],
  },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
export const DEFAULT_DIFFICULTY = 'khó, dành cho developer đã đi làm 3-5 năm; cần suy luận nhiều bước, đáp án sai là bẫy hợp lý';

// Dòng tiêu đề của mỗi câu, ví dụ "[1/6] 🧮 Thuật toán & CTDL"
export function questionHeader(topic) {
  return `[${topic.slot + 1}/${QUESTIONS_PER_DAY}] ${topic.emoji} ${topic.name}`;
}

// Giới hạn cứng của Telegram poll
export const POLL_QUESTION_MAX = 300;
export const POLL_OPTION_MAX = 100;

export function getTopic(slotOrKey) {
  const s = String(slotOrKey);
  return TOPICS.find((t) => String(t.slot) === s || t.key === s) || null;
}

// "123:Hiếu,456:An" -> [{ id: '123', name: 'Hiếu' }, ...]
export function parseMembers(raw) {
  return String(raw || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf(':');
      const id = (i === -1 ? part : part.slice(0, i)).trim();
      const name = (i === -1 ? '' : part.slice(i + 1)).trim();
      return { id, name: name || id };
    })
    .filter((m) => /^\d+$/.test(m.id));
}

export function getMembers() {
  return parseMembers(process.env.MEMBERS);
}

export function getAdminIds() {
  return new Set(
    String(process.env.ADMIN_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function getChatId() {
  return String(process.env.TELEGRAM_CHAT_ID || '').trim();
}

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

// LLM_PROVIDER=groq|gemini; bỏ trống thì dùng groq nếu có GROQ_API_KEY, ngược lại gemini
export function getProvider() {
  const p = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (p === 'groq' || p === 'gemini') return p;
  return process.env.GROQ_API_KEY ? 'groq' : 'gemini';
}

export function getGeminiModel() {
  return (process.env.GEMINI_MODEL || '').trim() || DEFAULT_GEMINI_MODEL;
}

export function getGroqModel() {
  return (process.env.GROQ_MODEL || '').trim() || DEFAULT_GROQ_MODEL;
}

// Model dự phòng khi model chính hết quota (mỗi model có quota riêng). "none" để tắt.
export const DEFAULT_GROQ_FALLBACK_MODEL = 'openai/gpt-oss-20b';

export function getGroqModels() {
  const fallback = (process.env.GROQ_FALLBACK_MODEL ?? '').trim() || DEFAULT_GROQ_FALLBACK_MODEL;
  return [getGroqModel(), ...(fallback.toLowerCase() === 'none' ? [] : [fallback])];
}

export function getModelLabel() {
  return getProvider() === 'groq' ? `groq/${getGroqModel()}` : `gemini/${getGeminiModel()}`;
}

export function getDifficulty() {
  return (process.env.QUIZ_DIFFICULTY || '').trim() || DEFAULT_DIFFICULTY;
}
