// src/format.js
// 输出：json / txt / csv / clash / base64 / surge / singbox
import { PROTO_NAMES } from './core.js';

export const FORMATS = ['json', 'txt', 'csv', 'clash', 'base64', 'surge', 'singbox'];

// 目标客户端不支持的协议会在输出时剔除
export const FORMAT_PROTOCOLS = {
  json: null,
  txt: null,
  csv: null,
  base64: ['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'anytls', 'socks5'],
  clash: ['ss', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'anytls', 'socks5'],
  surge: ['ss', 'vmess', 'trojan', 'hysteria2', 'socks5'],
  singbox: ['ss', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'anytls', 'socks5'],
};

function yamlStr(s) {
  const t = String(s == null ? '' : s);
  if (/^[A-Za-z0-9_.:\/-]+$/.test(t) && t !== '' && t !== 'true' && t !== 'false' && t !== 'null') return t;
  return JSON.stringify(t);
}

export function tagName(r, i) {
  const base = (r.name && String(r.name).trim()) || ((r.cc || 'XX') + '-' + r.proto + '-' + (i + 1));
  let n = base.replace(/[\r\n"]/g, ' ').trim();
  if (!n) n = r.proto + '-' + (i + 1);
  if (n.length > 64) n = n.slice(0, 64);
  return n;
}

export function proxyUri(r) {
  return r.uri || '';
}

function extra(r) {
  return r.extra && typeof r.extra === 'object' ? r.extra : {};
}

function jsonItem(r) {
  const e = extra(r);
  return {
    name: r.name || null,
    protocol: r.proto,
    server: r.host,
    port: r.port,
    country: r.cc || null,
    network: r.net || null,
    security: r.tls || null,
    latency_ms: r.latency || null,
    source: r.src,
    verified: Boolean(r.verified),
    uri: r.uri,
    method: e.method || null,
    uuid: e.uuid || null,
    flow: e.flow || null,
    sni: e.sni || null,
    path: e.path || null,
    fingerprint: e.fp || null,
  };
}

export function toTxt(list) {
  const lines = [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].uri) lines.push(list[i].uri);
  }
  return lines.join('\n') + (lines.length ? '\n' : '');
}

export function toJson(list, meta) {
  const items = [];
  for (let i = 0; i < list.length; i++) items.push(jsonItem(list[i]));
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
  const rows = ['name,protocol,server,port,country,network,security,latency_ms,source,verified,uri'];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    rows.push([
      r.name, r.proto, r.host, r.port, r.cc, r.net, r.tls,
      r.latency || '', r.src, r.verified ? 'true' : 'false', r.uri,
    ].map(csvCell).join(','));
  }
  return rows.join('\n') + '\n';
}

