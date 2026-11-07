# 部署教程（Windows）

从零到上线，全程约 20 分钟。每一步都写了「做什么 / 命令 / 预期输出 / 失败了怎么办」。

---

## 你现在的状态（2026-11-07 实测）

| 检查项 | 状态 | 说明 |
|---|---|---|
| GitHub 仓库 | ✅ 已上线 | https://github.com/yss161/proxylane |
| Actions 工作流 | ⚠️ 在跑但全部失败 | 已自动跑了 3 次，每次都卡在写 KV |
| 抓取 + 探活 | ✅ 脚本可用 | 现已改为抓公开订阅（ss/vmess/vless/trojan）并做 TCP 探活 |
| KV namespace | ❌ 未创建 | wrangler.toml 里还是占位符 |
| GitHub Secrets | ❌ 一个都没有 | 这是失败的直接原因 |
| Worker | ❌ 未部署 | — |

**结论：只差下面 6 步。**

---

## 步骤 1 · 登录 Cloudflare

`%bash
cd C:/Users/LDX/Documents/code/jiedian
npm install
npx wrangler login
`%

**预期**：自动开浏览器 → 点 Allow → 终端显示 `Successfully logged in`。

**打不开浏览器时**（PowerShell 改用 API Token 认证）：

`%powershell
$env:CLOUDFLARE_API_TOKEN="你的token"
`%

token 权限需要 Workers Scripts:Edit + Workers KV Storage:Edit。

---

## 步骤 2 · 创建 KV namespace

`%bash
npx wrangler kv namespace create PROXY_KV
`%

**预期输出**（id 会是别的字符串）：

`%
🌀 Creating namespace with title "proxylane-PROXY_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "PROXY_KV", id = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6" }
`%

把 id 抄下来，后面要用两次。

> 也能在 Dashboard 建：Workers & Pages → KV → Create a namespace。

---

## 步骤 3 · 把 id 填进配置并推送

打开 wrangler.toml，替换占位符：

`%toml
[[kv_namespaces]]
binding = "PROXY_KV"
id = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"   # ← 换成你的
`%

`%bash
git add wrangler.toml
git commit -m "chore: 填入 KV namespace id"
git push
`%

---

## 步骤 4 · 创建 Cloudflare API Token

Actions 要往 KV 写数据，需要一个只有 Workers KV Storage: Edit 权限的 Token。

1. 打开 https://dash.cloudflare.com/profile/api-tokens
2. 点 **Create Token**
3. 滑到最下面选 **Create Custom Token**（别用模板，模板给的权限太多）
4. 填写：

   | 字段 | 值 |
   |---|---|
   | Token name | proxylane-kv-writer |
   | Permissions | **Account** · **Workers KV Storage** · **Edit** |
   | Account Resources | Include · 你的账号 |

5. **Continue to summary** → **Create Token**
6. Token 只显示一次，立刻复制（40 位左右）

**同时拿到 Account ID**（二选一）：
- 终端跑 `npx wrangler whoami`，输出里有 Account ID
- 或 Dashboard → Workers & Pages → 右侧栏 Account ID（32 位十六进制）

---

## 步骤 5 · 配置 3 个 GitHub Secret

### 方式 A：命令行（推荐）

`%bash
gh secret set CF_ACCOUNT_ID   --body "你的32位AccountID"  -R yss161/proxylane
gh secret set KV_NAMESPACE_ID --body "步骤2拿到的kv id"    -R yss161/proxylane
gh secret set CF_API_TOKEN    --body "步骤4拿到的token"    -R yss161/proxylane
`%

### 方式 B：网页

仓库 → Settings → Secrets and variables → Actions → **New repository secret**，逐个添加，名字必须一字不差：

| Name | Secret |
|---|---|
| CF_ACCOUNT_ID | 32 位 Account ID |
| CF_API_TOKEN | API Token |
| KV_NAMESPACE_ID | KV namespace id |

验证：

`%bash
gh secret list -R yss161/proxylane
# 应看到三行
`%

---

## 步骤 6 · 手动跑一次同步（灌数据）

`%bash
gh workflow run sync-kv -R yss161/proxylane
gh run watch -R yss161/proxylane
`%

**预期日志**：

