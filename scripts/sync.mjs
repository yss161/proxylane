#!/usr/bin/env node
// scripts/sync.mjs
// GitHub Actions 用的"抓取 + 真实探活 + 回写 Cloudflare KV"脚本。
// 用途：在没有 Workers Paid 的情况下，把 CPU 重的验证工作搬到 Actions 里做，
//       Worker 只负责读 KV 并输出，这样免费版也能跑。
//
// 需要环境变量：
//   CF_ACCOUNT_ID       Cloudflare 账号 ID
//   CF_API_TOKEN        有 Workers KV Storage:Edit 权限的 API Token
//   KV_NAMESPACE_ID     PROXY_KV 的 namespace id
// 可选：
//   VERIFY_LIMIT        最多验证多少条（默认 4000）
//   VERIFY_TIMEOUT_MS   单条超时（默认 4000）
//   TARGET_HOST/TARGET_PORT  探活目标（默认 1.1.1.1:443）
//
// 用法：
//   node scripts/sync.mjs --dry-run     # 只抓取+验证，结果写 ./out/
//   node scripts/sync.mjs               # 抓取+验证+写 KV

import net from 'node:net';
import fs from 'node:fs/promises';
import { DEFAULT_SOURCES, collectPool, mergeRecords, sortRecords, packRecords, countBy } from '../src/core.js';

const DRY = process.argv.indexOf('--dry-run') >= 0;
const VERIFY_LIMIT = Number(process.env.VERIFY_LIMIT || 4000);
const VERIFY_TIMEOUT_MS = Number(process.env.VERIFY_TIMEOUT_MS || 4000);
const TARGET_HOST = process.env.TARGET_HOST || '1.1.1.1';
const TARGET_PORT = Number(process.env.TARGET_PORT || 443);
const CONCURRENCY = Number(process.env.VERIFY_CONCURRENCY || 150);

function log() {
  console.log.apply(console, arguments);
}

// ---------------------------------------------------------------
// 探活：HTTP CONNECT / SOCKS5 / SOCKS4 真实握手
// ---------------------------------------------------------------
function ipToBytes(ip) {
  return ip.split('.').map(Number);
}

function probeHttp(host, port, timeoutMs) {
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
    sock.on('connect', function () {
      const req = 'CONNECT ' + TARGET_HOST + ':' + TARGET_PORT + ' HTTP/1.1\r\nHost: ' + TARGET_HOST + ':' + TARGET_PORT + '\r\nProxy-Connection: keep-alive\r\n\r\n';
      sock.write(req);
    });
    sock.on('data', function (buf) {
      const s = buf.toString('latin1');
      if (s.indexOf('200') >= 0) finish(true);
      else if (s.indexOf('HTTP/') === 0) finish(false);
    });
    sock.on('timeout', function () { finish(false); });
    sock.on('error', function () { finish(false); });
    sock.on('close', function () { finish(false); });
  });
}

function probeSocks5(host, port, timeoutMs) {
  return new Promise(function (resolve) {
    const started = Date.now();
    const sock = net.connect({ host: host, port: port });
    let done = false;
    let stage = 0;
    function finish(ok) {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch (e) {}
      resolve({ ok: ok, latency: ok ? Date.now() - started : 0 });
    }
    sock.setTimeout(timeoutMs);
    sock.on('connect', function () {
      sock.write(Buffer.from([0x05, 0x01, 0x00]));
    });
    sock.on('data', function (buf) {
      if (stage === 0) {
        if (buf.length >= 2 && buf[0] === 0x05 && buf[1] === 0x00) {
          stage = 1;
          const b = ipToBytes(TARGET_HOST);
          const req = Buffer.from([0x05, 0x01, 0x00, 0x01, b[0], b[1], b[2], b[3], (TARGET_PORT >> 8) & 0xff, TARGET_PORT & 0xff]);
          sock.write(req);
        } else {
          finish(false);
        }
      } else if (buf.length >= 2 && buf[0] === 0x05) {
        finish(buf[1] === 0x00);
      }
    });
    sock.on('timeout', function () { finish(false); });
    sock.on('error', function () { finish(false); });
    sock.on('close', function () { finish(false); });
  });
}

