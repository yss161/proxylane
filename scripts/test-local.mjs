// scripts/test-local.mjs
// 本地裸跑 Worker：用 curl 代替 fetch（本机直连 raw.githubusercontent 可能超时），
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

const kv = new Map();
globalThis.caches = {
  default: {
    async match(req) { return kv.get('__cache__' + new URL(req.url).pathname + new URL(req.url).search) || undefined; },
    async put(req, res) { kv.set('__cache__' + new URL(req.url).pathname + new URL(req.url).search, res); },
  },
};
globalThis.fetch = async function (url) {
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

let r = await call('/v1/health');
let j = await r.json();
assert(r.status === 200 && j.ok && j.site === 'proxy.hanser.cv', 'GET /v1/health');

r = await call('/v1/proxies?limit=5');
assert(r.status === 503, 'cold start -> 503 (pool_empty)');
assert(kv.has('pool:v2'), 'background refresh wrote pool:v2 to KV');

const packed = JSON.parse(kv.get('pool:v2'));
console.log('   pool size:', packed.length, 'records; kv bytes:', kv.get('pool:v2').length);
assert(packed.length > 50, 'pool has >50 records');

r = await call('/v1/proxies?limit=5');
j = await r.json();
assert(r.status === 200 && j.data.length === 5, 'GET /v1/proxies?limit=5');
assert(r.headers.get('x-total-count') > 0, 'x-total-count header = ' + r.headers.get('x-total-count'));
assert(j.data[0].server && j.data[0].port && j.data[0].protocol && j.data[0].uri, 'json item shape ok');

r = await call('/v1/all.txt?limit=20');
let txt = await r.text();
let lines = txt.trim().split('\n');
assert(r.status === 200 && lines.length === 20 && /:\/\//.test(lines[0]), '/v1/all.txt 20 share URIs');

r = await call('/v1/vless.txt?format=json&limit=20');
j = await r.json();
if (j.data && j.data.length) {
  assert(j.data.every(function (x) { return x.protocol === 'vless'; }), '/v1/vless.txt only vless (' + j.count + ')');
} else {
  console.log('SKIP /v1/vless.txt empty after ingest');
}

r = await call('/v1/proxies?format=json&q=vless&limit=10');
j = await r.json();
assert(j.data.every(function (x) {
  const hay = ((x.name || '') + ' ' + (x.protocol || '') + ' ' + (x.uri || '')).toLowerCase();
  return hay.indexOf('vless') >= 0;
}), 'q=vless search');

// 随机分发：数量可自定义
r = await call('/v1/proxies?format=json&shuffle=1&limit=7');
j = await r.json();
assert(j.data.length === 7, 'shuffle=1 返回自定义数量 (7)');
assert(r.headers.get('x-shuffle') === '1', 'shuffle 响应头');
const firstSet = j.data.map(function (x) { return x.uri; }).join('|');

const realNow = Date.now;
Date.now = function () { return realNow() + 61000; };
r = await call('/v1/proxies?format=json&shuffle=1&limit=7');
j = await r.json();
const secondSet = j.data.map(function (x) { return x.uri; }).join('|');
Date.now = realNow;
assert(j.data.length === 7 && secondSet !== firstSet, '跨时间桶后随机结果变化');

r = await call('/v1/all.txt?shuffle=1&limit=5');
txt = await r.text();
assert(txt.trim().split('\n').length === 5, '/v1/all.txt?shuffle=1&limit=5');

r = await call('/v1/proxies?format=clash&shuffle=1&limit=4');
const shuffledClash = await r.text();
assert(shuffledClash.indexOf('proxies:') >= 0, 'shuffle + clash 订阅');

r = await call('/v1/proxies?format=json&country=us&limit=10');
j = await r.json();
assert(j.data.length === 0 || j.data.every(function (x) { return x.country === 'US'; }), 'country=us filter');

r = await call('/v1/proxies?format=clash&limit=5');
const yaml = await r.text();
assert(yaml.indexOf('proxies:') >= 0 && yaml.indexOf('proxy-groups:') >= 0, 'clash yaml');
assert(r.headers.get('content-disposition') && r.headers.get('content-disposition').indexOf('proxylane.yaml') >= 0, 'clash filename header');
console.log('   --- clash sample ---');
console.log(yaml.split('\n').slice(0, 16).join('\n'));

r = await call('/v1/proxies?format=base64&limit=5');
const b64 = await r.text();
const decoded = Buffer.from(b64, 'base64').toString('utf8');
assert(decoded.split('\n').filter(Boolean).length === 5 && decoded.indexOf('://') > 0, 'base64 subscription decodes to 5 URIs');
console.log('   --- base64 decoded ---');
console.log(decoded.slice(0, 400));

r = await call('/v1/proxies?format=singbox&limit=3');
const sb = JSON.parse(await r.text());
assert(Array.isArray(sb.outbounds) && sb.outbounds.length === 3 && sb.outbounds[0].server_port > 0, 'sing-box json');

r = await call('/v1/proxies?format=csv&limit=3');
const csv = await r.text();
assert(csv.split('\n')[0] === 'name,protocol,server,port,country,network,security,latency_ms,source,verified,uri', 'csv header');

r = await call('/v1/stats');
j = await r.json();
assert(j.ok && j.total > 0 && j.sources.length >= 4, '/v1/stats');
console.log('   stats:', JSON.stringify({ total: j.total, verified: j.verified, countries: j.top_countries, protocols: j.protocols }));

r = await call('/v1/sources');
j = await r.json();
assert(j.ok && j.sources.length >= 4, '/v1/sources');

r = await call('/v1/countries');
j = await r.json();
assert(j.ok && Array.isArray(j.data) && j.data.length > 0 && /^[A-Z]{2}$/.test(j.data[0].cc) && j.data[0].count > 0, '/v1/countries list');
const countryCodes = j.data.map(function (x) { return x.cc; });
r = await call('/v1/proxies?format=json&country=' + countryCodes[0] + '&limit=5');
j = await r.json();
assert(j.data.length > 0 && j.data.every(function (x) { return x.country === countryCodes[0]; }), 'filter by country from list');

r = await call('/v1/random?protocol=ss');
txt = await r.text();
assert(/^(ss|ssr|vmess|vless|trojan|hysteria2|hy2|tuic|anytls|socks5):\/\//.test(txt.trim()) || txt.trim().length > 0, '/v1/random -> share uri');

r = await call('/v1/config');
j = await r.json();
assert(j.ok && j.formats.length === 7 && j.protocols.indexOf('vless') >= 0, '/v1/config');

r = await call('/v1/nope');
assert(r.status === 404, '/v1/nope -> 404');

r = await call('/');
assert(r.status === 200, 'non-/v1 path delegates to ASSETS');

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
  await worker.scheduled({}, envB, c);
  await c.drain();
  assert(kv2.size === 0, 'plan B: scheduled() 直接 return，不抓取');
}

console.log('\nDONE. exitCode =', process.exitCode || 0);