`%
[1/3] 抓取源 …
[1/3] 抓到 22833 条，合并后 17341 条
[2/3] 真实探活（上限 4000 条，目标 1.1.1.1:443）…
[verify] 1177/4000 alive in 86954ms
[3/3] 最终可用 1177 条
[kv] wrote pool:v2 (xxxxx bytes)
[kv] wrote meta:v2 (xxx bytes)
done.
`%

约 2~3 分钟，探活 4000 条是最慢的一段。

---

## 步骤 7 · 部署 Worker

`%bash
npm run deploy
`%

**预期输出**：

`%
Uploaded proxylane (x.xx sec)
Deployed proxylane triggers
  https://proxylane.<你的子域>.workers.dev
  proxy.hanser.cv (custom domain)
`%

首次部署会自动为 proxy.hanser.cv 建 DNS 记录并签发证书（可能要 1~5 分钟）。

---

## 步骤 7B · 用 Dashboard「Continue with GitHub」部署（可选方式）

> 适合不想用命令行的人。效果和 `npm run deploy` 完全一样，额外好处是
> **之后每次 push 到 main 会自动重新部署**。
>
> ⚠️ **前提**：`wrangler.toml` 里的 KV id 必须已经是真实值，否则第一次构建必失败
> （报 `KV namespace "REPLACE_WITH_YOUR_KV_NAMESPACE_ID" not found`）。
> 还没建 KV 的，先回到步骤 2 和 3。

进入 Workers & Pages → **创建应用**，然后：

### 1. 选入口

点 **Continue with GitHub**。

- ❌ 不要选「从 Hello World! 开始」「选择模板」「Upload your static files」
- 尤其 **不要选 Upload your static files** —— 那会建一个纯静态站点，本项目所有 `/v1/*` API 全部失效
  （页面是由 Worker 的 `[assets]` 托管的，必须走 Worker）

### 2. 授权并选仓库

- 首次会跳转 GitHub 授权，点 **Install & Authorize**，可以只授权 `proxylane` 这一个仓库
- 回来选仓库：`yss161/proxylane`
- 分支：`main`

### 3. 构建配置（关键，照抄）

| 字段 | 填什么 | 说明 |
|---|---|---|
| 项目名称 / Worker name | `proxylane` | **必须和 wrangler.toml 里的 name 完全一致**，否则会部署到另一个 Worker |
| 生产分支 | `main` | |
| 根目录 / Root directory | 留空 | 仓库根目录 |
| 构建命令 / Build command | `npm install` | 或直接留空；**不要**填 `npm run build`（本项目没有 build 脚本） |
| 部署命令 / Deploy command | `npx wrangler deploy` | 默认值就是这个 |

环境变量/Secrets 这一栏**不用加任何东西** —— 项目的变量都在 `wrangler.toml` 的 `[vars]` 里。

### 4. 看首次构建

点 **Deploy**，等 1~3 分钟。成功日志大致是：

%%%
Installing dependencies... npm install
Cloning repository...
Running deploy command: npx wrangler deploy
Uploaded proxylane (x.xx sec)
Deployed proxylane triggers
  https://proxylane.<子域>.workers.dev
  proxy.hanser.cv (custom domain)
Success: Build completed
%%%

失败时的对照：

| 构建日志里的报错 | 原因 | 解决 |
|---|---|---|
| `KV namespace "..." not found` | `wrangler.toml` 的 id 还是占位符 | 步骤 2、3 |
| `npm run build` not found | 构建命令填成了 `npm run build` | 改成 `npm install` 或留空 |
| `Missing entry-point` / 找不到 src/index.js | 根目录设错了 | 根目录留空 |
| `hostname already in use` / `zone not found` | `proxy.hanser.cv` 已被占用，或 zone 不在本账号 | 见下面第 5 点 |

### 5. 绑定自定义域名

`wrangler.toml` 里已有 `[[routes]]`，首次部署会自动尝试绑定。部署完去
**Workers & Pages → proxylane → Settings → Domains & Routes** 确认能看到 `proxy.hanser.cv`。

如果没绑上（或报 hostname 冲突），在这里手动加：

**Add → Custom domain → 输入 `proxy.hanser.cv` → Add domain**，然后等状态变成 **Active**（1~5 分钟签证书）。

---

