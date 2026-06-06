<div align="center">

# α AlphaPicker

**把跨境选品当作一次产品投资决策。**
_Treat cross-border product selection as a product-investment decision._

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pg-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

</div>

AlphaPicker 是一个面向亚马逊 / 跨境卖家的**选品决策系统**。它不止于「打一个 78 分」，而是把每个 SKU 当作一笔可量化的投资：
**先建立卖家画像 → 据此智能推荐真实在售品 → 用决策算法逐个打分 → 给出可执行的进入 / 止损 / 预算策略。**

数据来自真实电商接口（**Sorftime / Amazon** 与 **eBay Browse API**），评分由一套带硬性门槛、TACOS 财务底座与 VOC 人机确认的算法驱动。

---

## ✨ 核心特性

- **🎯 机会决策算法 v2** — 摒弃伪精确的单一评分，改用
  `硬性门槛 → TACOS 财务底座 → 市场机会分 → 利润/风险/卖家适配三乘数 → VOC 人机确认 → 机会指数 → 决策 + 动态预案`。
  详见 [`docs/AlphaPicker-评估算法.pdf`](docs/AlphaPicker-%E8%AF%84%E4%BC%B0%E7%AE%97%E6%B3%95.pdf)。
- **👤 卖家画像优先** — 经验 / 月销规模 / 类目 / 风险偏好 / 预算 / 平台，直接驱动算法的门槛、风险容忍与卖家适配乘数。
- **🛒 画像驱动的智能推荐** — 系统据画像在你的类目内、按预算价位拉取真实在售品，逐个打分并按机会指数排序；「重新生成」每次换一批候选。
- **📊 三种评分结果页** — 同一份数据、三种讲法：经典评分卡（五维雷达）、投资沙盘（风险×回报象限）、决策驾驶舱（大表盘 + 数据流）。
- **🔬 深度分析** — 关键词结构（反查词 + CPC 分布 + 头部集中度）、ACOS 安全边际、**实时盈亏模拟器**（7 滑块）、三场景概率加权、决策报告。
- **🌐 跨平台参考** — 决策报告内嵌 eBay 在售行情（价格区间、中位价、与 Amazon 比价）。
- **💵 财务对齐** — 毛利率由真实 / 估算 COGS 反推，使「利润评分」与「盈亏模拟」共用同一成本基准、结论一致。

---

## 🧠 决策算法（简版）

```
① buildSellerPolicy(seller)          画像 → 目标净利率 / 需求门槛 / 风险容忍 / 测试预算占比
② calculateBlendedFinanceWithTacos   TACOS = ACOS×广告订单占比；TACOS 后净利率、安全边际、财务门槛
③ analyzeMarketOpportunity           需求分(月搜索) + 竞争分(Top3集中度) + 长尾空间 → 市场机会分
④ extractVocPainPointsWithAI         按品类聚类痛点（高/中/低）
⑤ collectSellerConfirmationForVoc    卖家确认「供应商可解决 / 无法解决」
⑥ calculateOpportunityIndex          硬门槛通过后：marketScore × 利润 × 风险 × 适配，夹到 100 后再 × VOC 系数
⑦ generateDecisionAndWarnings        决策等级 + 理由 + 预算策略 + 关键词策略 + 止损规则 + 竞品动态预案
```

> 设计原则：**不要让 AI 做客观判断，不要用伪精确分数包装不确定性。** 真正的壁垒是
> _真实利润底座 + 卖家适配策略 + 市场进入结构 + VOC 人机确认 + 竞品动态预案_。

实现见 `src/lib/alpha.ts`（纯函数，无 DB 依赖，前端可实时重算）。遗留的五维加权综合分仍并存于评分卡 / 仪表盘。

---

## 🛠 技术栈

| 层 | 选型 |
|---|---|
| 框架 | **Next.js 15**（App Router，Server Components 直连数据库，交互页用 Client Components） |
| 数据库 | **PostgreSQL**，驱动用 **`pg`**（单例 Pool，无 ORM） |
| 样式 | **Tailwind CSS v4**（中性 SaaS 设计令牌） |
| 数据源 | **Sorftime MCP**（Amazon 市场数据，JSON-RPC over HTTP）+ **eBay Browse API**（OAuth 应用令牌） |
| 语言 | **TypeScript** |

