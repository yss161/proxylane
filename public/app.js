// public/app.js — 双语支持 / 列表加载 / 复制
var I18N = {
  zh: {
    nav_home: '首页',
    nav_docs: '接口文档',
    nav_stats: '运行状态',
    warn: '节点来自公开订阅，仅做解析、去重和端口探活，不保证能访问特定网站。公开节点可能记录或篡改流量，请勿传输账号密码、令牌等敏感信息。',
    sub_title: '订阅地址',
    sub_desc: '复制链接导入客户端',
    card_txt: '纯文本节点',
    card_txt_hint: '一行一个分享链接，适合脚本 / 自建工具',
    card_clash: 'Clash / Mihomo',
    card_clash_hint: 'Clash Verge、Mihomo、Stash 直接导入',
    card_b64: 'Base64 订阅',
    card_b64_hint: 'v2rayN、NekoBox、小火箭',
    card_singbox: 'sing-box',
    card_singbox_hint: 'outbounds JSON，可粘贴进配置',
    card_surge: 'Surge',
    card_surge_hint: 'Surge 配置片段（[Proxy] 段）',
    stats_total: '节点总数',
    stats_verified: '端口已探活',
    stats_countries: '国家/地区',
    stats_updated: '最近刷新',
    sync_hint: '数据由 GitHub Actions 定时同步（配置为每 30 分钟，可能延迟），页面每 30 秒更新「多久之前」。',
    just_now: '刚刚',
    minutes_ago: ' 分钟前',
    hours_ago: ' 小时前',
    days_ago: ' 天前',
    filter_title: '搜寻翻墙节点',
    f_search: '关键词',
    f_protocol: '协议',
    f_country: '国家码',
    f_network: '传输',
    f_security: '安全',
    f_source: '来源',
    f_sort: '排序',
    f_limit: '每页',
    f_verified: '仅已探活',
    f_apply: '搜索',
    f_reset: '重置',
    all: '全部',
    qr: '二维码',
    qr_node: '节点二维码',
    qr_sub: '订阅二维码',
    qr_hint: '用手机客户端扫码导入',
    close: '关闭',
    qr_too_long: '这段链接太长，无法生成二维码',
    launch: '导入客户端',
    launch_title: '一键导入到客户端',
    launch_hint: '点了没反应说明该客户端没装，可用二维码或复制订阅地址',
    launch_open: '打开',
    custom_title: '自定义订阅（随机分发）',
    custom_count: '节点数量',
    custom_format: '格式',
    custom_proto: '协议',
    custom_shuffle: '随机分发',
    custom_interval: '客户端刷新间隔（小时）',
    custom_hint: '开启随机分发后，每次拉取都会换一批节点；同一分钟内结果相同，避免频繁打爆后端。',
    launch_note: '导入后用订阅地址，客户端会自动更新节点',
    open_client: '打开',
    sort_quality: '质量优先',
    sort_latency: '延迟最低',
    sort_country: '按国家',
    sort_name: '按名称',
    sort_random: '随机',
    th_name: '名称',
    th_proto: '协议',
    th_server: '服务器',
    th_country: '国家',
    th_net: '传输',
    th_tls: '安全',
    th_latency: '延迟',
    th_source: '来源',
    th_copy: '分享链接',
    th_proxy: '地址',
    th_verified: '状态',
    yes: '已探活',
    no: '未探活',
    copy_uri: '复制',
    prev: '上一页',
    next: '下一页',
    copy: '复制',
    copied: '已复制',
    loading: '加载中…',
    empty: '没有符合条件的节点',
    page: '第',
    page_of: '页 / 共',
    rows: '条结果',
    foot_sources: '数据来源',
    foot_built: '由 Cloudflare Workers 驱动 · 每小时自动刷新',
    booting: '节点数据准备中，正在自动重试…',
    lang_label: 'EN',
  },
  en: {
    nav_home: 'Home',
    nav_docs: 'API Docs',
    nav_stats: 'Status',
    warn: 'Nodes come from public subscriptions. We only parse, dedupe and TCP-probe them; access to any specific website is not guaranteed. Public nodes may log or tamper with traffic. Never send credentials or tokens through them.',
    sub_title: 'Subscription URLs',
    sub_desc: 'Copy a link into your client',
    card_txt: 'Plain-text nodes',
    card_txt_hint: 'One share URI per line — scripts & custom tools',
    card_clash: 'Clash / Mihomo',
    card_clash_hint: 'Import directly in Clash Verge, Mihomo, Stash',
    card_b64: 'Base64 subscription',
    card_b64_hint: 'v2rayN, NekoBox, Shadowrocket',
    card_singbox: 'sing-box',
    card_singbox_hint: 'outbounds JSON you can paste into config',
    card_surge: 'Surge',
    card_surge_hint: 'Surge config snippet ([Proxy] section)',
    stats_total: 'Total nodes',
    stats_verified: 'TCP probed',
    stats_countries: 'Countries',
    stats_updated: 'Last refresh',
    sync_hint: 'Synced periodically by GitHub Actions (configured every 30 min, may be delayed); this page refreshes the “ago” label every 30s.',
    just_now: 'just now',
    minutes_ago: ' min ago',
    hours_ago: ' h ago',
    days_ago: ' d ago',
    filter_title: 'Search nodes',
    f_search: 'Keyword',
    f_protocol: 'Protocol',
    f_country: 'Country',
    f_network: 'Network',
    f_security: 'Security',
    f_source: 'Source',
    f_sort: 'Sort',
    f_limit: 'Per page',
    f_verified: 'Probed only',
    f_apply: 'Search',
    f_reset: 'Reset',
    all: 'All',
    qr: 'QR',
    qr_node: 'Node QR code',
    qr_sub: 'Subscription QR code',
    qr_hint: 'Scan with your phone client to import',
    close: 'Close',
    qr_too_long: 'This link is too long to encode as a QR code',
    launch: 'Open in client',
    launch_title: 'One-click import to client',
    launch_hint: 'Nothing happened? The client is probably not installed — use the QR code or copy the URL instead',
    launch_open: 'Open',
    custom_title: 'Custom subscription (random)',
    custom_count: 'Node count',
    custom_format: 'Format',
    custom_proto: 'Protocol',
    custom_shuffle: 'Shuffle',
    custom_interval: 'Client update interval (hours)',
    custom_hint: 'With shuffle on, every pull returns a different batch; within the same minute the result is cached to protect the backend.',
    launch_note: 'After import the client keeps updating nodes from the subscription URL',
    open_client: 'Open',
    sort_quality: 'Quality',
    sort_latency: 'Lowest latency',
    sort_country: 'By country',
    sort_name: 'By name',
    sort_random: 'Random',
    th_name: 'Name',
    th_proto: 'Proto',
    th_server: 'Server',
    th_country: 'Country',
    th_net: 'Net',
    th_tls: 'TLS',
    th_latency: 'Latency',
    th_source: 'Source',
    th_copy: 'Share URI',
    th_proxy: 'Address',
    th_verified: 'State',
    yes: 'probed',
    no: 'raw',
    copy_uri: 'Copy',
    prev: 'Prev',
    next: 'Next',
    copy: 'Copy',
    copied: 'Copied',
    loading: 'Loading…',
    empty: 'No nodes matched',
    page: 'Page',
    page_of: 'of',
    rows: 'results',
    foot_sources: 'Data sources',
    foot_built: 'Powered by Cloudflare Workers · refreshed hourly',
    booting: 'Node data is being prepared, retrying automatically…',
    lang_label: '中',
  },
};

