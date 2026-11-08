// src/index.js
// proxylane — Cloudflare Worker 入口：路由 / 过滤 / 格式化 / 定时刷新
import { DEFAULT_SOURCES, parseSourcesVar, collectPool, packRecords, unpackRecords, sortRecords, countBy, countryList, PROTO_NAMES } from './core.js';
import { render, FORMATS, FORMAT_PROTOCOLS } from './format.js';

const KEY_POOL = 'pool:v2';
const KEY_META = 'meta:v2';
const BUILD = '1.3.0';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-max-age': '86400',
};

const DEF_LIMIT = { json: 200, txt: 5000, csv: 5000, base64: 1000, clash: 1000, surge: 1000, singbox: 1000 };
const MAX_LIMIT = 5000;
const TXT_PROTOS = ['all'].concat(PROTO_NAMES);

function jsonResponse(data, status, extra) {
  const headers = Object.assign({}, CORS, { 'content-type': 'application/json; charset=utf-8' }, extra || {});
  return new Response(JSON.stringify(data, null, 2) + '\n', { status: status || 200, headers: headers });
}

function textResponse(body, status, extra) {
  const headers = Object.assign({}, CORS, { 'content-type': 'text/plain; charset=utf-8' }, extra || {});
  return new Response(body, { status: status || 200, headers: headers });
}

async function runRefresh(env) {
  const sources = parseSourcesVar(env.SOURCES);
  const started = Date.now();
  const result = await collectPool(sources, {
    maxRecords: Number(env.MAX_RECORDS || 12000),
    timeoutMs: Number(env.FETCH_TIMEOUT_MS || 20000),
    concurrency: 5,
  });
  const records = result.records;
  const countries = countryList(records, 200);
  const meta = {
    updatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    total: records.length,
    rawCount: result.rawCount,
    protocols: countBy(records, 'proto'),
    networks: countBy(records, 'net'),
    security: countBy(records, 'tls'),
    verified: records.filter(function (r) { return r.verified; }).length,
    countries: countries.length,
    countryList: countries,
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
    q: String(q.get('q') || q.get('search') || q.get('keyword') || '').trim().toLowerCase(),
    protocols: splitList(q.get('protocol')),
    countries: splitList(q.get('country')),
    networks: splitList(q.get('network') || q.get('net')),
    security: splitList(q.get('security') || q.get('tls')),
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
    let p = list[i];
    if (p === 'all' || p === '*') return null;
    if (p === 'hy2' || p === 'hysteria') p = 'hysteria2';
    if (p === 'socks') p = 'socks5';
    if (p === 'shadowsocks') p = 'ss';
    if (PROTO_NAMES.indexOf(p) >= 0) out.push(p);
  }
  return out.length ? out : null;
}

function haystack(r) {
  return [
    r.name, r.host, r.proto, r.cc, r.net, r.tls, r.src, r.uri,
    r.extra && r.extra.sni, r.extra && r.extra.method, r.extra && r.extra.uuid,
  ].join(' ').toLowerCase();
}

function applyFilters(records, q) {
  const protos = expandProtocols(q.protocols);
  const out = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (protos && protos.indexOf(r.proto) < 0) continue;
    if (q.countries && q.countries.indexOf(String(r.cc).toLowerCase()) < 0) continue;
    if (q.networks && q.networks.indexOf(String(r.net).toLowerCase()) < 0) continue;
    if (q.security && q.security.indexOf(String(r.tls).toLowerCase()) < 0) continue;
    if (q.sources && q.sources.indexOf(r.src) < 0) continue;
    if (q.maxLatency > 0 && r.latency > 0 && r.latency > q.maxLatency) continue;
    if (q.maxLatency > 0 && r.latency === 0) continue;
    if (q.verified !== null && r.verified !== q.verified) continue;
    if (q.q && haystack(r).indexOf(q.q) < 0) continue;
    out.push(r);
  }
  return out;
}

