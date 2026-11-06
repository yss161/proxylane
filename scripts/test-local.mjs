// scripts/test-local.mjs
// 本地裸跑 Worker：用 curl 代替 fetch（因为本机直连 raw.githubusercontent 会超时），
// KV / caches / ASSETS 全部打桩。用 node scripts/test-local.mjs 运行。
import { execFile } from 'node:child_process';

const MIRROR = 'https://gh-proxy.com/';
const UA = 'Mozilla/5.0';

function curlText(url) {
  const target = url.indexOf('raw.githubusercontent.com') >= 0 && process.env.NO_MIRROR !== '1' ? MIRROR + url : url;
  return new Promise(function (resolve) {
    execFile('curl', ['-sS', '-L', '--max-time', '40', '-A', UA, target], { timeout: 60000, maxBuffer: 64 << 20 }, function (e, so) {
      resolve(String(so || ''));
    });
  });
}

// ---- 打桩 ----
const kv = new Map();
globalThis.caches = {
  default: {
    async match(req) { return kv.get('__cache__' + new URL(req.url).pathname + new URL(req.url).search) || undefined; },
    async put(req, res) { kv.set('__cache__' + new URL(req.url).pathname + new URL(req.url).search, res); },
  },
};
globalThis.fetch = async function (url, init) {
  const text = await curlText(String(url));
  const status = text.indexOf('404: Not Found') === 0 ? 404 : 200;
  return {
    ok: status === 200,
    status: status,
    async text() { return text; },
    headers: { get() { return null; } },
  };
};

const env = {
  SITE_DOMAIN: 'proxy.hanser.cv',
  REPO_URL: 'https://github.com/example/proxylane',
  MAX_RECORDS: '12000',
  FETCH_TIMEOUT_MS: '20000',
  SOURCES: '',
  PROXY_KV: {
    async get(k) { return kv.has(k) ? kv.get(k) : null; },
    async put(k, v) { kv.set(k, v); },
  },
  ASSETS: { async fetch() { return new Response('asset', { status: 200 }); } },
};

const worker = (await import('../src/index.js')).default;

function ctx() {
  const pending = [];
  return {
    waitUntil(p) { pending.push(p); },
    async drain() { await Promise.all(pending); pending.length = 0; },
  };
}

async function call(path) {
  const c = ctx();
  const req = new Request('https://proxy.hanser.cv' + path);
  const res = await worker.fetch(req, env, c);
  await c.drain();
  return res;
}

function assert(cond, msg) {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) process.exitCode = 1;
}

// ---- 1. health ----
let r = await call('/v1/health');
let j = await r.json();
assert(r.status === 200 && j.ok && j.site === 'proxy.hanser.cv', 'GET /v1/health');

// ---- 2. 冷启动应返回 503 并触发后台刷新 ----
r = await call('/v1/proxies?limit=5');
assert(r.status === 503, 'cold start -> 503 (pool_empty)');
assert(kv.has('pool:v1'), 'background refresh wrote pool:v1 to KV');

const packed = JSON.parse(kv.get('pool:v1'));
console.log('   pool size:', packed.length, 'records; kv bytes:', kv.get('pool:v1').length);
assert(packed.length > 1000, 'pool has >1000 records');

// ---- 3. 主接口 ----
r = await call('/v1/proxies?limit=5');
j = await r.json();
assert(r.status === 200 && j.data.length === 5, 'GET /v1/proxies?limit=5');
assert(r.headers.get('x-total-count') > 0, 'x-total-count header = ' + r.headers.get('x-total-count'));
assert(j.data[0].ip && j.data[0].port && j.data[0].protocol, 'json item shape ok');

// ---- 4. 协议端点 ----
r = await call('/v1/all.txt?limit=20');
let txt = await r.text();
let lines = txt.trim().split('\n');
assert(r.status === 200 && lines.length === 20 && /^\d+\.\d+\.\d+\.\d+:\d+$/.test(lines[0]), '/v1/all.txt 20 lines, ip:port');
const total = Number(r.headers.get('x-total-count'));

r = await call('/v1/socks5.txt?limit=200');
txt = await r.text();
j = null;
const socksOnly = await call('/v1/socks5.txt?format=json&limit=50');
const socksJson = await socksOnly.json();
assert(socksJson.data.every(function (x) { return x.protocol === 'socks5'; }), '/v1/socks5.txt only socks5 (' + socksJson.count + ')');

