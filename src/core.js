// src/core.js
// 平台无关核心：公开订阅源 / 分享链接解析 / 去重合并 / 评分 / KV 序列化。
// 同时被 src/index.js (Workers) 与 scripts/sync.mjs (GitHub Actions) 复用。

export const PROTO_NAMES = ['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'anytls', 'socks5'];
const PROTO_INDEX = {};
for (let i = 0; i < PROTO_NAMES.length; i++) PROTO_INDEX[PROTO_NAMES[i]] = i;

export const NET_NAMES = ['tcp', 'ws', 'grpc', 'http', 'h2', 'quic', 'httpupgrade', 'splithttp', 'xhttp', 'mkcp', 'kcp', 'udp'];
const NET_INDEX = {};
for (let i = 0; i < NET_NAMES.length; i++) NET_INDEX[NET_NAMES[i]] = i;

export const TLS_NAMES = ['none', 'tls', 'reality'];
const TLS_INDEX = { none: 0, tls: 1, reality: 2 };

export const USER_AGENT = 'proxylane/1.1 (public-node aggregator)';

// ---------------------------------------------------------------
// 默认源：公开 GitHub 订阅（分享链接，非 HTTP 代理列表）
// ---------------------------------------------------------------
export const DEFAULT_SOURCES = [
  {
    id: 'aggregator',
    name: 'mahdibland/V2RayAggregator',
    tier: 1,
    verified: false,
    parser: 'sub',
    url: 'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
    home: 'https://github.com/mahdibland/V2RayAggregator',
  },
  {
    id: 'nomorewalls',
    name: 'peasoft/NoMoreWalls',
    tier: 1,
    verified: false,
    parser: 'sub',
    url: 'https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list_raw.txt',
    home: 'https://github.com/peasoft/NoMoreWalls',
  },
  {
    id: 'free18',
    name: 'free18/v2ray',
    tier: 2,
    verified: false,
    parser: 'sub',
    url: 'https://raw.githubusercontent.com/free18/v2ray/master/v.txt',
    home: 'https://github.com/free18/v2ray',
  },
  {
    id: 'pawdroid',
    name: 'Pawdroid/Free-servers',
    tier: 2,
    verified: false,
    parser: 'sub',
    url: 'https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub',
    home: 'https://github.com/Pawdroid/Free-servers',
  },
  {
    id: 'ripao',
    name: 'ripaojiedian/freenode',
    tier: 2,
    verified: false,
    parser: 'sub',
    url: 'https://raw.githubusercontent.com/ripaojiedian/freenode/main/sub',
    home: 'https://github.com/ripaojiedian/freenode',
  },
];

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
// 主机校验：公网 IPv4 或普通域名
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

export function isValidHost(host) {
  const h = String(host || '').trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!h || h.length > 253) return false;
  const low = h.toLowerCase();
  if (low === 'localhost' || low.endsWith('.local') || low.endsWith('.localhost')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return isPublicIPv4(h);
  if (h.indexOf(':') >= 0) {
    if (low === '::1' || low.indexOf('fe80:') === 0 || low.indexOf('fc') === 0 || low.indexOf('fd') === 0) return false;
    return /^[0-9a-f:]+$/i.test(h);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(h)) return false;
  if (h.indexOf('.') < 0) return false;
  if (h.charAt(0) === '.' || h.charAt(h.length - 1) === '.') return false;
  return true;
}

export function decodeB64(str) {
  let s = String(str || '').replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  const pad = s.length % 4;
  if (pad) s += '===='.slice(pad);
  try {
    if (typeof Buffer !== 'undefined' && Buffer.from) {
      return Buffer.from(s, 'base64').toString('utf8');
    }
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
    if (typeof TextDecoder === 'function') return new TextDecoder('utf-8').decode(bytes);
    return bin;
  } catch (e) {
    return '';
  }
}

function looksLikeUriList(text) {
  return /(?:^|[\s\n])(?:ss|ssr|vmess|vless|trojan|hysteria2?|hy2|tuic|anytls|socks5?):\/\//i.test(text);
}

export function maybeDecodeSubscription(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  if (looksLikeUriList(t)) return t;
  const compact = t.replace(/\s/g, '');
  if (compact.length < 16) return t;
  const decoded = decodeB64(compact);
  if (decoded && looksLikeUriList(decoded)) return decoded;
  return t;
}

function safeDecode(s) {
  try {
    return decodeURIComponent(String(s || '').replace(/\+/g, '%20'));
  } catch (e) {
    return String(s || '');
  }
}

function cleanName(s) {
  let t = safeDecode(s).replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (t.length > 96) t = t.slice(0, 96);
  return t;
}

const CC_TOKEN = /(?:^|[^A-Za-z])(US|JP|KR|SG|HK|TW|DE|GB|UK|NL|FR|CA|AU|IN|RU|TR|BR|VN|TH|MY|PH|ID|IT|ES|PL|UA|IR|AE|CH|SE|NO|FI|IE|AT|BE|CZ|RO|HU|PT|AR|MX|MO|CN|DK|FI|GR|NZ|ZA|CL|CO|EG|SA|IQ|PK|BD|NG|KE|KZ|UZ|BY|BG|HR|SK|SI|LT|LV|EE|IS|LU|MT|CY|QA|KW|OM|BH|JO|LB|AM|GE|AZ|MN|NP|LK|KH|LA|MM|BN)(?:[^A-Za-z]|$)/i;

export function extractCC(name) {
  const s = String(name || '');
  for (let i = 0; i < s.length - 3; i++) {
    const c0 = s.charCodeAt(i);
    const c1 = s.charCodeAt(i + 1);
    const c2 = s.charCodeAt(i + 2);
    const c3 = s.charCodeAt(i + 3);
    if (c0 === 0xD83C && c2 === 0xD83C && c1 >= 0xDDE6 && c1 <= 0xDDFF && c3 >= 0xDDE6 && c3 <= 0xDDFF) {
      return String.fromCharCode(c1 - 0xDDE6 + 65, c3 - 0xDDE6 + 65);
    }
  }
  const m = CC_TOKEN.exec(s);
  if (!m) return '';
  const cc = m[1].toUpperCase();
  return cc === 'UK' ? 'GB' : cc;
}

function splitHostPort(hostport) {
  let raw = String(hostport || '').trim();
  if (!raw) return null;
  const cut = raw.search(/[\/?#]/);
  if (cut >= 0) raw = raw.slice(0, cut);
  if (raw.charAt(0) === '[') {
    const i = raw.indexOf(']');
    if (i < 0) return null;
    const host = raw.slice(1, i);
    const rest = raw.slice(i + 1);
    if (rest.charAt(0) !== ':') return null;
    return { host: host, port: Number(rest.slice(1)) };
  }
  const i = raw.lastIndexOf(':');
  if (i <= 0) return null;
  return { host: raw.slice(0, i), port: Number(raw.slice(i + 1)) };
}

function parseQuery(qs) {
  const out = {};
  const s = String(qs || '');
  if (!s) return out;
  const parts = s.split('&');
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    const eq = parts[i].indexOf('=');
    const k = safeDecode(eq >= 0 ? parts[i].slice(0, eq) : parts[i]).toLowerCase();
    const v = eq >= 0 ? safeDecode(parts[i].slice(eq + 1)) : '';
    if (k) out[k] = v;
  }
  return out;
}

function splitUri(uri) {
  const raw = String(uri || '').trim();
  const schemeEnd = raw.indexOf('://');
  if (schemeEnd < 0) return null;
  const scheme = raw.slice(0, schemeEnd).toLowerCase();
  let rest = raw.slice(schemeEnd + 3);
  let fragment = '';
  const hash = rest.indexOf('#');
  if (hash >= 0) {
    fragment = rest.slice(hash + 1);
    rest = rest.slice(0, hash);
  }
  let query = '';
  const q = rest.indexOf('?');
  if (q >= 0) {
    query = rest.slice(q + 1);
    rest = rest.slice(0, q);
  }
  return { scheme: scheme, body: rest, query: parseQuery(query), name: cleanName(fragment), raw: raw };
}

function normalizeNet(raw) {
  const v = String(raw || '').toLowerCase();
  if (v === 'websocket') return 'ws';
  if (v === 'httpupgrade' || v === 'http_upgrade') return 'httpupgrade';
  if (v === 'xhttp' || v === 'splithttp') return v;
  if (v === 'h2' || v === 'http2') return 'h2';
  if (v === 'grpc') return 'grpc';
  if (v === 'quic') return 'quic';
  if (v === 'kcp' || v === 'mkcp') return 'mkcp';
  if (v === 'http' || v === 'h1' || v === 'tcphttp') return 'http';
  if (v === 'tcp' || v === 'raw' || v === '' || v === 'none') return 'tcp';
  if (NET_INDEX[v] !== undefined) return v;
  return 'tcp';
}

function normalizeTls(security, tlsFlag) {
  const s = String(security || '').toLowerCase();
  if (s === 'reality') return 'reality';
  if (s === 'tls' || s === 'xtls' || tlsFlag === 'tls' || tlsFlag === 'true' || tlsFlag === '1') return 'tls';
  return 'none';
}

function normalizeProto(scheme) {
  if (scheme === 'hy2' || scheme === 'hysteria' || scheme === 'hysteria2') return 'hysteria2';
  if (scheme === 'socks' || scheme === 'socks5') return 'socks5';
  if (PROTO_INDEX[scheme] !== undefined) return scheme;
  return '';
}

function truthy(v) {
  const s = String(v || '').toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function makeBase(src, uri, proto, host, port, name, net, tls, extra) {
  if (!proto || !isValidHost(host) || !isValidPort(port)) return null;
  const nm = name || (proto + '-' + host + ':' + port);
  return {
    host: host,
    port: Number(port),
    proto: proto,
    name: nm,
    cc: extractCC(nm),
    net: net || 'tcp',
    tls: tls || 'none',
    uri: uri,
    src: src.id,
    verified: Boolean(src.verified),
    latency: 0,
    extra: extra || {},
  };
}

function parseSs(src, parts) {
  let userinfo = '';
  let hostport = parts.body;
  const at = parts.body.lastIndexOf('@');
  if (at >= 0) {
    userinfo = parts.body.slice(0, at);
    hostport = parts.body.slice(at + 1);
  } else {
    const decoded = decodeB64(parts.body);
    if (decoded && decoded.indexOf('@') >= 0) {
      const fake = splitUri('ss://' + decoded + (parts.name ? '#' + encodeURIComponent(parts.name) : ''));
      if (fake) return parseSs(src, fake);
    }
    return null;
  }
  const hp = splitHostPort(hostport);
  if (!hp) return null;
  let method = '';
  let password = '';
  const decodedInfo = userinfo.indexOf(':') >= 0 ? safeDecode(userinfo) : decodeB64(userinfo);
  const i = decodedInfo.indexOf(':');
  if (i < 0) {
    const decoded = decodeB64(userinfo);
    const j = decoded.indexOf(':');
    if (j < 0) return null;
    method = decoded.slice(0, j);
    password = decoded.slice(j + 1);
  } else {
    method = decodedInfo.slice(0, i);
    password = decodedInfo.slice(i + 1);
  }
  if (!method || !password) return null;
  const plugin = parts.query.plugin || '';
  return makeBase(src, parts.raw, 'ss', hp.host, hp.port, parts.name, 'tcp', 'none', {
    method: method,
    password: password,
    plugin: plugin,
  });
}

function parseSsr(src, parts) {
  const decoded = decodeB64(parts.body);
  if (!decoded) return null;
  const mainAndQ = decoded.split('/?');
  const main = mainAndQ[0] || '';
  const q = parseQuery(mainAndQ[1] || '');
  const segs = main.split(':');
  if (segs.length < 6) return null;
  const host = segs[0];
  const port = segs[1];
  const protocol = segs[2];
  const method = segs[3];
  const obfs = segs[4];
  const password = decodeB64(segs.slice(5).join(':'));
  const name = cleanName(decodeB64(q.remarks || '')) || parts.name;
  return makeBase(src, parts.raw, 'ssr', host, port, name, 'tcp', 'none', {
    method: method,
    password: password,
    protocol: protocol,
    obfs: obfs,
    obfsparam: decodeB64(q.obfsparam || ''),
    protoparam: decodeB64(q.protoparam || ''),
  });
}

function parseVmess(src, parts) {
  const decoded = decodeB64(parts.body);
  let obj;
  try {
    obj = JSON.parse(decoded);
  } catch (e) {
    return null;
  }
  if (!obj) return null;
  const host = obj.add || obj.addr || obj.host || '';
  const port = obj.port;
  const uuid = obj.id || obj.uuid || '';
  if (!uuid) return null;
  const name = cleanName(obj.ps || obj.remark || parts.name);
  const net = normalizeNet(obj.net || obj.type);
  const tls = normalizeTls(obj.tls, obj.tls);
  return makeBase(src, parts.raw, 'vmess', host, port, name, net, tls === 'none' && String(obj.tls).toLowerCase() === 'tls' ? 'tls' : tls, {
    uuid: uuid,
    alterId: Number(obj.aid || obj.alterId || 0) || 0,
    method: obj.scy || obj.cipher || 'auto',
    path: obj.path || '',
    hostHeader: obj.host || obj.sni || '',
    sni: obj.sni || obj.host || '',
    type: obj.type || '',
    fp: obj.fp || '',
    alpn: obj.alpn || '',
  });
}

function parseUserHost(body) {
  const at = String(body || '').lastIndexOf('@');
  if (at < 0) return null;
  const user = safeDecode(body.slice(0, at));
  const hp = splitHostPort(body.slice(at + 1));
  if (!hp) return null;
  return { user: user, host: hp.host, port: hp.port };
}

function extrasFromQuery(q) {
  const net = normalizeNet(q.type || q.net || q.network);
  const tls = normalizeTls(q.security || q.tls, q.tls);
  return {
    net: net,
    tls: tls,
    extra: {
      path: q.path || q.serviceName || '',
      hostHeader: q.host || q.authority || '',
      sni: q.sni || q.peer || q.host || '',
      fp: q.fp || q.fingerprint || '',
      alpn: q.alpn || '',
      flow: q.flow || '',
      pbk: q.pbk || q.publickey || q['public-key'] || '',
      sid: q.sid || q.shortid || q['short-id'] || '',
      spx: q.spx || '',
      insecure: truthy(q.insecure) || truthy(q.allowinsecure) || truthy(q['allow-insecure']),
      serviceName: q.servicename || q.serviceName || '',
      mode: q.mode || '',
      headerType: q.headertype || q.headerType || '',
      congestion: q.congestion_control || q.congestion || '',
      obfs: q.obfs || '',
      obfsPassword: q['obfs-password'] || q.obfspassword || '',
    },
  };
}

function parseVless(src, parts) {
  const uh = parseUserHost(parts.body);
  if (!uh || !uh.user) return null;
  const x = extrasFromQuery(parts.query);
  return makeBase(src, parts.raw, 'vless', uh.host, uh.port, parts.name, x.net, x.tls, Object.assign({ uuid: uh.user, encryption: parts.query.encryption || 'none' }, x.extra));
}

function parseTrojan(src, parts) {
  const uh = parseUserHost(parts.body);
  if (!uh || !uh.user) return null;
  const x = extrasFromQuery(parts.query);
  const tls = x.tls === 'none' ? 'tls' : x.tls;
  return makeBase(src, parts.raw, 'trojan', uh.host, uh.port, parts.name, x.net, tls, Object.assign({ password: uh.user }, x.extra));
}

function parseHy2(src, parts) {
  const uh = parseUserHost(parts.body);
  if (!uh) return null;
  const x = extrasFromQuery(parts.query);
  return makeBase(src, parts.raw, 'hysteria2', uh.host, uh.port, parts.name, 'udp', 'tls', Object.assign({ password: uh.user || parts.query.auth || '' }, x.extra));
}

function parseTuic(src, parts) {
  const uh = parseUserHost(parts.body);
  if (!uh || !uh.user) return null;
  let uuid = uh.user;
  let password = '';
  const colon = uh.user.indexOf(':');
  if (colon >= 0) {
    uuid = uh.user.slice(0, colon);
    password = uh.user.slice(colon + 1);
  } else {
    password = parts.query.password || '';
  }
  const x = extrasFromQuery(parts.query);
  return makeBase(src, parts.raw, 'tuic', uh.host, uh.port, parts.name, 'udp', 'tls', Object.assign({ uuid: uuid, password: password }, x.extra));
}

function parseAnytls(src, parts) {
  const uh = parseUserHost(parts.body);
  if (!uh || !uh.user) return null;
  const x = extrasFromQuery(parts.query);
  return makeBase(src, parts.raw, 'anytls', uh.host, uh.port, parts.name, 'tcp', x.tls === 'none' ? 'tls' : x.tls, Object.assign({ password: uh.user }, x.extra));
}

function parseSocks(src, parts) {
  let hostport = parts.body;
  let user = '';
  let pass = '';
  const at = parts.body.lastIndexOf('@');
  if (at >= 0) {
    const up = parts.body.slice(0, at);
    hostport = parts.body.slice(at + 1);
    const c = up.indexOf(':');
    user = safeDecode(c >= 0 ? up.slice(0, c) : up);
    pass = safeDecode(c >= 0 ? up.slice(c + 1) : '');
  }
  const hp = splitHostPort(hostport);
  if (!hp) return null;
  return makeBase(src, parts.raw, 'socks5', hp.host, hp.port, parts.name, 'tcp', 'none', { user: user, password: pass });
}

export function parseUri(uri, src) {
  const parts = splitUri(uri);
  if (!parts) return null;
  const scheme = parts.scheme;
  if (scheme === 'ss') return parseSs(src, parts);
  if (scheme === 'ssr') return parseSsr(src, parts);
  if (scheme === 'vmess') return parseVmess(src, parts);
  if (scheme === 'vless') return parseVless(src, parts);
  if (scheme === 'trojan') return parseTrojan(src, parts);
  if (scheme === 'hysteria2' || scheme === 'hy2' || scheme === 'hysteria') return parseHy2(src, parts);
  if (scheme === 'tuic') return parseTuic(src, parts);
  if (scheme === 'anytls') return parseAnytls(src, parts);
  if (scheme === 'socks' || scheme === 'socks5') return parseSocks(src, parts);
  return null;
}

export function parseSubscription(text, src) {
  const decoded = maybeDecodeSubscription(text);
  const out = [];
  const lines = String(decoded || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line || line.charAt(0) === '#' || line.charAt(0) === ';') continue;
    const idx = line.search(/(?:ss|ssr|vmess|vless|trojan|hysteria2?|hy2|tuic|anytls|socks5?):\/\//i);
    if (idx < 0) continue;
    line = line.slice(idx);
    const rec = parseUri(line, src);
    if (rec) out.push(rec);
  }
  return out;
}

export function parseSource(src, text) {
  return parseSubscription(text, src);
}

export function uriKey(r) {
  const u = String((r && r.uri) || '');
  const i = u.indexOf('#');
  return (i >= 0 ? u.slice(0, i) : u).toLowerCase();
}

export function quality(r) {
  let score = 0;
  if (r.verified) score += 1000;
  if (r.tls === 'reality') score += 220;
  else if (r.tls === 'tls') score += 120;
  const protoScore = { vless: 90, trojan: 80, ss: 70, hysteria2: 65, tuic: 55, vmess: 50, anytls: 40, socks5: 20, ssr: 10 };
  score += protoScore[r.proto] || 0;
  if (r.cc) score += 30;
  if (r.net === 'ws' || r.net === 'grpc') score += 15;
  if (r.latency > 0) score += Math.max(0, 400 - Math.min(r.latency, 4000) / 10);
  return score;
}

export function mergeRecords(list) {
  const map = new Map();
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const key = uriKey(r);
    if (!key) continue;
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
  if (mode === 'name') {
    arr.sort(function (a, b) {
      const na = a.name || '';
      const nb = b.name || '';
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
    return arr;
  }
  arr.sort(function (a, b) {
    return quality(b) - quality(a);
  });
  return arr;
}

export function packRecords(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    out.push([
      r.host,
      r.port,
      PROTO_INDEX[r.proto] || 0,
      r.cc || '',
      NET_INDEX[r.net] || 0,
      TLS_INDEX[r.tls] || 0,
      r.latency || 0,
      r.src || '',
      r.verified ? 1 : 0,
      r.name || '',
      r.uri || '',
      r.extra || {},
    ]);
  }
  return out;
}

export function unpackRecords(packed) {
  const out = [];
  if (!Array.isArray(packed)) return out;
  for (let i = 0; i < packed.length; i++) {
    const a = packed[i];
    if (!Array.isArray(a) || a.length < 11) continue;
    out.push({
      host: a[0],
      port: a[1],
      proto: PROTO_NAMES[a[2]] || 'ss',
      cc: a[3] || '',
      net: NET_NAMES[a[4]] || 'tcp',
      tls: TLS_NAMES[a[5]] || 'none',
      latency: a[6] || 0,
      src: a[7] || '',
      verified: a[8] === 1,
      name: a[9] || '',
      uri: a[10] || '',
      extra: a[11] && typeof a[11] === 'object' ? a[11] : {},
    });
  }
  return out;
}

function sourceUrls(src) {
  const url = String((src && src.url) || '');
  const out = [url];
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(url);
  if (m) {
    out.push('https://cdn.jsdelivr.net/gh/' + m[1] + '/' + m[2] + '@' + m[3] + '/' + m[4]);
    out.push('https://gh-proxy.com/' + url);
  }
  return out.filter(Boolean);
}

async function fetchText(fetchImpl, url, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: ctl.signal,
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function collectPool(sources, opts) {
  const o = opts || {};
  const concurrency = o.concurrency || 5;
  const timeoutMs = o.timeoutMs || 20000;
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
      try {
        const urls = sourceUrls(src);
        let text = '';
        let lastErr = null;
        for (let u = 0; u < urls.length; u++) {
          try {
            text = await fetchText(fetchImpl, urls[u], timeoutMs);
            if (text) { lastErr = null; break; }
          } catch (e) {
            lastErr = e;
          }
        }
        if (lastErr) throw lastErr;
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

// 国家/地区清单：[{ cc: 'US', count: 210 }, ...]，按节点数降序
export function countryList(list, limit) {
  const counts = countBy(list, 'cc');
  const keys = Object.keys(counts);
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!k || k === 'unknown' || k.length !== 2) continue;
    out.push({ cc: k, count: counts[k] });
  }
  out.sort(function (a, b) {
    return b.count - a.count || (a.cc < b.cc ? -1 : a.cc > b.cc ? 1 : 0);
  });
  return limit > 0 ? out.slice(0, limit) : out;
}

export function countBy(list, field) {
  const out = {};
  for (let i = 0; i < list.length; i++) {
    const k = list[i][field] || 'unknown';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