var state = { lang: 'zh', page: 0, pageSize: 50, total: 0, loading: false, launchShare: '', country: 'all' };

function t(key) {
  var d = I18N[state.lang] || I18N.zh;
  return d[key] !== undefined ? d[key] : key;
}

function applyI18n() {
  var nodes = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < nodes.length; i++) {
    var k = nodes[i].getAttribute('data-i18n');
    nodes[i].textContent = t(k);
  }
  var ph = document.querySelectorAll('[data-i18n-ph]');
  for (var j = 0; j < ph.length; j++) {
    ph[j].setAttribute('placeholder', t(ph[j].getAttribute('data-i18n-ph')));
  }
  var btn = document.getElementById('langBtn');
  if (btn) btn.textContent = t('lang_label');
  document.documentElement.setAttribute('lang', state.lang === 'zh' ? 'zh-CN' : 'en');
}

function setLang(lang) {
  state.lang = lang === 'en' ? 'en' : 'zh';
  try { localStorage.setItem('pl_lang', state.lang); } catch (e) {}
  applyI18n();
  if (countriesCache) renderCountryOptions();
  refreshUpdatedLabels();
}

function initLang() {
  var saved = null;
  try { saved = localStorage.getItem('pl_lang'); } catch (e) {}
  if (!saved) {
    var nav = (navigator.language || 'zh').toLowerCase();
    saved = nav.indexOf('zh') === 0 ? 'zh' : 'en';
  }
  state.lang = saved;
  var btn = document.getElementById('langBtn');
  if (btn) btn.addEventListener('click', function () { setLang(state.lang === 'zh' ? 'en' : 'zh'); });
  applyI18n();
}