// ---- 5. 筛选 ----
r = await call('/v1/proxies?format=json&verified=true&limit=10');
j = await r.json();
assert(j.data.every(function (x) { return x.verified === true; }), 'verified=true filter');

r = await call('/v1/proxies?format=json&country=us&limit=10');
j = await r.json();
assert(j.data.length === 0 || j.data.every(function (x) { return x.country === 'US'; }), 'country=us filter');

r = await call('/v1/proxies?format=json&sort=latency&limit=5');
j = await r.json();
const lat = j.data.map(function (x) { return x.latency_ms; }).filter(function (x) { return x; });
assert(lat.length === 0 || lat.join(',') === lat.slice().sort(function (a, b) { return a - b; }).join(','), 'sort=latency ascending');

// ---- 6. 订阅格式 ----
r = await call('/v1/proxies?format=clash&limit=5');
const yaml = await r.text();
assert(yaml.indexOf('proxies:') >= 0 && yaml.indexOf('proxy-groups:') >= 0 && yaml.indexOf('type: http') >= 0, 'clash yaml');
assert(r.headers.get('content-disposition') && r.headers.get('content-disposition').indexOf('proxylane.yaml') >= 0, 'clash filename header');
console.log('   --- clash sample ---');
console.log(yaml.split('\n').slice(0, 12).join('\n'));

r = await call('/v1/proxies?format=base64&limit=5');
const b64 = await r.text();
const decoded = Buffer.from(b64, 'base64').toString('binary');
assert(decoded.split('\n').length === 5 && decoded.indexOf('://') > 0, 'base64 subscription decodes to 5 URIs');
console.log('   --- base64 decoded ---');
console.log(decoded);

r = await call('/v1/proxies?format=surge&limit=3');
const surge = await r.text();
assert(surge.indexOf('[Proxy]') >= 0 && surge.indexOf('= http,') >= 0, 'surge snippet');

r = await call('/v1/proxies?format=singbox&limit=3');
const sb = JSON.parse(await r.text());
assert(Array.isArray(sb.outbounds) && sb.outbounds.length === 3 && sb.outbounds[0].server_port > 0, 'sing-box json');

r = await call('/v1/proxies?format=csv&limit=3');
const csv = await r.text();
assert(csv.split('\n')[0] === 'ip,port,protocol,country,anonymity,latency_ms,source,verified', 'csv header');

// ---- 7. 元信息 ----
r = await call('/v1/stats');
j = await r.json();
assert(j.ok && j.total > 0 && j.sources.length >= 4, '/v1/stats');
console.log('   stats:', JSON.stringify({ total: j.total, verified: j.verified, countries: j.top_countries, protocols: j.protocols }));

r = await call('/v1/sources');
j = await r.json();
assert(j.ok && j.sources.length >= 4 && j.sources[0].last_ok === true, '/v1/sources 首个源抓取成功');

r = await call('/v1/random?protocol=socks5');
txt = await r.text();
assert(/^\d+\.\d+\.\d+\.\d+:\d+\n$/.test(txt), '/v1/random -> single proxy');

r = await call('/v1/config');
j = await r.json();
assert(j.ok && j.formats.length === 7, '/v1/config');

r = await call('/v1/nope');
assert(r.status === 404, '/v1/nope -> 404');

r = await call('/');
assert(r.status === 200, 'non-/v1 path delegates to ASSETS');


// ---- 8. 方案 B：NO_SELF_REFRESH=1 时不应触发后台抓取 ----
{
  const kv2 = new Map();
  const envB = Object.assign({}, env, {
    NO_SELF_REFRESH: '1',
    PROXY_KV: {
      async get(k) { return kv2.has(k) ? kv2.get(k) : null; },
      async put(k, v) { kv2.set(k, v); },
    },
  });
  const c = ctx();
  const res = await worker.fetch(new Request('https://proxy.hanser.cv/v1/proxies'), envB, c);
  await c.drain();
  const body = await res.json();
  assert(res.status === 503 && body.error === 'pool_empty', 'plan B: cold start -> 503');
  assert(kv2.size === 0, 'plan B: Worker 未自行抓取（KV 仍为空）');
  assert(String(body.hint).indexOf('Actions') >= 0, 'plan B: 提示去跑 GitHub Actions');

  const sr = await worker.scheduled({}, envB, c);
  await c.drain();
  assert(kv2.size === 0, 'plan B: scheduled() 直接 return，不抓取');
}

console.log('\nDONE. exitCode =', process.exitCode || 0);
