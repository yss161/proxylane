// src/auth.js
// 简单的全站口令保护：页面 + /v1/* 全部走这道门。
// 配置方式：在 Cloudflare Dashboard 给 Worker 加一个 Secret：ACCESS_TOKEN
//           （不要写进 wrangler.toml —— 仓库是公开的）
// 未配置 ACCESS_TOKEN 时，全站公开（保持原有行为）。

const COOKIE = 'pl_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

export function authEnabled(env) {
  return Boolean(env && env.ACCESS_TOKEN);
}

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  const parts = raw.split(';');
  for (let i = 0; i < parts.length; i++) {
    const kv = parts[i].trim();
    if (kv.indexOf(name + '=') === 0) return decodeURIComponent(kv.slice(name.length + 1));
  }
  return '';
}

export function tokenFromRequest(request, url) {
  const header = request.headers.get('x-access-token');
  if (header) return header.trim();
  const q = url.searchParams.get('token');
  if (q) return q.trim();
  const c = readCookie(request, COOKIE);
  if (c) return c;
  const bearer = request.headers.get('authorization') || '';
  if (bearer.toLowerCase().indexOf('bearer ') === 0) return bearer.slice(7).trim();
  return '';
}

export function isAuthed(request, env, url) {
  if (!authEnabled(env)) return true;
  return tokenFromRequest(request, url) === String(env.ACCESS_TOKEN);
}

function cookieHeader(value, maxAge) {
  return 'pl_token=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + maxAge + '; SameSite=Lax; Secure';
}

// 登录页：内联样式，不依赖 /style.css（静态资源同样受保护）
export function loginPage(error) {
  const msg = error ? '<p class="err">口令不正确</p>' : '';
  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n'
    + '<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />\n'
    + '<title>ProxyLane · 需要口令</title>\n'
    + '<style>'
    + 'html,body{margin:0;height:100%;background:#0b0f14;color:#e6edf6;'
    + 'font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}'
    + '.box{max-width:360px;margin:14vh auto;padding:26px;background:#121821;'
    + 'border:1px solid #212c3d;border-radius:12px}'
    + 'h1{font-size:17px;margin:0 0 6px}p.sub{color:#8b9bb4;font-size:12px;margin:0 0 18px}'
    + 'input{width:100%;box-sizing:border-box;background:#0a0e13;color:#e6edf6;'
    + 'border:1px solid #212c3d;border-radius:8px;padding:10px 12px;font-size:14px;margin-bottom:12px}'
    + 'button{width:100%;background:#3ea6ff;color:#06121f;border:0;border-radius:8px;'
    + 'padding:10px;font-size:14px;font-weight:600;cursor:pointer}'
    + 'p.err{color:#ff7b72;font-size:12px;margin:0 0 12px}'
    + '.hint{color:#5f6e85;font-size:11px;margin-top:14px;text-align:center}'
    + '</style>\n</head>\n<body>\n<div class="box">\n'
    + '<h1>ProxyLane</h1>\n<p class="sub">Private instance · 请输入访问口令</p>\n'
    + msg
    + '<form method="POST" action="/__auth">'
    + '<input type="password" name="p" placeholder="访问口令" autofocus autocomplete="current-password" />'
    + '<button type="submit">进入</button>'
    + '</form>\n'
    + '<div class="hint">口令错误或未设置请检查 Worker 的 ACCESS_TOKEN</div>\n'
    + '</div>\n</body>\n</html>\n';
}

// 处理 /__auth（POST 登录）与 /__logout
export async function handleAuthRoutes(request, env, url) {
  if (url.pathname === '/__auth') {
    if (request.method !== 'POST') {
      return new Response(loginPage(false), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    let submitted = '';
    try {
      const form = await request.formData();
      submitted = String(form.get('p') || '');
    } catch (e) {
      submitted = '';
    }
    if (authEnabled(env) && submitted === String(env.ACCESS_TOKEN)) {
      return new Response(null, {
        status: 303,
        headers: { location: '/', 'set-cookie': cookieHeader(submitted, COOKIE_MAX_AGE), 'cache-control': 'no-store' },
      });
    }
    return new Response(loginPage(true), { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  if (url.pathname === '/__logout') {
    return new Response('ok', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'set-cookie': cookieHeader('', 0), 'cache-control': 'no-store' },
    });
  }

  return null;
}

export function unauthorizedResponse(isApi) {
  if (isApi) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized', hint: 'need ?token= or X-Access-Token header' }, null, 2) + '\n', {
      status: 401,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'www-authenticate': 'Bearer',
        'cache-control': 'no-store',
      },
    });
  }
  return new Response(loginPage(false), {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