function clashProxy(r, i) {
  const name = tagName(r, i);
  const e = extra(r);
  const lines = [];
  lines.push('  - name: ' + yamlStr(name));
  if (r.proto === 'ss') {
    lines.push('    type: ss');
    lines.push('    server: ' + yamlStr(r.host));
    lines.push('    port: ' + r.port);
    lines.push('    cipher: ' + yamlStr(e.method || 'aes-256-gcm'));
    lines.push('    password: ' + yamlStr(e.password || ''));
    if (e.plugin) lines.push('    plugin: ' + yamlStr(String(e.plugin).split(';')[0]));
    return { name: name, lines: lines };
  }
  if (r.proto === 'vmess') {
    lines.push('    type: vmess');
    lines.push('    server: ' + yamlStr(r.host));
    lines.push('    port: ' + r.port);
    lines.push('    uuid: ' + yamlStr(e.uuid || ''));
    lines.push('    alterId: ' + (Number(e.alterId) || 0));
    lines.push('    cipher: ' + yamlStr(e.method || 'auto'));
    if (r.net && r.net !== 'tcp') lines.push('    network: ' + r.net);
    if (r.tls === 'tls' || r.tls === 'reality') lines.push('    tls: true');
    if (e.sni) lines.push('    servername: ' + yamlStr(e.sni));
    if (r.net === 'ws') {
      lines.push('    ws-opts:');
      lines.push('      path: ' + yamlStr(e.path || '/'));
      if (e.hostHeader) {
        lines.push('      headers:');
        lines.push('        Host: ' + yamlStr(e.hostHeader));
      }
    }
    if (r.net === 'grpc' && e.serviceName) {
      lines.push('    grpc-opts:');
      lines.push('      grpc-service-name: ' + yamlStr(e.serviceName));
    }
    return { name: name, lines: lines };
  }
  if (r.proto === 'vless') {
    lines.push('    type: vless');
    lines.push('    server: ' + yamlStr(r.host));
    lines.push('    port: ' + r.port);
    lines.push('    uuid: ' + yamlStr(e.uuid || ''));
    if (e.flow) lines.push('    flow: ' + yamlStr(e.flow));
    if (r.net && r.net !== 'tcp') lines.push('    network: ' + r.net);
    if (r.tls === 'tls' || r.tls === 'reality') lines.push('    tls: true');
    if (r.tls === 'reality') {
      lines.push('    reality-opts:');
      if (e.pbk) lines.push('      public-key: ' + yamlStr(e.pbk));
      if (e.sid) lines.push('      short-id: ' + yamlStr(e.sid));
    }
    if (e.sni) lines.push('    servername: ' + yamlStr(e.sni));
    if (e.fp) lines.push('    client-fingerprint: ' + yamlStr(e.fp));
    if (r.net === 'ws') {
      lines.push('    ws-opts:');
      lines.push('      path: ' + yamlStr(e.path || '/'));
      if (e.hostHeader) {
        lines.push('      headers:');
        lines.push('        Host: ' + yamlStr(e.hostHeader));
      }
    }
    if (r.net === 'grpc' && (e.serviceName || e.path)) {
      lines.push('    grpc-opts:');
      lines.push('      grpc-service-name: ' + yamlStr(e.serviceName || e.path));
    }
    return { name: name, lines: lines };
  }
  if (r.proto === 'trojan') {
    lines.push('    type: trojan');
    lines.push('    server: ' + yamlStr(r.host));
    lines.push('    port: ' + r.port);
    lines.push('    password: ' + yamlStr(e.password || ''));
    if (e.sni) lines.push('    sni: ' + yamlStr(e.sni));
    if (e.insecure) lines.push('    skip-cert-verify: true');
    if (r.net && r.net !== 'tcp') lines.push('    network: ' + r.net);
    if (r.net === 'ws') {
      lines.push('    ws-opts:');
      lines.push('      path: ' + yamlStr(e.path || '/'));
      if (e.hostHeader) {
        lines.push('      headers:');
        lines.push('        Host: ' + yamlStr(e.hostHeader));
      }
    }
    return { name: name, lines: lines };
  }
  if (r.proto === 'hysteria2') {
    lines.push('    type: hysteria2');
    lines.push('    server: ' + yamlStr(r.host));
    lines.push('    port: ' + r.port);
    lines.push('    password: ' + yamlStr(e.password || ''));
    if (e.sni) lines.push('    sni: ' + yamlStr(e.sni));
    if (e.insecure) lines.push('    skip-cert-verify: true');
    if (e.obfs) lines.push('    obfs: ' + yamlStr(e.obfs));
    if (e.obfsPassword) lines.push('    obfs-password: ' + yamlStr(e.obfsPassword));
    return { name: name, lines: lines };
  }
  if (r.proto === 'tuic') {
    lines.push('    type: tuic');
    lines.push('    server: ' + yamlStr(r.host));
    lines.push('    port: ' + r.port);
    if (e.uuid) lines.push('    uuid: ' + yamlStr(e.uuid));
    if (e.password) lines.push('    password: ' + yamlStr(e.password));
    if (e.sni) lines.push('    sni: ' + yamlStr(e.sni));
    if (e.congestion) lines.push('    congestion-controller: ' + yamlStr(e.congestion));
    if (e.insecure) lines.push('    skip-cert-verify: true');
    return { name: name, lines: lines };
  }
  if (r.proto === 'anytls') {
    lines.push('    type: anytls');
    lines.push('    server: ' + yamlStr(r.host));
    lines.push('    port: ' + r.port);
    lines.push('    password: ' + yamlStr(e.password || ''));
    if (e.sni) lines.push('    sni: ' + yamlStr(e.sni));
    if (e.insecure) lines.push('    skip-cert-verify: true');
    return { name: name, lines: lines };
  }
  if (r.proto === 'socks5') {
    lines.push('    type: socks5');
    lines.push('    server: ' + yamlStr(r.host));
    lines.push('    port: ' + r.port);
    if (e.user) lines.push('    username: ' + yamlStr(e.user));
    if (e.password) lines.push('    password: ' + yamlStr(e.password));
    return { name: name, lines: lines };
  }
  return null;
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
  const used = Object.create(null);
  for (let i = 0; i < list.length; i++) {
    const item = clashProxy(list[i], i);
    if (!item) continue;
    let name = item.name;
    if (used[name]) {
      let n = 2;
      while (used[name + '-' + n]) n++;
      name = name + '-' + n;
      item.lines[0] = '  - name: ' + yamlStr(name);
    }
    used[name] = 1;
    names.push(name);
    for (let j = 0; j < item.lines.length; j++) out.push(item.lines[j]);
  }
  out.push('');
  out.push('proxy-groups:');
  out.push('  - name: ' + groupName);
  out.push('    type: select');
  out.push('    proxies:');
  for (let i = 0; i < names.length; i++) out.push('      - ' + yamlStr(names[i]));
  if (!names.length) out.push('      - DIRECT');
  out.push('');
  out.push('rules:');
  out.push('  - MATCH,' + groupName);
  return out.join('\n') + '\n';
}

