// src/core.js
// 平台无关核心逻辑：源定义 / 解析 / 去重合并 / 评分 / KV 序列化。
// 同时被 src/index.js (Workers) 与 scripts/sync.mjs (GitHub Actions) 复用。

export const PROTO_NAMES = ['http', 'https', 'socks4', 'socks5'];
const PROTO_INDEX = { http: 0, https: 1, socks4: 2, socks5: 3 };

export const ANON_NAMES = ['unknown', 'transparent', 'anonymous', 'elite'];
const ANON_INDEX = { unknown: 0, transparent: 1, anonymous: 2, elite: 3 };

export const USER_AGENT = 'proxylane/1.0 (proxy-list aggregator)';

// ---------------------------------------------------------------
// 默认源清单（都在 2026-11 实测可用；行数为实测值）
// tier 1 = 上游已自行验证；tier 2 = 高频更新未验证；tier 3 = 量大未验证
// ---------------------------------------------------------------
export const DEFAULT_SOURCES = [
  {
    id: 'monosans',
    name: 'monosans/proxy-list',
    tier: 1,
    verified: true,
    parser: 'monosans',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies.json',
    home: 'https://github.com/monosans/proxy-list',
  },
  {
    id: 'proxifly',
    name: 'proxifly/free-proxy-list',
    tier: 2,
    verified: false,
    parser: 'txt',
    protocol: 'mix',
    url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/all/data.txt',
    home: 'https://github.com/proxifly/free-proxy-list',
  },
  {
    id: 'thespeedx-http',
    name: 'TheSpeedX/PROXY-List (http)',
    tier: 3,
    verified: false,
    parser: 'txt',
    protocol: 'http',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    home: 'https://github.com/TheSpeedX/PROXY-List',
  },
  {
    id: 'thespeedx-socks5',
    name: 'TheSpeedX/PROXY-List (socks5)',
    tier: 3,
    verified: false,
    parser: 'txt',
    protocol: 'socks5',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
    home: 'https://github.com/TheSpeedX/PROXY-List',
  },
  {
    id: 'roosterkid',
    name: 'roosterkid/openproxylist (https)',
    tier: 3,
    verified: false,
    parser: 'txt',
    protocol: 'https',
    url: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt',
    home: 'https://github.com/roosterkid/openproxylist',
  },
];

// 解析 wrangler.toml 里 SOURCES 变量（JSON 数组字符串）
export function parseSourcesVar(raw) {
  if (!raw) return DEFAULT_SOURCES;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return DEFAULT_SOURCES;
    return arr;
  } catch (e) {
    return DEFAULT_SOURCES;
  }
}

// ---------------------------------------------------------------
// 校验：只接受公网 IPv4 + 合法端口
// ---------------------------------------------------------------
const PRIVATE = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,
  /^198\.1[89]\./,
  /^(22[4-9]|2[3-9][0-9])\./,
];

export function isPublicIPv4(host) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split('.');
  for (let i = 0; i < 4; i++) {
    const n = Number(parts[i]);
    if (n > 255) return false;
  }
  for (let i = 0; i < PRIVATE.length; i++) {
    if (PRIVATE[i].test(host)) return false;
  }
  return true;
}

export function isValidPort(port) {
  const p = Number(port);
  return Number.isInteger(p) && p > 0 && p < 65536;
}

function normalizeProto(raw, fallback) {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'http' || v === 'https' || v === 'socks4' || v === 'socks5') return v;
  if (v === 'socks') return 'socks5';
  if (fallback === 'mix' || !fallback) return 'http';
  return fallback;
}

function normalizeAnon(raw) {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'transparent' || v === 'anonymous' || v === 'elite') return v;
  return 'unknown';
}

function sanitizeCC(raw) {
  const v = String(raw || '').toUpperCase().trim();
  return /^[A-Z]{2}$/.test(v) ? v : '';
}