function fitFormat(records, format) {
  const allow = FORMAT_PROTOCOLS[format];
  if (!allow) return { list: records, dropped: 0 };
  const out = [];
  for (let i = 0; i < records.length; i++) {
    if (allow.indexOf(records[i].proto) >= 0) out.push(records[i]);
  }
  return { list: out, dropped: records.length - out.length };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

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

    if (path === '/v1/health') {
      return jsonResponse({
        ok: true,
        build: BUILD,
        time: new Date().toISOString(),
        site: env.SITE_DOMAIN || url.host,
      });
    }

    if (path === '/v1/config') {
      return jsonResponse({
        ok: true,
        site: env.SITE_DOMAIN || url.host,
        repo: env.REPO_URL || '',
        build: BUILD,
        formats: FORMATS,
        protocols: PROTO_NAMES,
        params: ['q', 'protocol', 'country', 'network', 'security', 'source', 'max_latency', 'verified', 'sort', 'limit', 'offset', 'format'],
        endpoints: [
          '/v1/proxies',
          '/v1/all.txt',
          '/v1/ss.txt',
          '/v1/ssr.txt',
          '/v1/vmess.txt',
          '/v1/vless.txt',
          '/v1/trojan.txt',
          '/v1/hysteria2.txt',
          '/v1/tuic.txt',
          '/v1/anytls.txt',
          '/v1/socks5.txt',
          '/v1/random',
          '/v1/stats',
          '/v1/countries',
          '/v1/sources',
          '/v1/health',
        ],
      }, 200, { 'cache-control': 'public, max-age=3600' });
    }

    if (path === '/v1/refresh') {
      const token = url.searchParams.get('token') || request.headers.get('x-admin-token');
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
        return jsonResponse({ ok: false, error: 'forbidden' }, 403);
      }
      const meta = await runRefresh(env);
      return jsonResponse({ ok: true, meta: meta });
    }

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

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    // ---- /v1/stats：只读 meta 汇总，不解析整个节点池 ----
    // 免费版 Worker 每次调用只有 10ms CPU，解析全池（数千条 + 完整分享链接）
    // 会偶发超限导致请求挂起，所以统计走 meta，并缓存 60 秒。
    if (path === '/v1/stats') {
      const meta = await loadMeta(env);
      if (!meta) {
        return jsonResponse({
          ok: false,
          error: 'pool_empty',
          hint: 'KV 为空。请在 GitHub 仓库 Actions 页手动运行 sync-kv 工作流，或等待下一次定时同步。',
        }, 503, Object.assign({}, CORS, { 'retry-after': '120' }));
      }
      const statsRes = jsonResponse({
        ok: true,
        updated_at: meta.updatedAt || null,
        duration_ms: meta.durationMs || null,
        total: meta.total || 0,
        verified: meta.verified || 0,
        protocols: meta.protocols || {},
        networks: meta.networks || {},
        security: meta.security || {},
        top_countries: meta.countryList ? meta.countryList.length : (meta.countries || 0),
        country_list: meta.countryList || [],
        sources: meta.sources || [],
        build: BUILD,
      }, 200, { 'cache-control': 'public, max-age=60' });
      ctx.waitUntil(cache.put(cacheKey, statsRes.clone()));
      return statsRes;
    }

    // ---- /v1/countries：前端国家下拉框用，优先读 meta ----
    if (path === '/v1/countries') {
      const meta = await loadMeta(env);
      let list = (meta && meta.countryList) || [];
      if (!list.length) {
        // 旧版 meta 没有 countryList，先从节点池现算（结果会缓存 5 分钟，
        // 下次同步写入 countryList 后就走快路径了）
        const pool = await loadPool(env);
        if (pool) list = countryList(pool, 200);
      }
      const countriesRes = jsonResponse({
        ok: true,
        total: list.length,
        data: list,
      }, 200, { 'cache-control': 'public, max-age=300' });
      ctx.waitUntil(cache.put(cacheKey, countriesRes.clone()));
      return countriesRes;
    }

    const records = await loadPool(env);
    if (!records) {
      if (env.NO_SELF_REFRESH === '1') {
        return jsonResponse({
          ok: false,
          error: 'pool_empty',
          hint: 'KV 为空。请在 GitHub 仓库 Actions 页手动运行 sync-kv 工作流（约 2 分钟），或等待下一次定时同步。',
        }, 503, Object.assign({}, CORS, { 'retry-after': '120' }));
      }
      ctx.waitUntil(runRefresh(env));
      return jsonResponse({
        ok: false,
        error: 'pool_empty',
        hint: '数据首次初始化中，约 60 秒后重试',
      }, 503, Object.assign({}, CORS, { 'retry-after': '60' }));
    }

    let forcedProtocol = null;
    let forcedFormat = null;
    const m = /^\/v1\/(all|ss|ssr|vmess|vless|trojan|hysteria2|hy2|tuic|anytls|socks5)\.txt$/.exec(path);
    if (m) {
      forcedFormat = 'txt';
      if (m[1] === 'all') forcedProtocol = null;
      else if (m[1] === 'hy2') forcedProtocol = 'hysteria2';
      else forcedProtocol = m[1];
    }

    if (path !== '/v1/proxies' && path !== '/v1/random' && !m) {
      return jsonResponse({ ok: false, error: 'not_found', hint: 'see /v1/config' }, 404);
    }

    const q = parseQuery(url);
    const qFormat = url.searchParams.get('format');
    let format;
    if (qFormat && FORMATS.indexOf(q.format) >= 0) format = q.format;
    else format = forcedFormat || 'json';

    if (path === '/v1/random') {
      if (forcedProtocol) q.protocols = [forcedProtocol];
      const list = applyFilters(records, q);
      if (!list.length) return jsonResponse({ ok: false, error: 'no_match' }, 404);
      const pick = list[Math.floor(Math.random() * list.length)];
      const wantJson = url.searchParams.get('format') === 'json';
      const body = wantJson
        ? JSON.stringify({
          ok: true,
          name: pick.name,
          protocol: pick.proto,
          server: pick.host,
          port: pick.port,
          country: pick.cc || null,
          uri: pick.uri,
        }, null, 2) + '\n'
        : (pick.uri || (pick.host + ':' + pick.port)) + '\n';
      return new Response(body, {
        status: 200,
        headers: Object.assign({}, CORS, {
          'content-type': wantJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
        }),
      });
    }

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
    if (slice.length) ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },

  async scheduled(event, env, ctx) {
    if (env.NO_SELF_REFRESH === '1') return;
    ctx.waitUntil(runRefresh(env));
  },
};

export { TXT_PROTOS };
