#!/usr/bin/env node
// scripts/sync.mjs
// GitHub Actions：抓取公开订阅 → 解析分享链接 → TCP 探活 → 回写 Cloudflare KV
//
// 需要环境变量：
//   CF_ACCOUNT_ID / CF_API_TOKEN / KV_NAMESPACE_ID
// 可选：
//   VERIFY_LIMIT        最多探活多少条（默认 4000）
//   VERIFY_TIMEOUT_MS   单条超时（默认 4000）
//   VERIFY_CONCURRENCY  并发（默认 150）

import net from 'node:net';
import fs from 'node:fs/promises';
import { DEFAULT_SOURCES, collectPool, mergeRecords, sortRecords, packRecords, countBy, countryList } from '../src/core.js';

const DRY = process.argv.indexOf('--dry-run') >= 0;
const VERIFY_LIMIT = Number(process.env.VERIFY_LIMIT || 4000);
const VERIFY_TIMEOUT_MS = Number(process.env.VERIFY_TIMEOUT_MS || 4000);
const CONCURRENCY = Number(process.env.VERIFY_CONCURRENCY || 150);

function log() {
  console.log.apply(console, arguments);
}

function probeTcp(host, port, timeoutMs) {
  return new Promise(function (resolve) {
    const started = Date.now();
    const sock = net.connect({ host: host, port: port });
    let done = false;
    function finish(ok) {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch (e) {}
      resolve({ ok: ok, latency: ok ? Date.now() - started : 0 });
    }
    sock.setTimeout(timeoutMs);
    sock.on('connect', function () { finish(true); });
    sock.on('timeout', function () { finish(false); });
    sock.on('error', function () { finish(false); });
    sock.on('close', function () { finish(false); });
  });
}

async function verifyAll(list, limit, timeoutMs, concurrency) {
  const targets = list.slice(0, limit);
  const alive = [];
  let cursor = 0;
  const started = Date.now();

  async function worker() {
    while (cursor < targets.length) {
      const rec = targets[cursor];
      cursor++;
      const r = await probeTcp(rec.host, rec.port, timeoutMs);
      if (r.ok) {
        const copy = Object.assign({}, rec);
        copy.verified = true;
        copy.latency = r.latency;
        alive.push(copy);
      }
    }
  }

  const runners = [];
  for (let i = 0; i < Math.min(concurrency, targets.length); i++) runners.push(worker());
  await Promise.all(runners);
  log('[verify] ' + alive.length + '/' + targets.length + ' tcp-open in ' + (Date.now() - started) + 'ms');
  return alive;
}

async function putKV(accountId, token, nsId, key, value) {
  const url = 'https://api.cloudflare.com/client/v4/accounts/' + accountId + '/storage/kv/namespaces/' + nsId + '/values/' + encodeURIComponent(key);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'text/plain' },
    body: value,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('KV PUT ' + key + ' -> ' + res.status + ' ' + t.slice(0, 300));
  }
  log('[kv] wrote ' + key + ' (' + value.length + ' bytes)');
}

async function main() {
  const t0 = Date.now();
  log('[1/3] 抓取公开订阅 …');
  const pool = await collectPool(DEFAULT_SOURCES, { maxRecords: 20000, timeoutMs: 25000 });
  log('[1/3] 抓到 ' + pool.rawCount + ' 条，合并后 ' + pool.records.length + ' 条');
  log('[1/3] 协议分布 ' + JSON.stringify(countBy(pool.records, 'proto')));

  log('[2/3] TCP 探活（上限 ' + VERIFY_LIMIT + ' 条）…');
  const stableCount = Math.floor(VERIFY_LIMIT * 0.75);
  const stable = pool.records.slice(0, stableCount);
  const rest = pool.records.slice(stableCount);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = rest[i]; rest[i] = rest[j]; rest[j] = t;
  }
  const candidates = stable.concat(rest.slice(0, Math.max(0, VERIFY_LIMIT - stableCount)));
  const alive = await verifyAll(candidates, candidates.length, VERIFY_TIMEOUT_MS, CONCURRENCY);

  const merged = sortRecords(mergeRecords(alive), 'latency');
  const countries = countryList(merged, 200);
  const meta = {
    updatedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    total: merged.length,
    rawCount: pool.rawCount,
    protocols: countBy(merged, 'proto'),
    networks: countBy(merged, 'net'),
    security: countBy(merged, 'tls'),
    verified: merged.length,
    countries: countries.length,
    countryList: countries,
    sources: pool.metas,
    verifiedBy: 'github-actions-tcp',
    build: 'sync-1.1.0',
  };
  log('[3/3] 最终可用 ' + merged.length + ' 条');
  log('[3/3] 协议分布 ' + JSON.stringify(meta.protocols));

  const poolJson = JSON.stringify(packRecords(merged));
  const metaJson = JSON.stringify(meta);

  if (DRY) {
    await fs.mkdir('out', { recursive: true });
    await fs.writeFile('out/pool.json', poolJson);
    await fs.writeFile('out/meta.json', metaJson);
    await fs.writeFile('out/nodes.txt', merged.map(function (r) { return r.uri; }).join('\n') + '\n');
    log('[dry-run] 写入 ./out/');
    return;
  }

  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  const nsId = process.env.KV_NAMESPACE_ID;
  if (!accountId || !token || !nsId) {
    throw new Error('缺少 CF_ACCOUNT_ID / CF_API_TOKEN / KV_NAMESPACE_ID');
  }
  await putKV(accountId, token, nsId, 'pool:v2', poolJson);
  await putKV(accountId, token, nsId, 'meta:v2', metaJson);
  log('done.');
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