## 步骤 8 · 验证上线

`%bash
curl https://proxy.hanser.cv/v1/health
curl https://proxy.hanser.cv/v1/stats
curl "https://proxy.hanser.cv/v1/all.txt?limit=10"
curl "https://proxy.hanser.cv/v1/proxies?q=vless&format=json&limit=5"
curl "https://proxy.hanser.cv/v1/proxies?format=clash&verified=true&limit=5"
`%

浏览器打开 https://proxy.hanser.cv ，应该看到：
- 顶部 4 个统计卡片有数字（不是 —）
- 4 张订阅卡片，点「复制」能拿到完整 URL
- 下方节点搜索列表有数据，点名称或「复制」能拿到分享链接
- 右上角 EN 按钮能切中英文

---

## 步骤 9 · 客户端导入

### Clash Verge / Mihomo / Stash

配置 → 新建 → 类型 **Remote** → URL：

`%
https://proxy.hanser.cv/v1/proxies?format=clash&verified=true&limit=500
`%

### Shadowrocket（小火箭）

首页右上 **+** → 类型 **Subscribe** → URL：

`%
https://proxy.hanser.cv/v1/proxies?format=base64&verified=true&limit=300
`%


### v2rayN / NekoBox

订阅 → 添加 → 地址：

`%
https://proxy.hanser.cv/v1/proxies?format=base64&verified=true&limit=300
`%

### sing-box

把 format=singbox 的输出内容粘进 outbounds 数组。

---

## 步骤 10 · 日常运维

### 刷新频率

在 .github/workflows/sync.yml 的 `cron: '7,37 * * * *'`。

⚠️ **实测提醒**：GitHub 会限流低活跃度仓库的定时任务。你配的是 30 分钟，
但实际观测间隔是 **4~6 小时**（20:03 → 00:04 → 05:47）。两条路：

1. **接受现状**：公开节点寿命本身也就几小时，4 小时一次够用；
2. **外部定时器**：用 https://cron-job.org 每 30 分钟打一次 GitHub API：

`%
POST https://api.github.com/repos/yss161/proxylane/actions/workflows/sync.yml/dispatches
Authorization: Bearer <fine-grained PAT，权限 Actions: write>
Body: {"ref":"main"}
`%

### 查日志

`%bash
gh run list -R yss161/proxylane -L 10
gh run view <run-id> -R yss161/proxylane --log
npx wrangler tail          # Worker 实时日志
`%

### 改数据源 / 探活规模

- 数据源：改 src/core.js 的 DEFAULT_SOURCES
- 探活条数：改 sync.yml 的 VERIFY_LIMIT（默认 4000）

---

## 排错表

| 现象 | 原因 | 解决 |
|---|---|---|
| Actions 报 缺少 CF_ACCOUNT_ID / CF_API_TOKEN / KV_NAMESPACE_ID | Secrets 没配 | 步骤 5 |
| Actions 报 KV PUT pool:v2 -> 403 | Token 权限不对 / 账号没选对 | 重建 Token：Account · Workers KV Storage · Edit |
| Actions 报 KV PUT pool:v2 -> 404 | KV_NAMESPACE_ID 填错 | npx wrangler kv namespace list 核对 |
| deploy 报 KV namespace not found | wrangler.toml 里 id 还是占位符 | 步骤 3 |
| 站点 503 pool_empty | KV 没数据 | 跑一次步骤 6 |
| 自定义域名 522 / SSL 错 | 证书未签发完，或 NS 不在该账号 | 等 5 分钟；看 zone 是否 Active |
| Worker exceeded CPU time limit | NO_SELF_REFRESH 被改成 0 | 改回 "1" |
| 探活成功数 < 300 | 节点质量波动，或机房 IP 被拒 | 调大 VERIFY_LIMIT |
| 定时任务不跑 | 仓库 60 天无提交被禁用 | 已内置每月 1 号心跳提交 |

---

## 安全提醒

- **API Token 不要写进任何提交的文件**，只放 GitHub Secrets。
- wrangler.toml 里的 KV namespace **id 可以公开**（只是标识符，没有它拿不到写权限）。
- 想撤销写权限：Dashboard → API Tokens → 删除该 Token。KV 里的旧数据会保留，但不再更新。
