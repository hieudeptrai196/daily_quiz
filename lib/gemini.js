// Sinh câu hỏi bằng LLM (Groq hoặc Gemini, chọn qua LLM_PROVIDER) + kiểm tra chéo.
// QUAN TRỌNG: file này KHÔNG bao giờ log đáp án, explanation hay reasoning của solver.
// GEMINI_MOCK=1: không gọi API. GEMINI_MOCK_FAIL_TOPIC=<key>: mock trả dữ liệu hỏng cho chủ đề đó.

import { randomInt } from 'node:crypto';
import {
  GLOBAL_GUIDANCE,
  POLL_OPTION_MAX,
  POLL_QUESTION_MAX,
  getDifficulty,
  getGeminiModel,
  getGroqModels,
  getProvider,
  questionHeader,
} from './config.js';
import { groqJson } from './groq.js';
import {
  GENERATOR_SYSTEM,
  GENERATOR_SCHEMA,
  SOLVER_SYSTEM,
  SOLVER_SCHEMA,
  buildGeneratorPrompt,
  buildSolverPrompt,
} from './prompts.js';

export const LETTERS = ['A', 'B', 'C', 'D'];

const MAX_ATTEMPTS = 5;
export const DEFAULT_BUDGET_MS = 240_000; // maxDuration của function là 300s
const MIN_CALL_MS = 5_000;

// Prompt yêu cầu question ≤ 250, option ≤ 90. Đề dài hơn poll vẫn được chấp nhận: quiz.js sẽ gửi đề đầy đủ
// trong 1 tin nhắn và poll chỉ để chọn A/B/C/D. Giới hạn dưới đây chỉ chặn output rác.
const LIMITS = { question: 600, option: 200, codeLines: 30 };

// Đề vừa hiển thị trọn trong poll Telegram không (tính cả dòng tiêu đề và tiền tố "A. ")
export function fitsInPoll(topic, question, options) {
  return (
    questionHeader(topic).length + 1 + question.length <= POLL_QUESTION_MAX &&
    options.every((o) => o.length + 3 <= POLL_OPTION_MAX)
  );
}