function toast(msg) {
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show';
  setTimeout(function () { el.className = 'toast'; }, 1400);
}

function copyText(text) {
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    toast(t('copied'));
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { toast(t('copied')); }, fallback);
  } else {
    fallback();
  }
}

// ---------------- 二维码弹窗 ----------------
var qrText = '';

function openQr(text, title) {
  var modal = document.getElementById('qrModal');
  var holder = document.getElementById('qrHolder');
  var urlEl = document.getElementById('qrUrl');
  var titleEl = document.getElementById('qrTitle');
  if (!modal || !holder || !text) return;
  qrText = text;
  if (titleEl) titleEl.textContent = title || t('qr_node');
  if (urlEl) urlEl.textContent = text;
  holder.innerHTML = '';
  try {
    if (typeof qrcode === 'function') {
      var qr = qrcode(0, 'L');
      qr.addData(text);
      qr.make();
      holder.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 16, scalable: true });
    } else {
      holder.innerHTML = '<span class="muted">qr.js not loaded</span>';
    }
  } catch (e) {
    holder.innerHTML = '<span class="muted">' + t('qr_too_long') + '</span>';
  }
  modal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeQr() {
  var modal = document.getElementById('qrModal');
  if (modal) modal.hidden = true;
  document.body.classList.remove('modal-open');
}