function probeSocks4(host, port, timeoutMs) {
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
    sock.on('connect', function () {
      const b = ipToBytes(TARGET_HOST);
      const req = Buffer.concat([
        Buffer.from([0x04, 0x01, (TARGET_PORT >> 8) & 0xff, TARGET_PORT & 0xff, b[0], b[1], b[2], b[3], 0x00]),
      ]);
      sock.write(req);
    });
    sock.on('data', function (buf) {
      if (buf.length >= 2) finish(buf[1] === 0x5a);
    });
    sock.on('timeout', function () { finish(false); });
    sock.on('error', function () { finish(false); });
    sock.on('close', function () { finish(false); });
  });
}

function probe(rec, timeoutMs) {
  if (rec.proto === 'socks5') return probeSocks5(rec.host, rec.port, timeoutMs);
  if (rec.proto === 'socks4') return probeSocks4(rec.host, rec.port, timeoutMs);
  return probeHttp(rec.host, rec.port, timeoutMs);
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
      const r = await probe(rec, timeoutMs);
      if (r.ok) {
        const copy = Object.assign({}, rec);
        copy.verified = true;
        copy.latency = r.latency;
        copy.src = rec.src + '+verified';
        alive.push(copy);
      }
    }
  }

  const runners = [];
  for (let i = 0; i < Math.min(concurrency, targets.length); i++) runners.push(worker());
  await Promise.all(runners);
  log('[verify] ' + alive.length + '/' + targets.length + ' alive in ' + (Date.now() - started) + 'ms');
  return alive;
}

// ---------------------------------------------------------------
// 回写 Cloudflare KV
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
// main
// ---------------------------------------------------------------
async function main() {
  log('[1/3] 抓取源 …');
  const pool = await collectPool(DEFAULT_SOURCES, { maxRecords: 20000, timeoutMs: 20000 });
  log('[1/3] 抓到 ' + pool.rawCount + ' 条，合并后 ' + pool.records.length + ' 条');

  log('[2/3] 真实探活（上限 ' + VERIFY_LIMIT + ' 条，目标 ' + TARGET_HOST + ':' + TARGET_PORT + '）…');
  const alive = await verifyAll(pool.records, VERIFY_LIMIT, VERIFY_TIMEOUT_MS, CONCURRENCY);

  const merged = sortRecords(mergeRecords(alive), 'latency');
  const meta = {
    updatedAt: new Date().toISOString(),
    durationMs: 0,
    total: merged.length,
    rawCount: pool.rawCount,
    protocols: countBy(merged, 'proto'),
    anonymity: countBy(merged, 'anon'),
    verified: merged.length,
    countries: Object.keys(countBy(merged, 'cc')).length,
    sources: pool.metas,
    verifiedBy: 'github-actions',
    build: 'sync-1.0.0',
  };
  log('[3/3] 最终可用 ' + merged.length + ' 条');

  const poolJson = JSON.stringify(packRecords(merged));
  const metaJson = JSON.stringify(meta);

  if (DRY) {
    await fs.mkdir('out', { recursive: true });
    await fs.writeFile('out/pool.json', poolJson);
    await fs.writeFile('out/meta.json', metaJson);
    await fs.writeFile('out/proxies.txt', merged.map(function (r) { return r.host + ':' + r.port; }).join('\n') + '\n');
    log('[dry-run] 写入 ./out/');
    return;
  }

  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  const nsId = process.env.KV_NAMESPACE_ID;
  if (!accountId || !token || !nsId) {
    throw new Error('缺少 CF_ACCOUNT_ID / CF_API_TOKEN / KV_NAMESPACE_ID');
  }
  await putKV(accountId, token, nsId, 'pool:v1', poolJson);
  await putKV(accountId, token, nsId, 'meta:v1', metaJson);
  log('done.');
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
