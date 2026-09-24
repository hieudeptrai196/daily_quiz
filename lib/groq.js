// Gọi Groq (API tương thích OpenAI) bằng fetch, trả về JSON theo schema (structured outputs, strict).

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Strict mode của Groq: mọi object cần additionalProperties:false và required đủ field;
// bỏ các keyword không chắc được hỗ trợ (đã có validate bằng code phía sau).
const UNSUPPORTED_KEYS = new Set(['minItems', 'maxItems', 'minimum', 'maximum', 'propertyOrdering']);

export function toStrictSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toStrictSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (UNSUPPORTED_KEYS.has(k)) continue;
    out[k] = k === 'properties'
      ? Object.fromEntries(Object.entries(v).map(([p, s]) => [p, toStrictSchema(s)]))
      : toStrictSchema(v);
  }
  if (out.type === 'object') {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties || {});
  }
  return out;
}

// GROQ_API_KEY có thể chứa nhiều key cách nhau dấu phẩy. Quota Groq tính theo organization,
// nên chỉ có tác dụng khi các key thuộc các tài khoản Groq khác nhau.
export function getGroqKeys() {
  return [...new Set(String(process.env.GROQ_API_KEY || '').split(/[\s,]+/).filter(Boolean))];
}

// (model, key) bị rate limit: bỏ qua tới thời điểm reset, trong vòng đời của process
const blockedUntil = new Map();

/**
 * Thử lần lượt các cặp (model, key): ưu tiên model chính trên mọi key, rồi mới tới model dự phòng.
 * Mỗi lần gọi bắt đầu từ 1 key ngẫu nhiên để chia đều quota. Bị 429 thì chuyển sang cặp khác;
 * hết cặp thì đợi nếu kịp (giới hạn theo phút), không thì báo hết quota.
 */
export async function groqJson({ system, prompt, schema, schemaName, temperature, timeoutMs, models, reasoningEffort }) {
  const keys = getGroqKeys();
  if (!keys.length) throw new Error('Thiếu GROQ_API_KEY');

  const deadline = Date.now() + timeoutMs;
  const start = Math.floor(Math.random() * keys.length);
  const rotated = keys.map((_, i) => keys[(start + i) % keys.length]);
  const pairs = [...new Set(models.filter(Boolean))].flatMap((model) =>
    rotated.map((key) => ({ model, key, id: `${model}|${key}`, label: `${model} key#${keys.indexOf(key) + 1}` })),
  );
  let lastErr = null;

  for (;;) {
    const pair = pairs.find((p) => (blockedUntil.get(p.id) || 0) <= Date.now());
    if (!pair) {
      // Mọi cặp đều đang bị chặn: đợi cặp sớm nhất nếu kịp và không phải quota ngày
      const soonest = Math.min(...pairs.map((p) => blockedUntil.get(p.id)));
      if (!lastErr.daily && soonest <= deadline - 10_000) {
        console.log(`[llm] Groq rate limit mọi key, đợi ${Math.ceil((soonest - Date.now()) / 1000)}s`);
        await new Promise((r) => setTimeout(r, Math.max(0, soonest - Date.now())));
        continue;
      }
      lastErr.quotaExhausted = true;
      lastErr.retryAfter = Math.ceil((soonest - Date.now()) / 1000);
      throw lastErr;
    }
    try {
      return await groqOnce({
        apiKey: pair.key, system, prompt, schema, schemaName, temperature, model: pair.model, reasoningEffort,
        timeoutMs: deadline - Date.now(),
      });
    } catch (err) {
      if (err.status !== 429) throw err;
      lastErr = err;
      const waitMs = (err.retryAfter ?? 10) * 1000 + 500;
      blockedUntil.set(pair.id, Date.now() + waitMs);
      console.log(`[llm] Groq ${pair.label} bị giới hạn${err.daily ? ' (quota ngày)' : ''}, reset sau ~${Math.ceil(waitMs / 1000)}s`);
    }
  }
}

async function groqOnce({ apiKey, system, prompt, schema, schemaName, temperature, model, reasoningEffort, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_completion_tokens: 8192,
        ...(reasoningEffort && /gpt-oss/.test(model) ? { reasoning_effort: reasoningEffort } : {}),
        response_format: {
          type: 'json_schema',
          json_schema: { name: schemaName, strict: true, schema: toStrictSchema(schema) },
        },
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    // Model sinh JSON lệch schema (hay gặp: bỏ sót field code): Groq trả 400 kèm failed_generation.
    // Lấy JSON đó cho bước validate tự xử lý (thiếu code thì coi như ""), đỡ phí 1 lần thử.
    if (res.status === 400 && data?.error?.code === 'json_validate_failed' && data.error.failed_generation) {
      try {
        const parsed = JSON.parse(data.error.failed_generation);
        console.log(`[llm] groq ${model} ${schemaName}: JSON lệch schema, dùng bản model đã sinh`);
        return parsed;
      } catch {
        // không parse được thì rơi xuống nhánh lỗi bên dưới
      }
    }
    if (!res.ok) {
      const err = new Error(`Groq ${res.status}: ${String(data?.error?.message || res.statusText).replace(/ in organization `[^`]*`/, '')}`);
      err.status = res.status;
      err.model = model;
      const ra = Number(res.headers.get('retry-after'));
      if (Number.isFinite(ra) && ra > 0) err.retryAfter = ra;
      err.daily = /per day|\(TPD\)|\(RPD\)/i.test(String(data?.error?.message));
      throw err;
    }
    console.log(`[llm] groq ${model} ${schemaName}: ${data?.usage?.total_tokens ?? '?'} token`);
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Groq trả về rỗng');
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Groq trả về JSON không parse được');
    }
  } catch (err) {
    if (controller.signal.aborted) throw new Error(`Groq timeout sau ${Math.round(timeoutMs / 1000)}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
