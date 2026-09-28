// Cấu hình chủ đề + đọc biến môi trường.
// Env luôn được đọc lúc gọi hàm (không cache lúc import) để harness có thể đổi env giữa các case.

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

// Mỗi chủ đề có 1 giờ gửi (hour, giờ VN). Mỗi giờ khác nhau là 1 slot trong ngày (slot 0 = giờ sớm nhất).
// Nhiều chủ đề cùng giờ thì XOAY VÒNG theo ngày (theo thứ tự trong mảng): xem topicFor().
// vercel.json phải có 1 cron cho mỗi giờ (cron UTC = (hour - 7 + 24) % 24), harness có kiểm tra.
export const TOPICS = [
  {
    hour: 6,
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
    hour: 7,
    key: 'cloud',
    name: 'Cloud & Serverless',
    emoji: '☁️',
    languages: [],
    styles: COMMON_STYLES,
    guidance:
      'Hỏi khái niệm cloud dùng chung cho AWS / GCP / Azure (object storage, compute, serverless, network, IAM, managed service). Được nhắc tên dịch vụ phổ biến (S3, Lambda, RDS, Cloud Run, ...) nhưng câu hỏi phải trả lời được bằng nguyên lý, không cần nhớ tên tham số hay giá tiền cụ thể.',
    subtopics: [
      'object storage (S3, GCS): khi nào dùng, presigned URL, lifecycle',
      'serverless function: cold start, timeout, giới hạn, khi nào không nên dùng',
      'container trên cloud: serverless container vs Kubernetes managed vs VM',
      'managed database vs tự chạy database trên VM',
      'VPC, public / private subnet, NAT gateway, security group',
      'IAM: least privilege, role vs user vs access key, service account',
      'autoscaling: theo CPU / request / queue, scale-to-zero',
      'load balancer L4 vs L7 trên cloud',
      'CDN và edge cache cho static / API',
      'multi-AZ vs multi-region, RTO / RPO, backup và disaster recovery',
      'Infrastructure as Code: Terraform/CloudFormation, state, drift, idempotency',
      'tối ưu chi phí cloud: reserved / spot, egress, lưu trữ lạnh',
      'secret manager và quản lý cấu hình trên cloud',
      'event-driven trên cloud: trigger từ storage / queue / schedule',
      'shared responsibility model: cloud lo gì, mình lo gì',
      'phỏng vấn: đưa một web app từ 1 server lên cloud chịu tải cao',
      'observability trên cloud: log tập trung, metric, alert, cost alert',
    ],
  },
  {
    hour: 7,
    key: 'ai',
    name: 'AI cho Developer',
    emoji: '🤖',
    languages: [],
    styles: COMMON_STYLES,
    guidance:
      'Hỏi kiến thức thực dụng khi developer dùng hoặc tích hợp LLM (không phải lý thuyết machine learning). Không phụ thuộc nhà cung cấp; nếu nhắc tên model/dịch vụ thì câu hỏi vẫn phải trả lời được bằng nguyên lý.',
    subtopics: [
      'token, context window và chi phí khi gọi LLM',
      'temperature và tính ổn định của output',
      'prompt rõ ràng: vai trò, ví dụ mẫu (few-shot), định dạng đầu ra',
      'structured output / JSON schema: vì sao cần, khi nào vẫn lỗi',
      'hallucination: nguyên nhân và cách giảm',
      'RAG: chunking, embedding, vector search, top-k',
      'embedding và similarity: dùng cho search / dedupe / phân loại',
      'fine-tune vs RAG vs prompt: chọn cách nào',
      'function calling / tool use và agent ở mức nguyên lý',
      'prompt injection và dữ liệu không tin cậy trong prompt',
      'không đưa secret / dữ liệu cá nhân vào prompt',
      'rate limit, retry, timeout khi gọi API LLM',
      'cache kết quả LLM, prompt caching',
      'đánh giá chất lượng output LLM (eval, test bộ câu mẫu)',
      'review code do AI viết: lỗi hay gặp',
      'phỏng vấn: thêm tính năng chatbot hỏi đáp tài liệu nội bộ',
    ],
  },
  {
    hour: 8,
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
      'phỏng vấn: horizontal vs vertical scaling',
      'secret management, 12-factor app, config qua biến môi trường',
      'docker-compose cho môi trường dev: network, volume, depends_on',
    ],
  },
  {
    hour: 8,
    key: 'linux',
    name: 'Linux & Shell',
    emoji: '🐧',
    languages: [{ name: 'bash cơ bản (lệnh phổ biến)', tag: 'bash' }],
    styles: [
      ...COMMON_STYLES,
      'đọc 1 lệnh hoặc script bash ngắn (bắt buộc kèm code) rồi hỏi kết quả / tác dụng',
    ],
    guidance:
      'Hỏi thao tác Linux mà developer dùng khi vận hành và debug server/container. Chỉ dùng lệnh phổ biến (ps, top, kill, ls, chmod, grep, tail, awk, sed, find, curl, ss/netstat, df, du...), không hỏi flag hiếm.',
    subtopics: [
      'process: ps, top, trạng thái zombie, process mồ côi',
      'signal: kill, SIGTERM vs SIGKILL vs SIGHUP',
      'port đang bị chiếm, tìm process đang listen',
      'permission: chmod, chown, rwx, user/group, sudo',
      'đọc log: tail -f, grep, lọc theo thời gian',
      'pipe và redirect: |, >, >>, 2>&1, /dev/null',
      'exit code, && và ||, set -e trong script',
      'biến môi trường, export, PATH, .bashrc',
      'disk đầy: df vs du, file đã xoá nhưng vẫn chiếm dung lượng',
      'memory: free, swap, OOM killer',
      'file descriptor và giới hạn ulimit',
      'cron job: cú pháp, môi trường chạy khác shell',
      'systemd service: restart tự động, xem log',
      'curl để debug HTTP: header, status, timeout',
      'SSH: key, known_hosts, port forwarding',
      'tìm file và text: find, grep -r, xargs',
      'phỏng vấn: server chậm bất thường, kiểm tra những gì',
    ],
  },
  {
    hour: 9,
    key: 'redis',
    name: 'Redis & Caching',
    emoji: '⚡',
    languages: [{ name: 'lệnh Redis (redis-cli)', tag: 'redis' }],
    styles: [
      ...COMMON_STYLES,
      'đọc chuỗi lệnh Redis ngắn (bắt buộc kèm code, tối đa ~8 lệnh) rồi hỏi kết quả của lệnh cuối',
    ],
    guidance:
      'Hỏi về cách dùng Redis và caching đúng trong thực tế (chọn kiểu dữ liệu, TTL, bộ nhớ, đồng thời, độ bền dữ liệu). Nếu hỏi hành vi phụ thuộc cấu hình (eviction, persistence) thì ghi rõ cấu hình trong đề.',
    subtopics: [
      'chọn kiểu dữ liệu: string, hash, list, set, sorted set cho bài toán cụ thể',
      'TTL, key hết hạn và cách Redis xoá key hết hạn',
      'eviction policy: allkeys-lru, volatile-lru, noeviction khi đầy bộ nhớ',
      'persistence: RDB vs AOF, mất dữ liệu khi crash',
      'Redis đơn luồng: lệnh gây block (KEYS, lệnh O(n) trên key lớn), big key, hot key',
      'atomic: INCR, SETNX, MULTI/EXEC, Lua script',
      'distributed lock bằng Redis: SET NX PX, hết hạn giữa chừng',
      'rate limiting bằng Redis: fixed window, sliding window',
      'leaderboard / ranking bằng sorted set',
      'pub/sub vs Redis Stream: mất message, consumer group',
      'cache-aside, write-through, write-behind',
      'cache stampede, cache penetration, cache avalanche và cách chống',
      'cache invalidation khi dữ liệu thay đổi, TTL ngẫu nhiên',
      'session store bằng Redis',
      'replication, Sentinel, Cluster ở mức nguyên lý, hash slot',
      'phỏng vấn: cache không đồng bộ với database, xử lý thế nào',
      'đọc chuỗi lệnh Redis đoán kết quả',
    ],
  },
  {
    hour: 10,
    key: 'design',
    name: 'Solution / System Design',
    emoji: '🏗️',
    languages: [],
    styles: COMMON_STYLES,
    subtopics: [
      'chọn chiến lược cache cho một hệ thống cụ thể',
      'idempotency key cho API thanh toán',
      'rate limiting: token bucket, sliding window, đặt ở đâu',
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
      'phỏng vấn: hệ thống đặt vé / booking chống double-booking',
      'monolith vs microservices: khi nào tách',
      'sync vs async giữa các service, backpressure',
      'API gateway, BFF (backend for frontend)',
    ],
  },
  {
    hour: 11,
    key: 'mq',
    name: 'Message Queue & Event-driven',
    emoji: '📨',
    languages: [],
    styles: COMMON_STYLES,
    guidance:
      'Hỏi nguyên lý message queue / event streaming dùng chung (Kafka, RabbitMQ, SQS, ...). Được nhắc tên công cụ nhưng câu hỏi phải trả lời được bằng nguyên lý; nếu hành vi khác nhau giữa các công cụ thì ghi rõ công cụ nào trong đề.',
    subtopics: [
      'queue vs pub/sub vs event stream: chọn cái nào',
      'at-most-once, at-least-once, exactly-once: đạt được bằng cách nào',
      'consumer idempotent, xử lý message trùng',
      'thứ tự message: partition key, ordering trong 1 partition',
      'consumer group, số partition và số consumer',
      'ack / nack, visibility timeout, message bị xử lý 2 lần',
      'retry, backoff và dead letter queue (DLQ)',
      'poison message làm kẹt queue',
      'consumer lag: nguyên nhân và cách xử lý',
      'backpressure khi producer nhanh hơn consumer',
      'transactional outbox: ghi DB và gửi message nhất quán',
      'Kafka: offset, commit offset, retention, replay',
      'RabbitMQ: exchange (direct, topic, fanout), routing key',
      'event schema, versioning, tương thích ngược',
      'event-driven vs request/response giữa các service',
      'phỏng vấn: gửi email / notification hàng loạt không mất, không trùng',
      'phỏng vấn: xử lý đơn hàng qua nhiều service bằng event',
    ],
  },
  {
    hour: 12,
    key: 'db',
    name: 'Database',
    emoji: '🗄️',
    languages: [{ name: 'SQL chuẩn (tránh cú pháp riêng của từng hệ quản trị)', tag: 'sql' }],
    styles: [
      ...COMMON_STYLES,
      'đọc SQL đoán kết quả (bắt buộc kèm code): code gồm dữ liệu mẫu 1-2 bảng nhỏ (tối đa 4 dòng mỗi bảng, ghi gọn dạng comment hoặc 1 lệnh INSERT) và 1 câu query; hỏi query trả về gì (số dòng, giá trị cụ thể, hoặc tập kết quả). Nếu chủ đề con không hợp với dạng này thì chọn tình huống SQL gần nhất (JOIN, NULL, GROUP BY/HAVING, window function, subquery, DISTINCT, ORDER BY/LIMIT)',
    ],
    guidance: [
      'Hỏi nguyên lý chung áp dụng cho các RDBMS phổ biến (MySQL, PostgreSQL, ...) và NoSQL; nếu hành vi khác nhau giữa các hệ thì phải ghi rõ hệ nào trong đề.',
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
      'NoSQL document store: khi nào dùng, thiết kế document',
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
    hour: 13,
    key: 'testing',
    name: 'Testing & Code Quality',
    emoji: '🧪',
    languages: [{ name: 'JavaScript cơ bản (đọc như pseudocode)', tag: 'javascript' }],
    styles: [
      ...COMMON_STYLES,
      'đọc 1 đoạn test hoặc code ngắn (bắt buộc kèm code) rồi chỉ ra vấn đề hoặc cách sửa đúng',
    ],
    guidance:
      'Hỏi nguyên lý kiểm thử và chất lượng code dùng chung cho mọi ngôn ngữ; không hỏi API riêng của Jest/JUnit/PHPUnit. Code minh hoạ viết như pseudocode, dùng hàm test/expect chung chung.',
    subtopics: [
      'test pyramid: unit vs integration vs e2e, tỉ lệ hợp lý',
      'mock vs stub vs fake vs spy',
      'mock quá nhiều: test pass nhưng code vẫn sai',
      'test flaky: nguyên nhân (thời gian, thứ tự, dữ liệu dùng chung) và cách sửa',
      'test phụ thuộc thời gian / ngẫu nhiên: cách kiểm soát',
      'code coverage: con số cao nhưng vẫn thiếu test',
      'TDD: red-green-refactor, khi nào có lợi',
      'test database: transaction rollback, test container, dữ liệu mẫu',
      'contract test giữa các service',
      'boundary value và edge case cần test',
      'code smell: hàm dài, tham số nhiều, duplicate, magic number',
      'refactor an toàn: có test trước, bước nhỏ',
      'code review: nên soi gì, lỗi hay bị bỏ sót',
      'đặt tên, hàm làm 1 việc, tách hàm',
      'xử lý lỗi: nuốt exception, lỗi im lặng',
      'technical debt: khi nào trả, khi nào chấp nhận',
      'phỏng vấn: viết test cho một hàm có gọi API bên ngoài',
    ],
  },
  {
    hour: 13,
    key: 'git',
    name: 'Git & Teamwork',
    emoji: '🌿',
    languages: [{ name: 'lệnh git', tag: 'bash' }],
    styles: [
      ...COMMON_STYLES,
      'cho 1 chuỗi lệnh git ngắn (bắt buộc kèm code, tối đa ~8 lệnh) rồi hỏi trạng thái lịch sử / nhánh sau khi chạy',
    ],
    guidance:
      'Hỏi cách dùng git và quy trình làm việc nhóm trong tình huống thực tế (xử lý sự cố, giữ lịch sử sạch, không làm mất code của người khác). Chỉ dùng lệnh git phổ biến.',
    subtopics: [
      'merge vs rebase: lịch sử khác nhau thế nào, khi nào dùng',
      'xử lý conflict khi merge / rebase',
      'revert vs reset (soft, mixed, hard)',
      'đã push rồi mới phát hiện commit sai: sửa thế nào an toàn',
      'force push: rủi ro, --force-with-lease',
      'cherry-pick một fix sang nhánh release',
      'stash: lưu tạm thay đổi, stash bị conflict',
      'commit lỡ chứa secret: xử lý thế nào',
      'squash commit, interactive rebase, commit message tốt',
      'branching strategy: Git Flow vs trunk-based',
      'pull request: kích thước hợp lý, review, CI bắt buộc',
      'tag và release, semantic versioning',
      '.gitignore: file đã được track rồi mới ignore',
      'detached HEAD: là gì, cứu commit',
      'reflog: tìm lại commit tưởng đã mất',
      'git bisect: tìm commit gây lỗi',
      'phỏng vấn: 2 người sửa cùng file, quy trình tránh mất code',
    ],
  },
  {
    hour: 14,
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
      'xử lý tác vụ chạy lâu: background job',
      'timeout, retry, graceful shutdown',
      'phỏng vấn: stateless service và scale ngang',
      'HTTPS / TLS ở mức nguyên lý',
      'DNS và TTL',
    ],
  },
  {
    hour: 15,
    key: 'oop',
    name: 'OOP & Design Pattern',
    emoji: '🧩',
    languages: [{ name: 'TypeScript cơ bản (class, interface; đọc như pseudocode)', tag: 'typescript' }],
    styles: [
      ...COMMON_STYLES,
      'đọc 1 thiết kế class ngắn (bắt buộc kèm code) rồi chỉ ra nguyên tắc bị vi phạm hoặc pattern phù hợp để sửa',
    ],
    guidance:
      'Hỏi nguyên lý thiết kế hướng đối tượng dùng chung cho Java, C#, TypeScript, PHP, Python... Không hỏi cú pháp riêng của ngôn ngữ; code chỉ để minh hoạ thiết kế.',
    subtopics: [
      'Single Responsibility: class làm quá nhiều việc',
      'Open/Closed: thêm tính năng mà không sửa code cũ',
      'Liskov Substitution: class con phá vỡ hành vi class cha',
      'Interface Segregation: interface quá to',
      'Dependency Inversion và Dependency Injection',
      'composition vs inheritance',
      'encapsulation: lộ trạng thái nội bộ, getter/setter tràn lan',
      'Strategy pattern thay cho if/else hoặc switch dài',
      'Observer / event: thông báo nhiều nơi khi có thay đổi',
      'Factory / Abstract Factory: tạo đối tượng theo điều kiện',
      'Singleton: khi nào dùng, vấn đề khi test và đồng thời',
      'Adapter / Facade: bọc thư viện bên ngoài',
      'Decorator: thêm hành vi (log, cache, retry) không sửa class gốc',
      'Repository và tách tầng (controller / service / repository)',
      'anti-pattern: God object, anemic model, tight coupling',
      'immutable object và value object',
      'phỏng vấn: thiết kế class cho hệ thống thanh toán nhiều phương thức',
    ],
  },
  {
    hour: 15,
    key: 'concurrency',
    name: 'Concurrency & Đa luồng',
    emoji: '🔀',
    languages: [
      { name: 'JavaScript cơ bản (async/await, Promise)', tag: 'javascript' },
      { name: 'Java đơn giản (Thread, synchronized, ExecutorService; đọc như pseudocode)', tag: 'java' },
    ],
    styles: [
      ...COMMON_STYLES,
      'đọc 1 đoạn code đồng thời ngắn (bắt buộc kèm code) rồi hỏi kết quả có thể xảy ra hoặc lỗi tiềm ẩn',
    ],
    guidance:
      'Hỏi nguyên lý xử lý đồng thời dùng chung cho mọi ngôn ngữ (thread, async, lock, race condition). Khi hỏi kết quả code đồng thời phải nói rõ kết quả nào "luôn" xảy ra và kết quả nào "có thể" xảy ra; không hỏi hành vi phụ thuộc may rủi mà đề không nói rõ.',
    subtopics: [
      'race condition: đọc-sửa-ghi không atomic',
      'deadlock: 4 điều kiện, thứ tự lấy lock',
      'mutex vs semaphore vs read-write lock',
      'atomic operation, compare-and-swap',
      'thread pool: kích thước, hàng đợi đầy, CPU-bound vs IO-bound',
      'async/await vs thread: khác nhau khi chạy',
      'Promise.all vs Promise.allSettled vs chạy tuần tự',
      'giới hạn số tác vụ chạy song song (concurrency limit)',
      'event loop bị block bởi tác vụ CPU nặng',
      'visibility và memory ordering ở mức nguyên lý (volatile)',
      'producer-consumer và bounded queue',
      'double-checked locking, khởi tạo lười an toàn',
      'livelock và starvation',
      'timeout và huỷ tác vụ (cancellation)',
      'idempotent khi retry song song',
      'phỏng vấn: 2 request cùng trừ tồn kho, xử lý thế nào',
      'đọc code đồng thời đoán kết quả có thể xảy ra',
    ],
  },
  {
    hour: 16,
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

// Các giờ gửi trong ngày, tăng dần; slot = vị trí trong mảng này
export const SLOT_HOURS = [...new Set(TOPICS.map((t) => t.hour))].sort((a, b) => a - b);
export const QUESTIONS_PER_DAY = SLOT_HOURS.length;

// Số thứ tự ngày (dùng để xoay vòng chủ đề), từ dayKey "YYYY-MM-DD"
export function dayNumber(day) {
  const [y, m, d] = String(day).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// Các chủ đề dùng chung 1 slot, theo thứ tự xoay vòng
export function topicsOfSlot(slot) {
  return TOPICS.filter((t) => t.hour === SLOT_HOURS[slot]).map((t) => ({ ...t, slot }));
}

// Chủ đề của slot trong ngày: nếu slot có nhiều chủ đề thì luân phiên theo ngày
export function topicFor(day, slot) {
  const candidates = topicsOfSlot(Number(slot));
  if (!candidates.length) return null;
  return candidates[dayNumber(day) % candidates.length];
}

export function topicsForDay(day) {
  return SLOT_HOURS.map((_, slot) => topicFor(day, slot));
}

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
export const DEFAULT_DIFFICULTY = 'khó, dành cho developer đã đi làm 3-5 năm; cần suy luận nhiều bước, đáp án sai là bẫy hợp lý';

// Dòng tiêu đề của mỗi câu, ví dụ "[1/6] 🧮 Thuật toán & CTDL"
export function questionHeader(topic) {
  return `[${topic.slot + 1}/${QUESTIONS_PER_DAY}] ${topic.emoji} ${topic.name}`;
}

// Giới hạn cứng của Telegram poll
export const POLL_QUESTION_MAX = 300;
export const POLL_OPTION_MAX = 100;

// Theo key (bất kể hôm nay có tới lượt không) hoặc theo số slot (chủ đề của slot đó trong ngày `day`)
export function getTopic(slotOrKey, day) {
  const s = String(slotOrKey);
  const byKey = TOPICS.find((t) => t.key === s);
  if (byKey) return { ...byKey, slot: SLOT_HOURS.indexOf(byKey.hour) };
  return /^\d+$/.test(s) && day ? topicFor(day, Number(s)) : null;
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
