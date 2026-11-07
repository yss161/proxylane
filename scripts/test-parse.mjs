// scripts/test-parse.mjs — 离线解析器单测
import { parseUri, parseSubscription, extractCC, mergeRecords, packRecords, unpackRecords } from '../src/core.js';
import { render } from '../src/format.js';

const src = { id: 'test', verified: false };

function assert(cond, msg) {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) process.exitCode = 1;
}

const ss = parseUri('ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ=@1.2.3.4:8388#US-node', src);
assert(ss && ss.proto === 'ss' && ss.host === '1.2.3.4' && ss.port === 8388 && ss.cc === 'US' && ss.extra.method === 'aes-256-gcm', 'parse ss SIP002');

const vmessJson = Buffer.from(JSON.stringify({
  v: '2', ps: '🇯🇵JP-ws', add: 'jp.example.com', port: 443, id: '11111111-1111-1111-1111-111111111111',
  aid: 0, scy: 'auto', net: 'ws', type: 'none', tls: 'tls', path: '/v', host: 'jp.example.com', sni: 'jp.example.com',
})).toString('base64');
const vm = parseUri('vmess://' + vmessJson, src);
assert(vm && vm.proto === 'vmess' && vm.host === 'jp.example.com' && vm.port === 443 && vm.net === 'ws' && vm.tls === 'tls' && vm.cc === 'JP', 'parse vmess json');

const vless = parseUri('vless://4054fdc2-ee80-4419-8a8e-d937df4719e2@qq.utiltools.site:443?security=reality&encryption=none&pbk=abc&type=tcp&sni=qq.utiltools.site#US+V2CROSS', src);
assert(vless && vless.proto === 'vless' && vless.tls === 'reality' && vless.extra.pbk === 'abc' && vless.cc === 'US', 'parse vless reality');

const trojan = parseUri('trojan://secret@108.61.170.10:443?sni=www.example.com#DE-trojan', src);
assert(trojan && trojan.proto === 'trojan' && trojan.host === '108.61.170.10' && trojan.tls === 'tls' && trojan.cc === 'DE', 'parse trojan');

const hy2 = parseUri('hysteria2://pwd@1.1.1.1:443?sni=www.google.com&insecure=1#HY2-US', src);
assert(hy2 && hy2.proto === 'hysteria2' && hy2.extra.insecure === true && hy2.cc === 'US', 'parse hysteria2');

const anytls = parseUri('anytls://2f4c3fc5-8fa2-4576-a583-8f98a6026887@tw.ccwink.cc:6549/?insecure=1&sni=baidu.com#HiNet', src);
assert(anytls && anytls.proto === 'anytls' && anytls.host === 'tw.ccwink.cc' && anytls.port === 6549 && anytls.extra.sni === 'baidu.com', 'parse anytls trailing slash');

assert(extractCC('🇺🇸US-45.86.51.18') === 'US', 'extract flag cc');
assert(extractCC('HongKong-HK-01') === 'HK', 'extract token cc');

const b64 = Buffer.from('ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ=@8.8.8.8:8388#x\nvless://u@9.9.9.9:443?security=tls#y\n').toString('base64');
const list = parseSubscription(b64, src);
assert(list.length === 2 && list[0].proto === 'ss' && list[1].proto === 'vless', 'decode base64 subscription');

const packed = packRecords(list);
const unpacked = unpackRecords(packed);
assert(unpacked.length === 2 && unpacked[0].uri.indexOf('ss://') === 0 && unpacked[1].extra.uuid === undefined || unpacked[1].uri.indexOf('vless://') === 0, 'pack/unpack roundtrip');

const clash = render('clash', list, {});
assert(clash.body.indexOf('proxies:') >= 0 && clash.body.indexOf('type: ss') >= 0, 'clash render ss');
const txt = render('txt', list, {});
assert(txt.body.indexOf('ss://') === 0, 'txt render uri');
const json = JSON.parse(render('json', list, { total: 2 }).body);
assert(json.data[0].server === '8.8.8.8' && json.data[0].uri.indexOf('ss://') === 0, 'json item shape');

const merged = mergeRecords(list.concat(list));
assert(merged.length === 2, 'merge by uri key');

console.log('\nDONE. exitCode =', process.exitCode || 0);