function makeRecord(host, port, proto, src, extra) {
  const h = String(host || '').trim();
  const p = Number(port);
  if (!isPublicIPv4(h) || !isValidPort(p)) return null;
  const e = extra || {};
  return {
    host: h,
    port: p,
    proto: normalizeProto(proto, src.protocol),
    cc: sanitizeCC(e.cc),
    anon: normalizeAnon(e.anon),
    latency: Number(e.latency) > 0 ? Math.round(Number(e.latency)) : 0,
    src: src.id,
    verified: Boolean(e.verified !== undefined ? e.verified : src.verified),
  };
}

// ---------------------------------------------------------------
// 解析器
// ---------------------------------------------------------------
const LINE_RE = /^(?:(https?|socks4|socks5):\/\/)?(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})\s*$/i;

export function parseTxt(text, src) {
  const out = [];
  const lines = String(text || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.charAt(0) === '#') continue;
    const m = LINE_RE.exec(line);
    if (!m) continue;
    const rec = makeRecord(m[2], m[3], m[1] || src.protocol, src, {});
    if (rec) out.push(rec);
  }
  return out;
}

// monosans/proxies.json：{"0":{protocol,host,port,timeout,exit_ip,asn,geolocation}}
// timeout 单位为秒（如 0.22 = 220ms）
export function parseMonosansJson(text, src) {
  const out = [];
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return out;
  }
  const keys = Object.keys(data || {});
  for (let i = 0; i < keys.length; i++) {
    const it = data[keys[i]];
    if (!it || !it.host || !it.port) continue;
    const geo = it.geolocation || {};
    const country = (geo.country && geo.country.iso_code) || '';
    const rec = makeRecord(it.host, it.port, it.protocol, src, {
      cc: country,
      latency: Number(it.timeout) > 0 ? Number(it.timeout) * 1000 : 0,
      verified: true,
    });
    if (rec) out.push(rec);
  }
  return out;
}

// proxifly/free-proxy-list：all/data.json（数组，含 anonymity / geolocation）
export function parseProxiflyJson(text, src) {
  const out = [];
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return out;
  }
  if (!Array.isArray(data)) return out;
  for (let i = 0; i < data.length; i++) {
    const it = data[i];
    if (!it) continue;
    const geo = it.geolocation || {};
    const rec = makeRecord(it.ip || it.host, it.port, it.protocol, src, {
      cc: geo.country || geo.country_code || '',
      anon: it.anonymity,
      verified: false,
    });
    if (rec) out.push(rec);
  }
  return out;
}

export function parseSource(src, text) {
  if (src.parser === 'monosans') return parseMonosansJson(text, src);
  if (src.parser === 'proxifly-json') return parseProxiflyJson(text, src);
  return parseTxt(text, src);
}

// ---------------------------------------------------------------
// 评分与合并
// ---------------------------------------------------------------
export function quality(r) {
  let score = 0;
  if (r.verified) score += 1000;
  if (r.src === 'monosans') score += 300;
  else if (r.src === 'proxifly') score += 200;
  else score += 100;
  score += (ANON_INDEX[r.anon] || 0) * 40;
  if (r.cc) score += 30;
  if (r.latency > 0) score += Math.max(0, 400 - Math.min(r.latency, 4000) / 10);
  return score;
}

export function mergeRecords(list) {
  const map = new Map();
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const key = r.host + ':' + r.port;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, r);
      continue;
    }
    const keepNew = quality(r) > quality(prev);
    const keep = keepNew ? r : prev;
    const other = keepNew ? prev : r;
    keep.verified = Boolean(keep.verified || other.verified);
    if (!keep.cc && other.cc) keep.cc = other.cc;
    if ((ANON_INDEX[other.anon] || 0) > (ANON_INDEX[keep.anon] || 0)) keep.anon = other.anon;
    if (keep.latency <= 0 || (other.latency > 0 && other.latency < keep.latency)) keep.latency = other.latency;
    map.set(key, keep);
  }
  return Array.from(map.values());
}

