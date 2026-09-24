// Upstash Redis client, và MemoryStore mô phỏng đúng các lệnh bot dùng (chỉ cho harness).

let cached = null;

export async function getStore() {
  if (cached) return cached;
  if (process.env.ALLOW_MEMORY_STORE === '1') {
    cached = new MemoryStore();
    return cached;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error('Thiếu UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN (hoặc KV_REST_API_URL/KV_REST_API_TOKEN)');
  }
  const { Redis } = await import('@upstash/redis');
  cached = new Redis({ url, token });
  return cached;
}

// Giống @upstash/redis: string giữ nguyên, còn lại JSON.stringify; khi đọc thì thử JSON.parse.
function serialize(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function deserialize(raw) {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function wrongType() {
  return new Error('WRONGTYPE Operation against a key holding the wrong kind of value');
}

function normRange(len, start, stop) {
  let s = start < 0 ? len + start : start;
  let e = stop < 0 ? len + stop : stop;
  s = Math.max(0, s);
  e = Math.min(len - 1, e);
  return [s, e];
}

export class MemoryStore {
  constructor() {
    this.data = new Map(); // key -> { type, value, expireAt }
  }

  _entry(key) {
    const e = this.data.get(key);
    if (!e) return null;
    if (e.expireAt !== null && e.expireAt <= Date.now()) {
      this.data.delete(key);
      return null;
    }
    return e;
  }

  _typed(key, type, create) {
    let e = this._entry(key);
    if (e && e.type !== type) throw wrongType();
    if (!e && create) {
      const empty = { string: '', hash: new Map(), set: new Set(), list: [] }[type];
      e = { type, value: empty, expireAt: null };
      this.data.set(key, e);
    }
    return e;
  }

  async get(key) {
    const e = this._typed(key, 'string', false);
    return e ? deserialize(e.value) : null;
  }

  async set(key, value, opts = {}) {
    const existing = this._entry(key);
    if (opts.nx && existing) return null;
    if (opts.xx && !existing) return null;
    const expireAt = opts.ex ? Date.now() + opts.ex * 1000 : opts.px ? Date.now() + opts.px : null;
    this.data.set(key, { type: 'string', value: serialize(value), expireAt });
    return 'OK';
  }

  async del(...keys) {
    let n = 0;
    for (const k of keys) {
      if (this._entry(k)) n++;
      this.data.delete(k);
    }
    return n;
  }

  async expire(key, seconds) {
    const e = this._entry(key);
    if (!e) return 0;
    e.expireAt = Date.now() + seconds * 1000;
    return 1;
  }

  async hsetnx(key, field, value) {
    const e = this._typed(key, 'hash', true);
    const f = String(field);
    if (e.value.has(f)) return 0;
    e.value.set(f, serialize(value));
    return 1;
  }

  async hset(key, obj) {
    const e = this._typed(key, 'hash', true);
    let added = 0;
    for (const [f, v] of Object.entries(obj)) {
      if (!e.value.has(f)) added++;
      e.value.set(f, serialize(v));
    }
    return added;
  }

  async hgetall(key) {
    const e = this._typed(key, 'hash', false);
    if (!e || e.value.size === 0) return null;
    const out = {};
    for (const [f, v] of e.value) out[f] = deserialize(v);
    return out;
  }

  async hincrby(key, field, increment) {
    const e = this._typed(key, 'hash', true);
    const f = String(field);
    const cur = e.value.has(f) ? Number(e.value.get(f)) : 0;
    if (!Number.isInteger(cur)) throw new Error('ERR hash value is not an integer');
    const next = cur + Number(increment);
    e.value.set(f, String(next));
    return next;
  }

  async sadd(key, ...members) {
    const e = this._typed(key, 'set', true);
    let added = 0;
    for (const m of members) {
      const s = serialize(m);
      if (!e.value.has(s)) {
        e.value.add(s);
        added++;
      }
    }
    return added;
  }

  async srem(key, ...members) {
    const e = this._typed(key, 'set', false);
    if (!e) return 0;
    let removed = 0;
    for (const m of members) if (e.value.delete(serialize(m))) removed++;
    if (e.value.size === 0) this.data.delete(key);
    return removed;
  }

  async smembers(key) {
    const e = this._typed(key, 'set', false);
    return e ? [...e.value].map(deserialize) : [];
  }

  async lpush(key, ...elements) {
    const e = this._typed(key, 'list', true);
    for (const el of elements) e.value.unshift(serialize(el));
    return e.value.length;
  }

  async ltrim(key, start, stop) {
    const e = this._typed(key, 'list', false);
    if (!e) return 'OK';
    const [s, t] = normRange(e.value.length, start, stop);
    e.value = s > t ? [] : e.value.slice(s, t + 1);
    if (e.value.length === 0) this.data.delete(key);
    return 'OK';
  }

  async lrange(key, start, stop) {
    const e = this._typed(key, 'list', false);
    if (!e) return [];
    const [s, t] = normRange(e.value.length, start, stop);
    return s > t ? [] : e.value.slice(s, t + 1).map(deserialize);
  }
}
