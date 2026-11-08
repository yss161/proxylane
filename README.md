# ProxyLane

[![sync-kv](https://github.com/yss161/proxylane/actions/workflows/sync.yml/badge.svg)](https://github.com/yss161/proxylane/actions/workflows/sync.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

公开翻墙节点搜索服务，跑在 **Cloudflare Workers 免费版**上。

- **数据管线**：GitHub Actions 每 30 分钟抓取公开订阅 → 解析 **ss / ssr / vmess / vless / trojan / hysteria2 / tuic** 分享链接 → 去重合并 → **TCP 端口探活** → 写入 Cloudflare KV
- **对外服务**：Worker 只读 KV，支持关键词搜索，输出 **TXT / JSON / CSV / Clash / Base64 / Surge / sing-box** 七种格式
- **仓库**：https://github.com/yss161/proxylane
- **站点**：`https://proxy.hanser.cv`（备用 `https://proxylane.<子域>.workers.dev`）

> 为什么拆成两段？免费版 Worker 每次调用 CPU 上限只有 **10ms**，
> 而一次全量刷新（2.2 万条，解析+去重+排序）实测要几百毫秒，必然超限。
> 把重活放 Actions，Worker 只做"读 KV + 拼字符串"，免费版毫无压力。
> 公开仓库的 Actions 分钟数不设上限，所以这套是完全免费的。

---

## 架构

```
   GitHub Actions (每 30 分钟, 公开仓库免费无限分钟)
   ├─ fetch 公开订阅 ──► 解析分享链接 ──► 去重合并 ──► TCP 探活
   │                                                    │
   │                              PUT KV API            ▼
   └───────────────────────────────► Cloudflare KV ──────────┐
                                        (pool:v2 / meta:v2)  │
                                                             ▼
   客户端 ◄── Worker (读 KV + Cache API) ◄── proxy.hanser.cv
              ├─ /            首页（统计 / 订阅卡片 / 节点搜索）
              ├─ /docs        接口文档
              ├─ /stats       源健康状态
              └─ /v1/*        JSON / TXT / Clash / Base64 / Surge / sing-box
```

---

## 已定的配置

| 项 | 值 | 在哪改 |
|---|---|---|
| 仓库 | 公开（PUBLIC） | — |
| Worker 名 | `proxylane` | `wrangler.toml` → `name` |
| 自定义域名 | `proxy.hanser.cv` | `wrangler.toml` → `[[routes]]` |
| workers.dev 备用 | 保留 | `wrangler.toml` → `workers_dev = true` |
| 刷新方式 | Actions 每 30 分钟写 KV | `.github/workflows/sync.yml` → `cron` |
| Worker 侧 cron | **已关闭**（`NO_SELF_REFRESH = "1"`） | `wrangler.toml` |
| 页面语言 | 中英双语，跟随浏览器，可手动切换 | `public/app.js` → `I18N` |
| 框架 | 零依赖原生 JS，**无构建步骤** | — |

### 关于"用变量控制自定义域名"

- **域名绑定本身没法变量化**：`routes` / `custom_domain` 是部署时由 Cloudflare API 解析的字段，不可能来自运行时 `[vars]`。
- **周边全都变量化了**：`SITE_DOMAIN` 控制页面标题、文档示例、`/v1/config`；前端订阅链接用 `location.origin` 生成，换域名零改代码。
- 只想留 workers.dev：把 `[[routes]]` 两行注释掉重新部署。

---

## 部署步骤

> 📘 **完整步骤、排错表、客户端导入说明见 [DEPLOY.md](DEPLOY.md)**

### 0. 前置

- Cloudflare 账号，`hanser.cv` 已托管在同一账号且 NS 生效
- Node.js ≥ 18
- GitHub 仓库已建好并推上去

```bash
npm install
```

### 1. 创建 KV namespace（**必做**）

```bash
npx wrangler login
npx wrangler kv namespace create PROXY_KV
```

把输出的 `id` 填进 `wrangler.toml` 的 `[[kv_namespaces]]`，同时**记下它**——第 3 步要当 secret 用。

### 2. 部署 Worker

```bash
npm run deploy
```

此时打开站点会看到 "KV 为空" 的提示，正常，下一步灌数据。

> 或者在 Cloudflare Dashboard → Workers & Pages → 连接 Git 仓库做自动部署：
> **构建命令留空**（本项目无构建步骤），**部署命令 `npx wrangler deploy`**，分支 `main`。
> ⚠️ Workers Builds 不会帮你建 KV、也不会自动绑域名，这两步要手动做一次。

### 3. 配 GitHub Secrets

Settings → Secrets and variables → Actions，加三个：

| Secret | 从哪来 |
|---|---|
| `CF_ACCOUNT_ID` | Cloudflare Dashboard 右下角 Account ID，或 `npx wrangler whoami` |
| `CF_API_TOKEN` | My Profile → API Tokens → Create Token → 自定义，权限只要 **Workers KV Storage: Edit**（可以限定到你的账号） |
| `KV_NAMESPACE_ID` | 第 1 步拿到的 namespace id |

### 4. 手动跑一次

Actions → **sync-kv** → Run workflow。

约 2~5 分钟跑完（4000 条探活），然后刷新站点就有数据了。之后每 30 分钟自动更新。

---

## 接口速查

| 端点 | 说明 |
|---|---|
| `GET /v1/proxies` | 主接口：关键词搜索 + 全部筛选参数 + 7 种格式 |
| `GET /v1/all.txt` `/v1/ss.txt` `/v1/vmess.txt` `/v1/vless.txt` `/v1/trojan.txt` `/v1/hysteria2.txt` | 纯文本分享链接 |
| `GET /v1/random` | 随机一条（`?format=json` 返回结构化） |
| `GET /v1/stats` | 总量 / 协议分布 / 国家清单 / 来源健康 |
| `GET /v1/countries` | 国家/地区清单及节点数（前端下拉框用） |
| `GET /v1/sources` | 源清单 + 最近一次抓取结果 |
| `GET /v1/config` | 站点配置 / 支持格式 / 参数表 |
| `GET /v1/health` | 存活探针 |

**参数**：`q` `format` `protocol` `country` `network` `security` `source` `max_latency` `verified` `sort` `limit` `offset`

**客户端对照**：

| 客户端 | 订阅地址 |
|---|---|
| Clash Verge / Mihomo / Stash | `/v1/proxies?format=clash&verified=true&limit=500` |
| Shadowrocket（小火箭） | `/v1/proxies?format=base64&verified=true&limit=300` |
| v2rayN / NekoBox | `/v1/proxies?format=base64&verified=true&limit=300` |
| sing-box | `/v1/proxies?format=singbox&verified=true&limit=300` |
| Surge | `/v1/proxies?format=surge&verified=true&limit=200` |
| 自建脚本 | `/v1/all.txt` |

**页面上的导入方式**：每个订阅卡片都能出「二维码」扫码导入，或点「导入客户端」一键拉起 Clash Verge / Mihomo / sing-box / Shadowrocket / v2rayNG / Hiddify；
列表里每条节点也能单独复制、出二维码、或直接点「打开」交给系统里的客户端处理。

**搜索示例**：

```bash
# 美国 Reality 节点
/v1/proxies?q=US&protocol=vless&security=reality&limit=50

# 只要 Trojan
/v1/proxies?protocol=trojan&format=base64
```

---

## 数据源

| 源 | tier | 内容 |
|---|---|---|
| `mahdibland/V2RayAggregator` | 1 | 大量 ss / vmess / vless / trojan 合并订阅 |
| `peasoft/NoMoreWalls` | 1 | vmess / vless / hysteria2 等 |
| `free18/v2ray` | 2 | 每日更新的 base64 订阅 |
| `Pawdroid/Free-servers` | 2 | 小而精的免费节点 |
| `ripaojiedian/freenode` | 2 | 公开节点订阅 |

增删源：改 `src/core.js` 的 `DEFAULT_SOURCES`（Actions 用的是它），或 `wrangler.toml` 的 `SOURCES`（Worker 侧）。

公开节点水分很大。Actions 只把 **TCP 端口探活通过** 的条目写入 KV（`verified=true`），首页默认也只展示这些。

---

## 免费额度核算

| 资源 | 用量 | 免费上限 |
|---|---|---|
| Actions 分钟 | 每 30 分钟 × ~3 分钟 ≈ 4,300 分钟/月 | **公开仓库无限** |
| KV 写 | 2 次 × 48 次/天 ≈ **96/天** | 1,000/天 |
| KV 读 | 请求数（Cache API 命中时不读） | 100,000/天 |
| Worker 请求 | 访问量 | 100,000/天 |
| Worker CPU | 仅读 KV + 拼字符串，< 5ms | 10ms/次 |

结论：**完全在免费额度内**。

---

## 两个需要留意的运维点

1. **60 天无 commit 会被 GitHub 禁用定时任务**。
   已内置规避：sync 工作流每月 1 号提交一个 `.github/keepalive.txt` 心跳文件，保证仓库始终有提交。
2. **GitHub cron 是 best-effort**，高峰期可能延迟 5~15 分钟，且整点附近容易排队，
   所以刻意用了 `:07` 和 `:37` 这种非整点分钟。

---

## 想以后升级到 Workers Paid 怎么办

改两处即可让 Worker 自己抓，不再依赖 Actions：

```toml
# wrangler.toml
[triggers]
crons = ["7 * * * *"]

[vars]
NO_SELF_REFRESH = "0"
```

Actions 那边可以保留（它会覆盖 KV，相当于更强的真实探活），也可以直接停用。

---

## 目录结构

```
.
├── wrangler.toml            # name / routes / assets / KV / vars（cron 已注释）
├── src/
│   ├── core.js              # 源定义、分享链接解析、去重合并、评分、KV 序列化
│   ├── format.js            # 7 种输出格式（Clash / sing-box 等）
│   └── index.js             # Worker 路由 / 搜索过滤 / 缓存
├── public/
│   ├── index.html           # 首页：统计 + 订阅卡片 + 节点搜索
│   ├── docs.html            # 接口文档
│   ├── stats.html           # 运行状态（源健康）
│   ├── app.js               # 双语 + 列表渲染 + 复制
│   └── style.css            # 暗色主题
├── scripts/
│   ├── sync.mjs             # Actions：抓取 + 真实探活 + 回写 KV
│   └── test-local.mjs       # 本地裸跑 Worker 的端到端测试
└── .github/workflows/
    ├── sync.yml             # 主路径：每 30 分钟同步
    └── deploy.yml           # 手动部署（可选，默认不与 Builds 冲突）
```

---

## 本地开发与测试

```bash
npm run dev          # wrangler dev，本地起 Worker（KV 是空的，页面会提示）
node scripts/test-parse.mjs   # 离线解析器单测
node scripts/test-local.mjs   # 端到端测试（会真实抓订阅）
npm run sync:dry     # 只跑抓取+TCP 探活，结果写 ./out/，不碰 KV
```

`test-local.mjs` 用 curl 代理 `fetch`、给 KV / caches / ASSETS 打桩，裸跑真实 Worker 代码。

---

## 免责

本服务只**聚合互联网上公开可得的节点分享链接**，不提供也不中继任何流量。
公开节点未经审计，可能被记录、篡改或注入内容——**不要通过它们登录账号、传输密码或令牌**。
仅供学习、测试与网络研究。请遵守你所在地区的法律法规。

数据来源：[V2RayAggregator](https://github.com/mahdibland/V2RayAggregator) ·
[NoMoreWalls](https://github.com/peasoft/NoMoreWalls) ·
[free18](https://github.com/free18/v2ray) ·
[Pawdroid](https://github.com/Pawdroid/Free-servers) ·
[ripaojiedian](https://github.com/ripaojiedian/freenode)

MIT License
