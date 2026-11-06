// src/format.js
// 输出格式：json / txt / csv / clash / base64 / surge / singbox
import { PROTO_NAMES } from './core.js';

export const FORMATS = ['json', 'txt', 'csv', 'clash', 'base64', 'surge', 'singbox'];

// 某些客户端格式不支持 socks4，输出时会自动剔除
export const FORMAT_PROTOCOLS = {
  json: null,
  txt: null,
  csv: null,
  base64: ['http', 'https', 'socks4', 'socks5'],
  clash: ['http', 'https', 'socks5'],
  surge: ['http', 'https', 'socks5'],
  singbox: ['http', 'https', 'socks5'],
};

export function tagName(r, i) {
  const cc = r.cc || 'XX';
  let n = String(i + 1);
  while (n.length < 3) n = '0' + n;
  return cc + '-' + n;
}

// 订阅里用的 URI。Shadowrocket / v2rayN / NekoBox 都认 scheme://host:port#tag
export function proxyUri(r, i) {
  let scheme = 'http';
  if (r.proto === 'socks4') scheme = 'socks4';
  else if (r.proto === 'socks5') scheme = 'socks5';
  return scheme + '://' + r.host + ':' + r.port + '#' + encodeURIComponent(tagName(r, i));
}

function clashType(proto) {
  if (proto === 'socks5') return 'socks5';
  return 'http';
}

export function toTxt(list) {
  const lines = [];
  for (let i = 0; i < list.length; i++) lines.push(list[i].host + ':' + list[i].port);
  return lines.join('\n') + (lines.length ? '\n' : '');
}

export function toJson(list, meta) {
  const items = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    items.push({
      proxy: r.host + ':' + r.port,
      protocol: r.proto,
      ip: r.host,
      port: r.port,
      country: r.cc || null,
      anonymity: r.anon,
      latency_ms: r.latency || null,
      source: r.src,
      verified: r.verified,
    });
  }
  const body = {
    ok: true,
    count: items.length,
    total: meta && meta.total ? meta.total : items.length,
    offset: (meta && meta.offset) || 0,
    updated_at: (meta && meta.updatedAt) || null,
    data: items,
  };
  return JSON.stringify(body, null, 2);
}

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n]/.test(s)) return '"' + s.split('"').join('""') + '"';
  return s;
}

export function toCsv(list) {
  const rows = ['ip,port,protocol,country,anonymity,latency_ms,source,verified'];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    rows.push([r.host, r.port, r.proto, r.cc, r.anon, r.latency || '', r.src, r.verified ? 'true' : 'false'].map(csvCell).join(','));
  }
  return rows.join('\n') + '\n';
}

export function toClash(list, opts) {
  const o = opts || {};
  const groupName = o.groupName || 'PROXY';
  const out = [];
  out.push('# proxylane generated config');
  out.push('mixed-port: 7890');
  out.push('allow-lan: false');
  out.push('mode: rule');
  out.push('log-level: warning');
  out.push('ipv6: false');
  out.push('');
  out.push('proxies:');
  const names = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const name = tagName(r, i);
    names.push(name);
    out.push('  - name: "' + name + '"');
    out.push('    type: ' + clashType(r.proto));
    out.push('    server: ' + r.host);
    out.push('    port: ' + r.port);
    out.push('    udp: false');
  }
  out.push('');
  out.push('proxy-groups:');
  out.push('  - name: ' + groupName);
  out.push('    type: select');
  out.push('    proxies:');
  for (let i = 0; i < names.length; i++) out.push('      - "' + names[i] + '"');
  out.push('');
  out.push('rules:');
  out.push('  - MATCH,' + groupName);
  return out.join('\n') + '\n';
}

export function toBase64Sub(list) {
  const lines = [];
  for (let i = 0; i < list.length; i++) lines.push(proxyUri(list[i], i));
  const raw = lines.join('\n');
  // 纯 ASCII，直接 btoa / Buffer
  if (typeof btoa === 'function') return btoa(raw);
  return Buffer.from(raw, 'binary').toString('base64');
}

export function toSurge(list) {
  const out = ['# proxylane generated Surge snippet', '[Proxy]'];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const type = r.proto === 'socks5' ? 'socks5' : 'http';
    out.push(tagName(r, i) + ' = ' + type + ', ' + r.host + ', ' + r.port);
  }
  return out.join('\n') + '\n';
}

export function toSingbox(list) {
  const outbounds = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const tag = tagName(r, i);
    if (r.proto === 'socks5') {
      outbounds.push({ type: 'socks', tag: tag, server: r.host, server_port: r.port, version: '5' });
    } else {
      outbounds.push({ type: 'http', tag: tag, server: r.host, server_port: r.port });
    }
  }
  return JSON.stringify({ outbounds: outbounds }, null, 2);
}

export function contentTypeOf(format) {
  if (format === 'json' || format === 'singbox') return 'application/json; charset=utf-8';
  if (format === 'csv') return 'text/csv; charset=utf-8';
  if (format === 'clash') return 'text/yaml; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

export function render(format, list, meta) {
  const f = FORMATS.indexOf(format) >= 0 ? format : 'json';
  if (f === 'txt') return { body: toTxt(list), contentType: contentTypeOf(f) };
  if (f === 'csv') return { body: toCsv(list), contentType: contentTypeOf(f) };
  if (f === 'clash') return { body: toClash(list, meta), contentType: contentTypeOf(f) };
  if (f === 'base64') return { body: toBase64Sub(list), contentType: contentTypeOf(f) };
  if (f === 'surge') return { body: toSurge(list), contentType: contentTypeOf(f) };
  if (f === 'singbox') return { body: toSingbox(list), contentType: contentTypeOf(f) };
  return { body: toJson(list, meta), contentType: contentTypeOf('json') };
}
