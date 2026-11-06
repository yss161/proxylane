// src/index.js
// proxylane — Cloudflare Worker 入口：路由 / 过滤 / 格式化 / 定时刷新
import { DEFAULT_SOURCES, parseSourcesVar, collectPool, packRecords, unpackRecords, sortRecords, countBy, PROTO_NAMES } from './core.js';
import { render, FORMATS, FORMAT_PROTOCOLS } from './format.js';

const KEY_POOL = 'pool:v1';
const KEY_META = 'meta:v1';
const BUILD = '1.0.0';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-max-age': '86400',
};

const DEF_LIMIT = { json: 200, txt: 5000, csv: 5000, base64: 1000, clash: 1000, surge: 1000, singbox: 1000 };
const MAX_LIMIT = 5000;

function jsonResponse(data, status, extra) {
  const headers = Object.assign({}, CORS, { 'content-type': 'application/json; charset=utf-8' }, extra || {});
  return new Response(JSON.stringify(data, null, 2) + '\n', { status: status || 200, headers: headers });
}

function textResponse(body, status, extra) {
  const headers = Object.assign({}, CORS, { 'content-type': 'text/plain; charset=utf-8' }, extra || {});
  return new Response(body, { status: status || 200, headers: headers });
}

// ---------------------------------------------------------------
// 刷新：抓取 -> 解析 -> 合并 -> 写 KV
// ---------------------------------------------------------------
async function runRefresh(env) {
  const sources = parseSourcesVar(env.SOURCES);
  const started = Date.now();
  const result = await collectPool(sources, {
    maxRecords: Number(env.MAX_RECORDS || 12000),
    timeoutMs: Number(env.FETCH_TIMEOUT_MS || 15000),
    concurrency: 5,
  });
  const records = result.records;
  const meta = {
    updatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    total: records.length,
    rawCount: result.rawCount,
    protocols: countBy(records, 'proto'),
    anonymity: countBy(records, 'anon'),
    verified: records.filter(function (r) { return r.verified; }).length,
    countries: Object.keys(countBy(records, 'cc')).length,
    sources: result.metas,
    build: BUILD,
  };
  await env.PROXY_KV.put(KEY_POOL, JSON.stringify(packRecords(records)));
  await env.PROXY_KV.put(KEY_META, JSON.stringify(meta));
  return meta;
}

async function loadPool(env) {
  const raw = await env.PROXY_KV.get(KEY_POOL);
  if (!raw) return null;
  try {
    return unpackRecords(JSON.parse(raw));
  } catch (e) {
    return null;
  }
}

async function loadMeta(env) {
  const raw = await env.PROXY_KV.get(KEY_META);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------
// 查询参数
// ---------------------------------------------------------------
function splitList(v) {
  if (!v) return null;
  const arr = String(v).split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  return arr.length ? arr : null;
}

function numOr(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function parseQuery(url) {
  const q = url.searchParams;
  const verifiedRaw = q.get('verified');
  return {
    protocols: splitList(q.get('protocol')),
    countries: splitList(q.get('country')),
    anonymity: splitList(q.get('anonymity')),
    sources: splitList(q.get('source')),
    maxLatency: q.get('max_latency') ? numOr(q.get('max_latency'), 0) : 0,
    verified: verifiedRaw === null ? null : !(verifiedRaw === 'false' || verifiedRaw === '0'),
    sort: (q.get('sort') || 'quality').toLowerCase(),
    offset: Math.max(0, numOr(q.get('offset'), 0)),
    limit: q.get('limit') ? numOr(q.get('limit'), 0) : 0,
    format: (q.get('format') || 'json').toLowerCase(),
  };
}

function expandProtocols(list) {
  if (!list) return null;
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p === 'all' || p === '*') return null;
    if (p === 'socks') { out.push('socks4', 'socks5'); continue; }
    if (PROTO_NAMES.indexOf(p) >= 0) out.push(p);
  }
  return out.length ? out : null;
}

