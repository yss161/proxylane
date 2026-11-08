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

var state = { lang: 'zh', page: 0, pageSize: 50, total: 0, loading: false };

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

function fmtLatency(ms) {
  if (!ms) return '—';
  return ms + 'ms';
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
    setText('stUpdated', fmtTime(d.updated_at));
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
  var country = val('fCountry');
  var net = val('fNet');
  var tls = val('fTls');
  var source = val('fSource');
  var sort = val('fSort');
  if (search) q.push('q=' + encodeURIComponent(search));
  if (proto && proto !== 'all') q.push('protocol=' + encodeURIComponent(proto));
  if (country) q.push('country=' + encodeURIComponent(country));
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
      html += '<td class="mono">' + esc(r.country || '—') + '</td>';
      html += '<td class="mono">' + esc(r.network || '—') + '</td>';
      html += '<td class="mono">' + esc(r.security || '—') + '</td>';
      html += '<td class="mono">' + fmtLatency(r.latency_ms) + '</td>';
      html += '<td class="muted">' + esc(r.source || '—') + '</td>';
      html += '<td><button class="btn ghost" data-copy="' + esc(uri) + '">' + t('copy_uri') + '</button></td>';
      html += '</tr>';
    }
    tbody.innerHTML = html;
    var cells = tbody.querySelectorAll('[data-copy]');
    for (var j = 0; j < cells.length; j++) {
      cells[j].addEventListener('click', function () { copyText(this.getAttribute('data-copy')); });
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
    ['fSearch', 'fProto', 'fCountry', 'fNet', 'fTls', 'fSource', 'fSort'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.tagName === 'SELECT') el.selectedIndex = 0; else if (el) el.value = '';
    });
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

  var base = location.origin;
  var inputs = document.querySelectorAll('[data-url]');
  for (var k = 0; k < inputs.length; k++) {
    inputs[k].value = base + inputs[k].getAttribute('data-url');
  }

  loadStats();
  loadList();
}

document.addEventListener('DOMContentLoaded', function () {
  initLang();
  if (document.getElementById('rows')) bindHome();
  if (document.getElementById('srcRows')) loadStatsPage();
});

function loadStatsPage() {
  fetch('/v1/stats').then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.ok) return;
    setText('sTotal', d.total);
    setText('sVerified', d.verified);
    setText('sCountries', d.top_countries);
    setText('sUpdated', fmtTime(d.updated_at));
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