export function sortRecords(list, mode) {
  const arr = list.slice();
  if (mode === 'random') {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
  if (mode === 'latency') {
    arr.sort(function (a, b) {
      const la = a.latency > 0 ? a.latency : 1e9;
      const lb = b.latency > 0 ? b.latency : 1e9;
      return la - lb;
    });
    return arr;
  }
  if (mode === 'country') {
    arr.sort(function (a, b) {
      const ca = a.cc || 'ZZ';
      const cb = b.cc || 'ZZ';
      return ca < cb ? -1 : ca > cb ? 1 : quality(b) - quality(a);
    });
    return arr;
  }
  arr.sort(function (a, b) {
    return quality(b) - quality(a);
  });
  return arr;
}

// ---------------------------------------------------------------
// KV 序列化：紧凑数组存储，减小读取体积
// [host, port, protoIdx, cc, anonIdx, latencyMs, srcId, verified?1:0]
// ---------------------------------------------------------------
export function packRecords(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    out.push([
      r.host,
      r.port,
      PROTO_INDEX[r.proto] || 0,
      r.cc || '',
      ANON_INDEX[r.anon] || 0,
      r.latency || 0,
      r.src || '',
      r.verified ? 1 : 0,
    ]);
  }
  return out;
}

export function unpackRecords(packed) {
  const out = [];
  if (!Array.isArray(packed)) return out;
  for (let i = 0; i < packed.length; i++) {
    const a = packed[i];
    if (!Array.isArray(a) || a.length < 8) continue;
    out.push({
      host: a[0],
      port: a[1],
      proto: PROTO_NAMES[a[2]] || 'http',
      cc: a[3] || '',
      anon: ANON_NAMES[a[4]] || 'unknown',
      latency: a[5] || 0,
      src: a[6] || '',
      verified: a[7] === 1,
    });
  }
  return out;
}

// ---------------------------------------------------------------
// 并发抓取 + 合并
// ---------------------------------------------------------------
export async function collectPool(sources, opts) {
  const o = opts || {};
  const concurrency = o.concurrency || 5;
  const timeoutMs = o.timeoutMs || 15000;
  const maxRecords = o.maxRecords || 15000;
  const fetchImpl = o.fetchImpl || fetch;

  const metas = [];
  const all = [];
  let cursor = 0;

  async function worker() {
    while (cursor < sources.length) {
      const src = sources[cursor];
      cursor++;
      const started = Date.now();
      let timer = null;
      try {
        const ctl = new AbortController();
        timer = setTimeout(function () {
          ctl.abort();
        }, timeoutMs);
        const res = await fetchImpl(src.url, {
          signal: ctl.signal,
          headers: { 'user-agent': USER_AGENT, accept: '*/*' },
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        const recs = parseSource(src, text);
        for (let i = 0; i < recs.length; i++) all.push(recs[i]);
        metas.push({
          id: src.id,
          name: src.name,
          tier: src.tier,
          ok: true,
          count: recs.length,
          bytes: text.length,
          ms: Date.now() - started,
        });
      } catch (e) {
        metas.push({
          id: src.id,
          name: src.name,
          tier: src.tier,
          ok: false,
          count: 0,
          error: String((e && e.message) || e).slice(0, 160),
          ms: Date.now() - started,
        });
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  }

  const runners = [];
  const n = Math.min(concurrency, sources.length);
  for (let i = 0; i < n; i++) runners.push(worker());
  await Promise.all(runners);

  const rawCount = all.length;
  const merged = sortRecords(mergeRecords(all), 'quality').slice(0, maxRecords);
  metas.sort(function (a, b) {
    return (a.tier || 9) - (b.tier || 9);
  });
  return { records: merged, metas: metas, rawCount: rawCount };
}

export function countBy(list, field) {
  const out = {};
  for (let i = 0; i < list.length; i++) {
    const k = list[i][field] || 'unknown';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