---

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
#   填入 DATABASE_URL、SORFTIME_KEY、EBAY_APPID/CERTID（详见 .env.example）

# 3. 启动 PostgreSQL（macOS / Homebrew 示例）
brew services start postgresql@16
createdb alphapicker          # 或按 .env.local 的连接串自建库 / 角色

# 4. 建表 + 灌入真实示例数据（从 eBay 实时拉取）
npm run db:reset              # = db:migrate + db:seed

# 5. 开发
npm run dev                  # http://localhost:3000
```

> 首次进入会引导你填写**卖家画像**，随后跳转到**智能推荐**。

---

## 🔑 环境变量

见 [`.env.example`](.env.example)。`.env.local` 已被 `.gitignore` 忽略，请勿提交任何密钥。

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串（`pg` 使用） |
| `SORFTIME_MCP_URL` / `SORFTIME_KEY` | Sorftime MCP（Amazon 数据）地址与密钥 |
| `EBAY_APPID` / `EBAY_CERTID` | eBay 应用凭据（client credentials → 应用 OAuth 令牌） |
| `EBAY_DEVID` / `EBAY_AUTHTOKEN` | eBay 传统 Auth'n'Auth（可选，Trading API） |
| `TIMEZONE` | 默认 `Asia/Shanghai` |

---

## 🗺 路由一览

| 页面 | 路由 |
|---|---|
| 卖家画像 Onboarding | `/onboarding` · `/profile` |
| 智能选品推荐 | `/recommend` |
| 我的选品 Dashboard | `/dashboard` |
| 产品数据录入 / 导入 | `/evaluations/new` |
| 评分结果页 ×3 | `/evaluations/[asin]/{score,sandbox,cockpit}` |
| 机会决策 | `/evaluations/[asin]/decision` |
| 深度分析 | `/evaluations/[asin]/{keywords,acos,simulator,scenarios,report}` |
| API | `/api/{seller,evaluations,import,search,ebay,recommend}` |

---

## 📂 项目结构

```
src/
├── app/                     # App Router 页面 + API 路由
│   ├── onboarding · profile · recommend · dashboard
│   ├── evaluations/[asin]/  # 评估详情（评分/沙盘/驾驶舱/决策/深度分析）
│   └── api/                 # seller · evaluations · import · search · ebay · recommend
├── components/              # AppShell · DecisionPanel · Simulator · 图表等
└── lib/
    ├── alpha.ts             # ★ 机会决策算法 v2（纯函数）
    ├── scoring.ts           # 遗留五维加权综合分
    ├── economics.ts         # 单位经济 / P&L / TACOS / 三场景
    ├── sorftime.ts          # Sorftime MCP 客户端（Amazon 数据）
    ├── ebay.ts              # eBay Browse API 客户端
    ├── importProduct.ts     # 导入 + 评分 + 落库（Amazon / eBay）
    ├── recommend.ts         # 画像驱动的推荐引擎
    ├── queries.ts · db.ts   # 数据访问 / pg 连接池
    └── types.ts · format.ts
db/                          # schema.sql · migrate.ts · seed.ts
docs/                        # 算法说明书（HTML / PDF）
```

---

## 📜 NPM Scripts

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器 |
| `npm run build` / `start` | 生产构建 / 启动 |
| `npm run db:migrate` | 应用 `db/schema.sql` |
| `npm run db:seed` | 从 eBay 实时拉取并灌入示例数据 |
| `npm run db:reset` | migrate + seed |

---

## ⚠️ 说明 / 限制

- **数据源配额**：Sorftime 密钥有套餐用量上限；超限时系统自动以 eBay 作为实时数据源回退。
- **采购成本**：供应商 COGS 不在公开接口内，未显式提供时按售价比例估算（毛利率由该成本反推，保证评分与盈亏一致）。
- **VOC 抽取**：当前为按品类的启发式占位，可替换为真实 LLM 对评论做 VOC 聚类。
- eBay 无搜索量 / CPC，相关字段以在售量、卖家集中度、标题关联词作为代理。

---

## 📄 License

[MIT](LICENSE)

<div align="center"><sub>Built with Next.js · PostgreSQL · TypeScript</sub></div>