// Chuẩn hoá code cho dễ đọc: bỏ tab, bỏ thụt lề chung, bỏ khoảng trắng cuối dòng
export function formatCode(raw) {
  let code = String(raw).replace(/\r\n?/g, '\n');
  if (!code.includes('\n') && code.includes('\\n')) code = code.replace(/\\n/g, '\n');
  const lines = code
    .replace(/\t/g, '  ')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
  const common = indents.length ? Math.min(...indents) : 0;
  return lines
    .map((l) => l.slice(common))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

// Các lựa chọn kiểu "tất cả / cả hai / không có đáp án nào" không dùng được vì option sẽ bị xáo
const BANNED_OPTION_PATTERNS = [
  /^(tất cả|cả hai|cả ba|all|both|none)[.!]?$/i,
  /tất cả (các |những )?(đáp án|phương án|lựa chọn|ý|câu)/i,
  /tất cả (đều )?(đúng|sai)/i,
  /cả hai (đáp án|phương án|lựa chọn|ý|câu|đều)/i,
  /cả ba (đáp án|phương án|lựa chọn|ý|câu|đều)/i,
  /[Cc]ả [A-D] (và|lẫn) [A-D](?![\wÀ-ỹ])/,
  /không có (đáp án|phương án|lựa chọn|ý|câu) nào/i,
  /không (đáp án|phương án|lựa chọn) nào (đúng|sai)/i,
  /(đáp án|phương án|lựa chọn) [A-D](?![\wÀ-ỹ])/,
  /all of the above|none of the above/i,
  /both [A-D] and [A-D](?![\w])/,
];

function log(msg) {
  console.log(`[llm] ${msg}`);
}

function pick(arr) {
  return arr[randomInt(arr.length)];
}

// Fisher–Yates, trả về options mới + correctIndex mới
export function shuffleOptions(options, correctIndex) {
  const idx = options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return { options: idx.map((i) => options[i]), correctIndex: idx.indexOf(correctIndex) };
}

const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

// Chỉ đếm từ nối tiếng Anh (viết thường hoặc hoa chữ đầu), để tên header/URL/code/SQL không bị tính
const EN_FUNCTION_WORDS = new Set(
  ('the a an and or but to of for with in on at by via from into is are be been was were this that these those ' +
    'which what when where why how if then than only instead will would can could should must not it its all both ' +
    'use using server client request response best while does do')
    .split(' '),
);

// Có từ minWords từ nối tiếng Anh trở lên mà không có ký tự tiếng Việt có dấu nào → coi là tiếng Anh
export function looksEnglish(text, minWords) {
  if (VI_CHARS.test(text)) return false;
  const words = String(text).match(/\b[A-Za-z][a-z]*\b/g) || [];
  return words.filter((w) => EN_FUNCTION_WORDS.has(w.toLowerCase())).length >= minWords;
}

// Đáp án đúng dài hơn hẳn option sai dài nhất thì dễ đoán mò (LLM hay viết đáp án đúng "đầy đủ" hơn)
export function correctStandsOut(options, correctIndex) {
  const correctLen = options[correctIndex].length;
  const longestWrong = Math.max(...options.filter((_, i) => i !== correctIndex).map((o) => o.length));
  return correctLen > longestWrong * 1.2 && correctLen - longestWrong >= 10;
}

// Chuẩn hoá nhẹ rồi kiểm tra. Trả về { q } hoặc { reason } (reason không chứa nội dung đáp án).
export function normalizeAndValidate(raw, { allowCode }) {
  if (!raw || typeof raw !== 'object') return { reason: 'không phải object JSON' };
  const question = typeof raw.question === 'string' ? raw.question.trim() : '';
  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  if (typeof raw.code !== 'string') return { reason: 'code không phải string' };
  const code = formatCode(raw.code);

  if (!question) return { reason: 'thiếu question' };
  if (question.length > LIMITS.question) return { reason: `question dài ${question.length} > ${LIMITS.question}` };
  if (!Array.isArray(raw.options) || raw.options.length !== 4) return { reason: 'không đủ đúng 4 option' };
  const options = raw.options.map((o) =>
    typeof o === 'string' ? o.trim().replace(/^[A-Da-d]\s*[.):]\s+/, '') : '',
  );
  if (options.some((o) => !o)) return { reason: 'có option rỗng' };
  const tooLong = options.find((o) => o.length > LIMITS.option);
  if (tooLong) return { reason: `option dài ${tooLong.length} > ${LIMITS.option}` };
  if (new Set(options.map((o) => o.toLowerCase().replace(/\s+/g, ' '))).size !== 4) return { reason: 'option trùng nhau' };
  if (options.some((o) => BANNED_OPTION_PATTERNS.some((re) => re.test(o)))) {
    return { reason: 'có option kiểu "tất cả / cả hai / không có đáp án"' };
  }
  if (!Number.isInteger(raw.correctIndex) || raw.correctIndex < 0 || raw.correctIndex > 3) {
    return { reason: 'correctIndex không hợp lệ' };
  }
  if (!explanation) return { reason: 'thiếu explanation' };
  if (code && !allowCode) return { reason: 'chủ đề không cho dùng code nhưng có code' };
  if (code && code.split('\n').length > LIMITS.codeLines) return { reason: `code quá ${LIMITS.codeLines} dòng` };
  if (looksEnglish(question, 3) || looksEnglish(explanation, 3) || options.some((o) => looksEnglish(o, 3))) {
    return { reason: 'có phần viết bằng tiếng Anh' };
  }
  if (correctStandsOut(options, raw.correctIndex)) return { reason: 'đáp án đúng dài vượt trội so với đáp án sai' };

  return {
    q: {
      question,
      code,
      options,
      correctIndex: raw.correctIndex,
      explanation,
      summary: (summary || question).slice(0, 120),
    },
  };
}

// ---------- Gemini thật ----------

let client = null;

async function getClient() {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Thiếu GEMINI_API_KEY');
  const { GoogleGenAI } = await import('@google/genai');
  client = new GoogleGenAI({ apiKey });
  return client;
}

async function callJson(opts) {
  if (getProvider() === 'groq') return groqJson({ ...opts, models: getGroqModels() });
  return geminiJson(opts);
}