export function toBase64Sub(list) {
  const lines = [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].uri) lines.push(list[i].uri);
  }
  const raw = lines.join('\n');
  if (typeof Buffer !== 'undefined' && Buffer.from) return Buffer.from(raw, 'utf8').toString('base64');
  const bytes = new TextEncoder().encode(raw);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function toSurge(list) {
  const out = ['# proxylane generated Surge snippet', '[Proxy]'];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const e = extra(r);
    const name = tagName(r, i).replace(/,/g, ' ');
    if (r.proto === 'ss') {
      out.push(name + ' = ss, ' + r.host + ', ' + r.port + ', encrypt-method=' + (e.method || 'aes-256-gcm') + ', password=' + (e.password || ''));
    } else if (r.proto === 'vmess') {
      let line = name + ' = vmess, ' + r.host + ', ' + r.port + ', username=' + (e.uuid || '');
      if (r.tls === 'tls' || r.tls === 'reality') line += ', tls=true';
      if (r.net === 'ws') line += ', ws=true, ws-path=' + (e.path || '/');
      if (e.sni) line += ', sni=' + e.sni;
      out.push(line);
    } else if (r.proto === 'trojan') {
      let line = name + ' = trojan, ' + r.host + ', ' + r.port + ', password=' + (e.password || '');
      if (e.sni) line += ', sni=' + e.sni;
      if (e.insecure) line += ', skip-cert-verify=true';
      out.push(line);
    } else if (r.proto === 'hysteria2') {
      let line = name + ' = hysteria2, ' + r.host + ', ' + r.port + ', password=' + (e.password || '');
      if (e.sni) line += ', sni=' + e.sni;
      out.push(line);
    } else if (r.proto === 'socks5') {
      out.push(name + ' = socks5, ' + r.host + ', ' + r.port);
    }
  }
  return out.join('\n') + '\n';
}

export function toSingbox(list) {
  const outbounds = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const e = extra(r);
    const tag = tagName(r, i);
    if (r.proto === 'ss') {
      outbounds.push({ type: 'shadowsocks', tag: tag, server: r.host, server_port: r.port, method: e.method || 'aes-256-gcm', password: e.password || '' });
    } else if (r.proto === 'vmess') {
      const o = { type: 'vmess', tag: tag, server: r.host, server_port: r.port, uuid: e.uuid || '', security: e.method || 'auto', alter_id: Number(e.alterId) || 0 };
      if (r.net && r.net !== 'tcp') o.transport = { type: r.net, path: e.path || undefined, headers: e.hostHeader ? { Host: e.hostHeader } : undefined };
      if (r.tls === 'tls' || r.tls === 'reality') o.tls = { enabled: true, server_name: e.sni || undefined };
      outbounds.push(o);
    } else if (r.proto === 'vless') {
      const o = { type: 'vless', tag: tag, server: r.host, server_port: r.port, uuid: e.uuid || '', flow: e.flow || undefined };
      if (r.net && r.net !== 'tcp') o.transport = { type: r.net, path: e.path || undefined, service_name: e.serviceName || undefined, headers: e.hostHeader ? { Host: e.hostHeader } : undefined };
      if (r.tls === 'tls' || r.tls === 'reality') {
        o.tls = { enabled: true, server_name: e.sni || undefined, utls: e.fp ? { enabled: true, fingerprint: e.fp } : undefined };
        if (r.tls === 'reality') o.tls.reality = { enabled: true, public_key: e.pbk || '', short_id: e.sid || '' };
      }
      outbounds.push(o);
    } else if (r.proto === 'trojan') {
      const o = { type: 'trojan', tag: tag, server: r.host, server_port: r.port, password: e.password || '' };
      if (r.tls !== 'none') o.tls = { enabled: true, server_name: e.sni || undefined, insecure: Boolean(e.insecure) };
      outbounds.push(o);
    } else if (r.proto === 'hysteria2') {
      outbounds.push({ type: 'hysteria2', tag: tag, server: r.host, server_port: r.port, password: e.password || '', tls: { enabled: true, server_name: e.sni || undefined, insecure: Boolean(e.insecure) } });
    } else if (r.proto === 'tuic') {
      outbounds.push({ type: 'tuic', tag: tag, server: r.host, server_port: r.port, uuid: e.uuid || '', password: e.password || '', congestion_control: e.congestion || 'bbr', tls: { enabled: true, server_name: e.sni || undefined, insecure: Boolean(e.insecure) } });
    } else if (r.proto === 'anytls') {
      outbounds.push({ type: 'anytls', tag: tag, server: r.host, server_port: r.port, password: e.password || '', tls: { enabled: true, server_name: e.sni || undefined, insecure: Boolean(e.insecure) } });
    } else if (r.proto === 'socks5') {
      const o = { type: 'socks', tag: tag, server: r.host, server_port: r.port, version: '5' };
      if (e.user) o.username = e.user;
      if (e.password) o.password = e.password;
      outbounds.push(o);
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

export { PROTO_NAMES };