// ---------------- 一键拉起客户端 ----------------
// 深链写法依据客户端官方文档：
//   clash://install-config?url=      Clash Verge / Mihomo / FlClash
//   v2rayng://install-config?url=    v2rayNG（Android，host 见 UrlSchemeActivity）
//   sing-box://import-remote-profile?url=  sing-box 系 GUI
//   shadowrocket://add/sub://<base64>      Shadowrocket（iOS）
//   hiddify://import/<url>                 Hiddify
function b64url(s) {
  var bytes = new TextEncoder().encode(s);
  var bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 自定义订阅：数量 / 格式 / 协议 / 随机分发
function customQuery() {
  var n = parseInt(val('cLimit'), 10);
  if (!isFinite(n) || n < 1) n = 50;
  if (n > 5000) n = 5000;
  var proto = val('cProto');
  var q = '/v1/proxies?verified=true&limit=' + n;
  var sh = document.getElementById('cShuffle');
  if (sh && sh.checked) q += '&shuffle=1';
  if (proto && proto !== 'all') q += '&protocol=' + encodeURIComponent(proto);
  var iv = parseInt(val('cInterval'), 10);
  if (isFinite(iv) && iv >= 1) q += '&interval=' + Math.min(iv, 168);
  return q;
}

function customUrl(format) {
  var fmt = format || val('cFormat') || 'base64';
  return location.origin + customQuery() + '&format=' + encodeURIComponent(fmt);
}

function refreshCustomUrl() {
  var input = document.getElementById('cUrl');
  if (input) input.value = customUrl();
}

function launchTargets(useCustom) {
  var clashUrl = useCustom ? customUrl('clash') : location.origin + '/v1/proxies?format=clash&verified=true&limit=500';
  var shareUrl = useCustom ? customUrl('base64') : location.origin + '/v1/proxies?format=base64&verified=true&limit=300';
  return [
    { name: 'Clash Verge / Mihomo / FlClash', link: 'clash://install-config?url=' + encodeURIComponent(clashUrl) },
    { name: 'sing-box (SFA / SFI / SFM)', link: 'sing-box://import-remote-profile?url=' + encodeURIComponent(shareUrl) },
    { name: 'Shadowrocket（iOS 小火箭）', link: 'shadowrocket://add/sub://' + b64url(shareUrl) },
    { name: 'v2rayNG（Android）', link: 'v2rayng://install-config?url=' + encodeURIComponent(shareUrl) },
    { name: 'Hiddify', link: 'hiddify://import/' + encodeURIComponent(shareUrl) },
  ];
}

function openLaunch(useCustom) {
  var modal = document.getElementById('launchModal');
  var list = document.getElementById('launchList');
  if (!modal || !list) return;
  state.launchShare = useCustom === true
    ? customUrl('base64')
    : location.origin + '/v1/proxies?format=base64&verified=true&limit=300';
  var targets = launchTargets(useCustom === true);
  var html = '';
  for (var i = 0; i < targets.length; i++) {
    html += '<a class="launch-item" href="' + esc(targets[i].link) + '">';
    html += '<span class="launch-name">' + esc(targets[i].name) + '</span>';
    html += '<span class="launch-go">' + t('launch_open') + '</span>';
    html += '</a>';
  }
  list.innerHTML = html;
  modal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeLaunch() {
  var modal = document.getElementById('launchModal');
  if (modal) modal.hidden = true;
  document.body.classList.remove('modal-open');
}

// ---------------- 国家/地区下拉 ----------------
var countriesCache = null;

// 旗帜用本地托管的 SVG 图片：Windows 的字体不渲染国旗 emoji，
// 原生 <select> 又塞不进 <img>，所以国家筛选做成了自定义下拉。
function ccToFlag(cc) {
  var s = String(cc || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(s)) return '';
  return String.fromCodePoint(0x1f1e6 + s.charCodeAt(0) - 65, 0x1f1e6 + s.charCodeAt(1) - 65);
}

function flagImg(cc) {
  var s = String(cc || '').toLowerCase();
  if (!/^[a-z]{2}$/.test(s)) return '';
  return '<img class="flag" src="/flags/' + s + '.svg" alt="' + esc(String(cc).toUpperCase()) + '"' +
    ' width="20" height="15" loading="lazy"' +
    " onerror=\"this.style.visibility='hidden'\">";
}

function updateCountryLabel() {
  var el = document.getElementById('countryLabel');
  if (!el) return;
  if (!state.country || state.country === 'all') {
    el.innerHTML = t('all');
    return;
  }
  el.innerHTML = flagImg(state.country) + ' ' + esc(state.country);
}

function closeCountryMenu() {
  var menu = document.getElementById('countryMenu');
  if (menu) menu.hidden = true;
}

function renderCountryOptions() {
  var menu = document.getElementById('countryMenu');
  if (!menu) return;
  var list = countriesCache || [];
  var html = '<button type="button" class="dropdown-item' + (state.country === 'all' ? ' active' : '') + '" data-cc="all">' + esc(t('all')) + '</button>';
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    html += '<button type="button" class="dropdown-item' + (state.country === c.cc ? ' active' : '') + '" data-cc="' + c.cc + '">';
    html += flagImg(c.cc);
    html += '<span class="dd-code">' + esc(c.cc) + '</span>';
    html += '<span class="dd-count">' + c.count + '</span>';
    html += '</button>';
  }
  menu.innerHTML = html;
  var items = menu.querySelectorAll('[data-cc]');
  for (var j = 0; j < items.length; j++) {
    items[j].addEventListener('click', function () {
      state.country = this.getAttribute('data-cc');
      updateCountryLabel();
      closeCountryMenu();
      state.page = 0;
      loadList();
    });
  }
  updateCountryLabel();
}

function loadCountries() {
  fetch('/v1/countries').then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.ok) return;
    countriesCache = d.data || [];
    renderCountryOptions();
  }).catch(function () {
    scheduleRetry('countries', loadCountries, 'countryBtn');
  });
}

function fmtLatency(ms) {
  if (!ms) return '—';
  return ms + 'ms';
}

// 延迟分档上色：≤150ms 绿、≤400ms 黄、更慢红
function latencyClass(ms) {
  if (!ms) return 'lat-none';
  if (ms <= 150) return 'lat-fast';
  if (ms <= 400) return 'lat-mid';
  return 'lat-slow';
}

// 多久之前：让"最近刷新"能一眼看出数据新旧
function fmtRelative(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  var diff = Date.now() - d.getTime();
  if (diff < 0) diff = 0;
  var min = Math.floor(diff / 60000);
  if (min < 1) return t('just_now');
  if (min < 60) return min + t('minutes_ago');
  var hr = Math.floor(min / 60);
  if (hr < 24) return hr + t('hours_ago');
  return Math.floor(hr / 24) + t('days_ago');
}