async function geminiJson({ system, prompt, schema, temperature, timeoutMs }) {
  const ai = await getClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        temperature,
        abortSignal: controller.signal,
      },
    });
    const text = res.text;
    if (!text) throw new Error('Gemini trả về rỗng');
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Gemini trả về JSON không parse được');
    }
  } catch (err) {
    if (controller.signal.aborted) throw new Error(`Gemini timeout sau ${Math.round(timeoutMs / 1000)}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Chỉ lấy dòng đầu, cắt ngắn, che API key; message lỗi của SDK không chứa nội dung đề
function shortError(err) {
  return String(err?.message || err)
    .split('\n')[0]
    .replace(/api_key:[^'"\s]+/g, 'api_key:***')
    .replace(/(AIza|AQ\.|gsk_)[\w.-]{10,}/g, '***')
    .slice(0, 200);
}

// Lỗi key/quyền: thử lại cũng vô ích
function isAuthError(err) {
  const status = err?.status ?? err?.code;
  return status === 401 || status === 403 || /"code":\s*(401|403)|API key not valid|PERMISSION_DENIED/.test(String(err?.message));
}

// ---------- Lý do lỗi dễ hiểu (để báo trong group) ----------

export class QuestionGenerationError extends Error {
  constructor(message, reasons) {
    super(message);
    this.reasons = reasons;
  }
}

// reason nội bộ của normalizeAndValidate -> câu dễ hiểu
export function friendlyReason(reason) {
  const r = String(reason);
  if (/tiếng Anh/.test(r)) return 'LLM viết đề bằng tiếng Anh';
  if (/vượt trội/.test(r)) return 'đáp án đúng dài lộ liễu, dễ đoán';
  if (/tất cả|cả hai/.test(r)) return 'có đáp án kiểu "tất cả / cả hai / không có"';
  if (/trùng/.test(r)) return 'các đáp án bị trùng nhau';
  if (/không cho dùng code/.test(r)) return 'LLM chèn code vào chủ đề không dùng code';
  if (/dòng/.test(r)) return 'code quá dài';
  if (/dài/.test(r)) return 'đề hoặc đáp án quá dài';
  return 'LLM trả về sai định dạng';
}

// lỗi khi gọi API -> câu dễ hiểu (không đưa message gốc vào group)
export function friendlyError(err) {
  const status = err?.status ?? err?.code;
  const msg = String(err?.message || '');
  if (err?.quotaExhausted) {
    const mins = Math.ceil((err.retryAfter ?? 60) / 60);
    return `hết quota token ${err.daily ? 'trong ngày' : ''} của Groq (cả model dự phòng), reset sau ~${mins} phút`.replace('  ', ' ');
  }
  if (status === 429 || /429|rate limit|quota/i.test(msg)) return 'LLM quá giới hạn request/token (rate limit)';
  if (/timeout/i.test(msg)) return 'hết thời gian chờ LLM';
  if (isAuthError(err)) return 'API key LLM bị từ chối';
  if (/JSON/.test(msg)) return 'LLM trả về sai định dạng';
  if (Number(status) >= 500 || /\b5\d\d\b|overloaded|unavailable/i.test(msg)) return 'server LLM đang lỗi / quá tải';
  return 'lỗi khi gọi API LLM';
}

// ["a","a","b"] -> "2× a, 1× b"
export function summarizeReasons(reasons) {
  const counts = new Map();
  for (const r of reasons) counts.set(r, (counts.get(r) || 0) + 1);
  return [...counts]
    .sort((x, y) => y[1] - x[1])
    .map(([r, n]) => (n > 1 ? `${n}× ${r}` : r))
    .join('; ');
}

// ---------- Mock ----------

function mockGenerate(topic, subtopic, language) {
  if (process.env.GEMINI_MOCK_FAIL_TOPIC === topic.key) {
    return { question: '', code: 1, options: ['x', 'x'], correctIndex: 9, explanation: '', summary: '' };
  }
  const correctIndex = randomInt(4);
  const tag = randomInt(1_000_000);
  const options = [0, 1, 2, 3].map((i) =>
    i === correctIndex ? `Phương án đúng về ${subtopic} (#${tag})` : `Phương án sai số ${i + 1} về ${subtopic}`,
  );
  const code = language
    ? `// mock ${language.name}\nif (a < b && c > d) {\n  print("<b>không phải HTML</b> & ok");\n}`
    : '';
  // GEMINI_MOCK_LONG_TOPIC=<key>: đề dài hơn giới hạn poll để test nhánh gửi đề trong tin nhắn riêng
  const padding = process.env.GEMINI_MOCK_LONG_TOPIC === topic.key ? ' Bối cảnh dài dòng để vượt giới hạn poll.'.repeat(10) : '';
  return {
    question: `[mock] Câu hỏi về ${subtopic}${padding}${code ? ' — đoạn code trên in ra gì?' : '?'}`,
    code,
    options,
    correctIndex,
    explanation: `[mock] Giải thích câu ${topic.key} #${tag}`,
    summary: `mock ${topic.key}: ${subtopic} #${tag}`,
  };
}

// ---------- API chính ----------

/**
 * Sinh 1 câu đã qua validate + xáo đáp án + kiểm tra chéo.
 * Trả về { question, code, codeTag, language, subtopic, options, correctIndex, explanation, summary, attempts }.
 */
export async function generateVerifiedQuestion(topic, { history = [], budgetMs = DEFAULT_BUDGET_MS } = {}) {
  const isMock = process.env.GEMINI_MOCK === '1';
  const deadline = Date.now() + budgetMs;
  const difficulty = getDifficulty();
  const failures = []; // lý do từng lần thử hỏng (dạng dễ hiểu, không chứa nội dung đề/đáp án)
  const fail = (tagLog, internal, friendly) => {
    log(`${tagLog} loại: ${internal}`);
    failures.push(friendly);
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const subtopic = pick(topic.subtopics);
    const language = topic.languages.length ? pick(topic.languages) : null;
    const style = topic.styles?.length ? pick(topic.styles) : null;
    const tagLog = `topic=${topic.key} attempt=${attempt}/${MAX_ATTEMPTS} sub="${subtopic}" style="${style ?? '-'}"`;

    try {
      // 1) Sinh đề
      let raw;
      if (isMock) {
        raw = mockGenerate(topic, subtopic, language);
      } else {
        const remaining = deadline - Date.now();
        if (remaining < MIN_CALL_MS) {
          fail(tagLog, 'hết thời gian', 'hết thời gian chờ LLM');
          break;
        }
        raw = await callJson({
          system: GENERATOR_SYSTEM,
          prompt: buildGeneratorPrompt({
            topicName: topic.name,
            subtopic,
            difficulty,
            language: language?.name,
            style,
            guidance: [GLOBAL_GUIDANCE, topic.guidance].filter(Boolean).join('\n'),
            history,
          }),
          schema: GENERATOR_SCHEMA,
          schemaName: 'quiz_question',
          reasoningEffort: 'low', // tiết kiệm token; bước kiểm tra chéo vẫn suy luận kỹ
          temperature: 1.0,
          timeoutMs: remaining,
        });
      }

      // 2) Validate
      const { q, reason } = normalizeAndValidate(raw, {
        allowCode: Boolean(language),
      });
      if (!q) {
        fail(tagLog, reason, friendlyReason(reason));
        continue;
      }

      // 3) Xáo đáp án
      const shuffled = shuffleOptions(q.options, q.correctIndex);
      const expected = LETTERS[shuffled.correctIndex];

      // 4) Kiểm tra chéo (không đưa đáp án cho solver)
      let verdict;
      if (isMock) {
        verdict = { answer: expected, valid: true };
      } else {
        const remaining = deadline - Date.now();
        if (remaining < MIN_CALL_MS) {
          fail(tagLog, 'hết thời gian trước khi kiểm tra chéo', 'hết thời gian chờ LLM');
          break;
        }
        verdict = await callJson({
          system: SOLVER_SYSTEM,
          prompt: buildSolverPrompt({
            question: q.question,
            code: q.code,
            codeTag: language?.tag,
            options: shuffled.options,
          }),
          schema: SOLVER_SCHEMA,
          schemaName: 'quiz_answer',
          reasoningEffort: 'medium',
          temperature: 0,
          timeoutMs: remaining,
        });
      }

      if (verdict?.valid !== true) {
        fail(tagLog, 'solver đánh giá đề không hợp lệ', 'kiểm tra chéo đánh giá đề mơ hồ / có vấn đề');
        continue;
      }
      if (verdict?.answer !== expected) {
        fail(tagLog, 'solver chọn khác đáp án của đề', 'kiểm tra chéo giải ra đáp án khác (đề có thể sai)');
        continue;
      }

      log(`${tagLog} OK`);
      return {
        ...q,
        options: shuffled.options,
        correctIndex: shuffled.correctIndex,
        codeTag: q.code ? language?.tag || '' : '',
        language: q.code ? language?.name || '' : '',
        subtopic,
        style,
        attempts: attempt,
      };
    } catch (err) {
      log(`${tagLog} lỗi: ${shortError(err)}`);
      failures.push(friendlyError(err));
      if (err?.quotaExhausted) break; // hết quota: thử tiếp cũng vô ích
      if (isAuthError(err)) {
        const keyVar = getProvider() === 'groq' ? 'GROQ_API_KEY' : 'GEMINI_API_KEY';
        throw new QuestionGenerationError(`${getProvider()} từ chối API key (401/403): kiểm tra ${keyVar}`, [
          `API key ${getProvider()} bị từ chối, cần kiểm tra ${keyVar}`,
        ]);
      }
    }
  }

  throw new QuestionGenerationError(
    `Không sinh được câu hỏi hợp lệ cho chủ đề ${topic.key} sau ${failures.length} lần thử`,
    failures,
  );
}