function applyFilters(records, q) {
  const protos = expandProtocols(q.protocols);
  const out = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (protos && protos.indexOf(r.proto) < 0) continue;
    if (q.countries && q.countries.indexOf(String(r.cc).toLowerCase()) < 0) continue;
    if (q.anonymity && q.anonymity.indexOf(r.anon) < 0) continue;
    if (q.sources && q.sources.indexOf(r.src) < 0) continue;
    if (q.maxLatency > 0 && r.latency > 0 && r.latency > q.maxLatency) continue;
    if (q.maxLatency > 0 && r.latency === 0) continue;
    if (q.verified !== null && r.verified !== q.verified) continue;
    out.push(r);
  }
  return out;
}

// 剔掉目标格式不支持的协议
function fitFormat(records, format) {
  const allow = FORMAT_PROTOCOLS[format];
  if (!allow) return { list: records, dropped: 0 };
  const out = [];
  for (let i = 0; i < records.length; i++) {
    if (allow.indexOf(records[i].proto) >= 0) out.push(records[i]);
  }
  return { list: out, dropped: records.length - out.length };
}

// ---------------------------------------------------------------
// 路由
// ---------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 静态资源（首页 / 文档 / 状态页）
    if (path.indexOf('/v1/') !== 0) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return textResponse('Not Found', 404);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
    }

    // ---- /v1/health ----
    if (path === '/v1/health') {
      return jsonResponse({
        ok: true,
        build: BUILD,
        time: new Date().toISOString(),
        site: env.SITE_DOMAIN || url.host,
      });
    }

    // ---- /v1/config ----
    if (path === '/v1/config') {
      return jsonResponse({
        ok: true,
        site: env.SITE_DOMAIN || url.host,
        repo: env.REPO_URL || '',
        build: BUILD,
        formats: FORMATS,
        protocols: PROTO_NAMES,
        params: ['protocol', 'country', 'anonymity', 'source', 'max_latency', 'verified', 'sort', 'limit', 'offset', 'format'],
        endpoints: [
          '/v1/proxies',
          '/v1/all.txt',
          '/v1/http.txt',
          '/v1/https.txt',
          '/v1/socks4.txt',
          '/v1/socks5.txt',
          '/v1/random',
          '/v1/stats',
          '/v1/sources',
          '/v1/health',
        ],
      }, 200, { 'cache-control': 'public, max-age=3600' });
    }

    // ---- /v1/refresh（需要 ADMIN_TOKEN）----
    if (path === '/v1/refresh') {
      const token = url.searchParams.get('token') || request.headers.get('x-admin-token');
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
        return jsonResponse({ ok: false, error: 'forbidden' }, 403);
      }
      const meta = await runRefresh(env);
      return jsonResponse({ ok: true, meta: meta });
    }

    // ---- /v1/sources ----
    if (path === '/v1/sources') {
      const meta = await loadMeta(env);
      const last = (meta && meta.sources) || [];
      const out = DEFAULT_SOURCES.map(function (s) {
        const hit = last.filter(function (x) { return x.id === s.id; })[0];
        return {
          id: s.id,
          name: s.name,
          tier: s.tier,
          verified_by_upstream: s.verified,
          home: s.home,
          last_ok: hit ? Boolean(hit.ok) : null,
          last_count: hit ? hit.count : null,
          last_error: hit ? hit.error || null : null,
        };
      });
      return jsonResponse({ ok: true, updated_at: meta ? meta.updatedAt : null, sources: out }, 200, { 'cache-control': 'public, max-age=300' });
    }

    // ---- 带缓存的读路径 ----
    const cacheable = path !== '/v1/stats';
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    if (cacheable) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }

    const records = await loadPool(env);
    if (!records) {
      // 方案 B：Worker 不自己抓，只提示去跑 GitHub Actions
      if (env.NO_SELF_REFRESH === '1') {
        return jsonResponse({
          ok: false,
          error: 'pool_empty',
          hint: 'KV 为空。请在 GitHub 仓库 Actions 页手动运行 sync-kv 工作流（约 2 分钟），或等待下一次定时同步。',
        }, 503, Object.assign({}, CORS, { 'retry-after': '120' }));
      }
      // 方案 A（Paid）：后台预热，同时返回 503，客户端稍后重试
      ctx.waitUntil(runRefresh(env));
      return jsonResponse({
        ok: false,
        error: 'pool_empty',
        hint: '数据首次初始化中，约 60 秒后重试',
      }, 503, Object.assign({}, CORS, { 'retry-after': '60' }));
    }

    // ---- /v1/stats ----
    if (path === '/v1/stats') {
      const meta = (await loadMeta(env)) || {};
      return jsonResponse({
        ok: true,
        updated_at: meta.updatedAt || null,
        duration_ms: meta.durationMs || null,
        total: records.length,
        verified: records.filter(function (r) { return r.verified; }).length,
        protocols: countBy(records, 'proto'),
        anonymity: countBy(records, 'anon'),
        top_countries: Object.keys(countBy(records, 'cc')).length,
        sources: meta.sources || [],
        build: BUILD,
      }, 200, { 'cache-control': 'public, max-age=60' });
    }

    // ---- /v1/{proto}.txt ----
    let forcedProtocol = null;
    let forcedFormat = null;
    const m = /^\/v1\/(all|http|https|socks4|socks5)\.txt$/.exec(path);
    if (m) {
      forcedFormat = 'txt';
      forcedProtocol = m[1] === 'all' ? null : m[1];
    }

    if (path !== '/v1/proxies' && path !== '/v1/random' && !m) {
      return jsonResponse({ ok: false, error: 'not_found', hint: 'see /v1/config' }, 404);
    }

    const q = parseQuery(url);
    // 显式 ?format= 优先；否则 /v1/{proto}.txt 强制 txt，/v1/proxies 默认 json
    const qFormat = url.searchParams.get('format');
    let format;
    if (qFormat && FORMATS.indexOf(q.format) >= 0) format = q.format;
    else format = forcedFormat || 'json';

    // ---- /v1/random ----
    if (path === '/v1/random') {
      if (forcedProtocol) q.protocols = [forcedProtocol];
      const list = applyFilters(records, q);
      if (!list.length) return jsonResponse({ ok: false, error: 'no_match' }, 404);
      const pick = list[Math.floor(Math.random() * list.length)];
      // random 默认返回纯文本，?format=json 才给结构化
      const wantJson = url.searchParams.get('format') === 'json';
      const body = wantJson
        ? JSON.stringify({ ok: true, proxy: pick.host + ':' + pick.port, protocol: pick.proto, country: pick.cc || null }, null, 2) + '\n'
        : pick.host + ':' + pick.port + '\n';
      return new Response(body, {
        status: 200,
        headers: Object.assign({}, CORS, {
          'content-type': wantJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
        }),
      });
    }

    // ---- /v1/proxies 与 /v1/*.txt ----
    if (forcedProtocol) q.protocols = [forcedProtocol];
    let filtered = applyFilters(records, q);
    const fitted = fitFormat(filtered, format);
    filtered = sortRecords(fitted.list, q.sort);

    const total = filtered.length;
    const defLimit = DEF_LIMIT[format] || 200;
    const limit = Math.min(q.limit > 0 ? q.limit : defLimit, MAX_LIMIT);
    const slice = filtered.slice(q.offset, q.offset + limit);

    const out = render(format, slice, { total: total, offset: q.offset, updatedAt: null });
    const isSub = format === 'base64' || format === 'clash' || format === 'surge' || format === 'singbox';

    const headers = Object.assign({}, CORS, {
      'content-type': out.contentType,
      'cache-control': 'public, max-age=300',
      'x-total-count': String(total),
      'x-returned': String(slice.length),
      'x-total-pool': String(records.length),
      'x-robots-tag': 'noindex',
    });
    if (fitted.dropped > 0) headers['x-dropped-unsupported'] = String(fitted.dropped);
    if (isSub) {
      headers['content-disposition'] = 'attachment; filename="proxylane.' + (format === 'clash' ? 'yaml' : format) + '"';
      headers['profile-update-interval'] = '1';
    }

    const res = new Response(out.body, { status: 200, headers: headers });
    if (cacheable && slice.length) ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },

  async scheduled(event, env, ctx) {
    if (env.NO_SELF_REFRESH === '1') return; // 方案 B：交给 GitHub Actions
    ctx.waitUntil(runRefresh(env));
  },
};