var lastUpdated = '';

function fmtUpdated(iso) {
  if (!iso) return '—';
  var rel = fmtRelative(iso);
  return fmtTime(iso) + (rel ? ' · ' + rel : '');
}

// 相对时间每分钟重算，页面对应元素随手更新
function refreshUpdatedLabels() {
  if (lastUpdated) {
    setText('stUpdated', fmtUpdated(lastUpdated));
    setText('sUpdated', fmtUpdated(lastUpdated));
  }
}

function fmtTime(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// 数据还没准备好时自动重试：最多 60 次，前 6 次每 5 秒，之后每 15 秒
var retryCount = { list: 0, stats: 0 };

function scheduleRetry(kind, fn, page) {
  if (retryCount[kind] >= 60) return;
  retryCount[kind]++;
  var wait = retryCount[kind] <= 6 ? 5000 : 15000;
  setTimeout(function () {
    if (page && !document.getElementById(page)) return;
    fn();
  }, wait);
}

function loadStats() {
  fetch('/v1/stats').then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.ok) {
      scheduleRetry('stats', loadStats, 'stTotal');
      return;
    }
    retryCount.stats = 0;
    setText('stTotal', d.total);
    setText('stVerified', d.verified);
    setText('stCountries', d.top_countries);
    lastUpdated = d.updated_at || '';
    setText('stUpdated', fmtUpdated(lastUpdated));
  }).catch(function () {
    scheduleRetry('stats', loadStats, 'stTotal');
  });
}

function setText(id, v) {
  var el = document.getElementById(id);
  if (el) el.textContent = v === undefined || v === null ? '—' : String(v);
}

function buildQuery() {
  var q = [];
  var search = val('fSearch');
  var proto = val('fProto');
  var country = state.country || 'all';
  var net = val('fNet');
  var tls = val('fTls');
  var source = val('fSource');
  var sort = val('fSort');
  if (search) q.push('q=' + encodeURIComponent(search));
  if (proto && proto !== 'all') q.push('protocol=' + encodeURIComponent(proto));
  if (country && country !== 'all') q.push('country=' + encodeURIComponent(country));
  if (net && net !== 'all') q.push('network=' + encodeURIComponent(net));
  if (tls && tls !== 'all') q.push('security=' + encodeURIComponent(tls));
  if (source && source !== 'all') q.push('source=' + encodeURIComponent(source));
  if (sort) q.push('sort=' + encodeURIComponent(sort));
  var ver = document.getElementById('fVerified');
  if (ver && ver.checked) q.push('verified=true');
  q.push('limit=' + state.pageSize);
  q.push('offset=' + state.page * state.pageSize);
  q.push('format=json');
  return q.join('&');
}

function val(id) {
  var el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function protoClass(p) {
  if (p === 'vless' || p === 'trojan') return 'tag s5';
  if (p === 'ss' || p === 'ssr') return 'tag s4';
  if (p === 'hysteria2' || p === 'tuic') return 'tag ok';
  return 'tag';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadList() {
  if (state.loading) return;
  state.loading = true;
  var tbody = document.getElementById('rows');
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="muted">' + t('loading') + '</td></tr>';
  fetch('/v1/proxies?' + buildQuery()).then(function (r) {
    if (r.status === 503) {
      state.loading = false;
      if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="muted">' + t('booting') + '</td></tr>';
      scheduleRetry('list', loadList, 'rows');
      return null;
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var total = r.headers.get('x-total-count');
    state.total = total ? Number(total) : 0;
    return r.json();
  }).then(function (d) {
    state.loading = false;
    if (!d) return;
    retryCount.list = 0;
    renderRows((d && d.data) || []);
  }).catch(function () {
    state.loading = false;
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="muted">' + t('booting') + '</td></tr>';
    scheduleRetry('list', loadList, 'rows');
  });
}

function renderRows(items) {
  var tbody = document.getElementById('rows');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="muted">' + t('empty') + '</td></tr>';
  } else {
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var r = items[i];
      var uri = r.uri || '';
      var server = (r.server || '') + ':' + (r.port || '');
      html += '<tr>';
      html += '<td class="copy-cell" data-copy="' + esc(uri) + '">' + esc(r.name || '—') + '</td>';
      html += '<td><span class="' + protoClass(r.protocol) + '">' + esc(r.protocol) + '</span></td>';
      html += '<td class="mono">' + esc(server) + '</td>';
      html += '<td class="mono country-cell">' + (r.country ? flagImg(r.country) + ' ' + esc(r.country) : '—') + '</td>';
      html += '<td class="mono">' + esc(r.network || '—') + '</td>';
      html += '<td class="mono">' + esc(r.security || '—') + '</td>';
      html += '<td class="mono ' + latencyClass(r.latency_ms) + '">' + fmtLatency(r.latency_ms) + '</td>';
      html += '<td class="muted">' + esc(r.source || '—') + '</td>';
      html += '<td class="row-actions">';
      html += '<button class="btn ghost" data-copy="' + esc(uri) + '">' + t('copy_uri') + '</button>';
      if (uri) {
        html += '<button class="btn ghost" data-qr="' + esc(uri) + '">' + t('qr') + '</button>';
        html += '<a class="btn ghost" href="' + esc(uri) + '">' + t('open_client') + '</a>';
      }
      html += '</td>';
      html += '</tr>';
    }
    tbody.innerHTML = html;
    var cells = tbody.querySelectorAll('[data-copy]');
    for (var j = 0; j < cells.length; j++) {
      cells[j].addEventListener('click', function () { copyText(this.getAttribute('data-copy')); });
    }
    var qrBtns = tbody.querySelectorAll('[data-qr]');
    for (var k = 0; k < qrBtns.length; k++) {
      qrBtns[k].addEventListener('click', function () { openQr(this.getAttribute('data-qr'), t('qr_node')); });
    }
  }
  var pages = Math.max(1, Math.ceil(state.total / state.pageSize));
  var info = document.getElementById('pageInfo');
  if (info) info.textContent = t('page') + ' ' + (state.page + 1) + ' / ' + pages + ' · ' + state.total + ' ' + t('rows');
  var prev = document.getElementById('prevBtn');
  var next = document.getElementById('nextBtn');
  if (prev) prev.disabled = state.page === 0;
  if (next) next.disabled = state.page + 1 >= pages;
}

function bindHome() {
  var apply = document.getElementById('applyBtn');
  if (apply) apply.addEventListener('click', function () { state.page = 0; loadList(); });
  var search = document.getElementById('fSearch');
  if (search) search.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { state.page = 0; loadList(); }
  });
  var reset = document.getElementById('resetBtn');
  if (reset) reset.addEventListener('click', function () {
    ['fSearch', 'fProto', 'fNet', 'fTls', 'fSource', 'fSort'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.tagName === 'SELECT') el.selectedIndex = 0; else if (el) el.value = '';
    });
    state.country = 'all';
    updateCountryLabel();
    var v = document.getElementById('fVerified');
    if (v) v.checked = false;
    state.page = 0;
    loadList();
  });
  var prev = document.getElementById('prevBtn');
  if (prev) prev.addEventListener('click', function () { if (state.page > 0) { state.page--; loadList(); } });
  var next = document.getElementById('nextBtn');
  if (next) next.addEventListener('click', function () { state.page++; loadList(); });

  var copies = document.querySelectorAll('[data-sub]');
  for (var i = 0; i < copies.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        copyText(location.origin + btn.getAttribute('data-sub'));
      });
    })(copies[i]);
  }

  var subQrs = document.querySelectorAll('[data-qr-sub]');
  for (var s = 0; s < subQrs.length; s++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        openQr(location.origin + btn.getAttribute('data-qr-sub'), t('qr_sub'));
      });
    })(subQrs[s]);
  }

  var countryBtn = document.getElementById('countryBtn');
  if (countryBtn) {
    countryBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var menu = document.getElementById('countryMenu');
      if (menu) menu.hidden = !menu.hidden;
    });
    document.addEventListener('click', function (e) {
      var dd = document.getElementById('countryDD');
      if (dd && !dd.contains(e.target)) closeCountryMenu();
    });
  }
  updateCountryLabel();

  var launches = document.querySelectorAll('[data-launch]');
  for (var L = 0; L < launches.length; L++) {
    launches[L].addEventListener('click', function () { openLaunch(false); });
  }

  var customInputs = ['cLimit', 'cFormat', 'cProto', 'cShuffle', 'cInterval'];
  for (var C = 0; C < customInputs.length; C++) {
    var el = document.getElementById(customInputs[C]);
    if (el) {
      el.addEventListener('change', refreshCustomUrl);
      el.addEventListener('input', refreshCustomUrl);
    }
  }
  var cCopy = document.getElementById('cCopy');
  if (cCopy) cCopy.addEventListener('click', function () {
    var input = document.getElementById('cUrl');
    if (input && input.value) copyText(input.value);
  });
  var cQr = document.getElementById('cQr');
  if (cQr) cQr.addEventListener('click', function () {
    var input = document.getElementById('cUrl');
    if (input && input.value) openQr(input.value, t('qr_sub'));
  });
  var cLaunch = document.getElementById('cLaunch');
  if (cLaunch) cLaunch.addEventListener('click', function () { openLaunch(true); });

  var modal = document.getElementById('qrModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeQr();
    });
  }
  var qrClose = document.getElementById('qrClose');
  if (qrClose) qrClose.addEventListener('click', closeQr);
  var qrDone = document.getElementById('qrDone');
  if (qrDone) qrDone.addEventListener('click', closeQr);
  var qrCopy = document.getElementById('qrCopy');
  if (qrCopy) qrCopy.addEventListener('click', function () { if (qrText) copyText(qrText); });

  var launchModal = document.getElementById('launchModal');
  if (launchModal) {
    launchModal.addEventListener('click', function (e) {
      if (e.target === launchModal) closeLaunch();
    });
  }
  var launchClose = document.getElementById('launchClose');
  if (launchClose) launchClose.addEventListener('click', closeLaunch);
  var launchDone = document.getElementById('launchDone');
  if (launchDone) launchDone.addEventListener('click', closeLaunch);
  var launchCopy = document.getElementById('launchCopy');
  if (launchCopy) {
    launchCopy.addEventListener('click', function () {
      if (state.launchShare) copyText(state.launchShare);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeQr(); closeLaunch(); }
  });

  var base = location.origin;
  var inputs = document.querySelectorAll('[data-url]');
  for (var k = 0; k < inputs.length; k++) {
    inputs[k].value = base + inputs[k].getAttribute('data-url');
  }

  loadStats();
  loadCountries();
  refreshCustomUrl();
  loadList();
}

document.addEventListener('DOMContentLoaded', function () {
  initLang();
  if (document.getElementById('rows')) bindHome();
  if (document.getElementById('srcRows')) loadStatsPage();
  // 「多久之前」每 30 秒重算；每 3 分钟重新拉一次统计，好让新同步的时间自动出现
  setInterval(refreshUpdatedLabels, 30000);
  setInterval(function () {
    if (document.hidden) return;
    if (document.getElementById('rows')) loadStats();
    if (document.getElementById('srcRows')) loadStatsPage();
  }, 180000);
});

function loadStatsPage() {
  fetch('/v1/stats').then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.ok) return;
    setText('sTotal', d.total);
    setText('sVerified', d.verified);
    setText('sCountries', d.top_countries);
    lastUpdated = d.updated_at || '';
    setText('sUpdated', fmtUpdated(lastUpdated));
    setText('sDuration', (d.duration_ms || 0) + ' ms');
    var protos = d.protocols || {};
    var keys = Object.keys(protos);
    var ph = '';
    for (var i = 0; i < keys.length; i++) {
      ph += '<tr><td class="mono">' + keys[i] + '</td><td class="mono">' + protos[keys[i]] + '</td></tr>';
    }
    var pt = document.getElementById('protoRows');
    if (pt) pt.innerHTML = ph || '<tr><td colspan="2" class="muted">—</td></tr>';

    var srcs = d.sources || [];
    var sh = '';
    for (var j = 0; j < srcs.length; j++) {
      var s = srcs[j];
      sh += '<tr>';
      sh += '<td class="mono">' + (s.name || s.id) + '</td>';
      sh += '<td><span class="tag">tier ' + (s.tier || '-') + '</span></td>';
      sh += '<td>' + (s.ok ? '<span class="tag ok">ok</span>' : '<span class="tag">fail</span>') + '</td>';
      sh += '<td class="mono">' + (s.count || 0) + '</td>';
      sh += '<td class="mono">' + (s.ms || 0) + ' ms</td>';
      sh += '<td class="muted">' + (s.error || '') + '</td>';
      sh += '</tr>';
    }
    var st = document.getElementById('srcRows');
    if (st) st.innerHTML = sh || '<tr><td colspan="6" class="muted">—</td></tr>';
  }).catch(function () {});
}
