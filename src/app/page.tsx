import Image from "next/image";
import Link from "next/link";

const metrics = [
  { label: "五维评分", value: "需求 · 竞争 · 利润 · 差异化 · 风险" },
  { label: "真实数据", value: "Sorftime MCP + eBay Browse API" },
  { label: "决策输出", value: "推荐 / 观望 / 不建议" },
];

const workflow = [
  {
    step: "01",
    title: "导入候选 SKU",
    copy:
      "用关键词或 ASIN 拉取价格、FBA、类目排名、关键词和跨平台价格参考；可补录采购与头程成本。",
  },
  {
    step: "02",
    title: "校准卖家画像",
    copy:
      "经验、预算、风险偏好和平台组合会改变评分权重，让同一个产品对不同卖家的结论不同。",
  },
  {
    step: "03",
    title: "跑通投资模型",
    copy:
      "统一计算综合分、ACOS 安全边际、月净利、资金需求、回本周期和三场景期望。",
  },
  {
    step: "04",
    title: "生成行动报告",
    copy:
      "输出进入策略、首批建议、止损规则和关键词打法，减少靠感觉拍板的选品决策。",
  },
];

const modules = [
  "真实数据导入",
  "机会指数驾驶舱",
  "关键词结构分析",
  "ACOS 安全边际",
  "盈亏模拟器",
  "三场景模拟",
  "决策报告",
  "eBay 跨平台参考",
];

const signals = [
  { label: "月搜索", value: "18,600", tone: "text-green" },
  { label: "Top3 集中度", value: "42%", tone: "text-orange" },
  { label: "ACOS 边际", value: "+8.4pt", tone: "text-green" },
  { label: "月净利", value: "¥24.8k", tone: "text-blue" },
];

function BrandMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue/20 bg-blue-soft text-[14px] font-bold text-blue">
      AP
    </div>
  );
}

function ArrowIcon() {
  return (
    <span aria-hidden className="font-mono text-[15px]">
      -&gt;
    </span>
  );
}

function SectionIntro({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="text-[13px] font-semibold text-blue">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-semibold leading-tight text-ink md:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-[16px] leading-7 text-muted">{copy}</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-panel/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <div className="truncate text-[17px] font-semibold">AlphaPicker</div>
              <div className="hidden text-[12px] text-muted sm:block">
                跨境选品投资决策系统
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-[14px] text-muted md:flex">
            <a className="transition hover:text-ink" href="#workflow">
              流程
            </a>
            <a className="transition hover:text-ink" href="#model">
              模型
            </a>
            <a className="transition hover:text-ink" href="#data">
              数据源
            </a>
          </nav>

          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue px-4 text-[14px] font-medium text-white transition hover:bg-blue-strong"
          >
            进入工作台
            <ArrowIcon />
          </Link>
        </div>
      </header>

      <section className="border-b border-line bg-panel">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8 lg:py-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-muted">
              <span className="h-2 w-2 rounded-full bg-green" />
              从候选产品到进入策略的一条线
            </div>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.04] text-ink md:text-6xl">
              AlphaPicker
            </h1>
            <p className="mt-5 max-w-xl text-[18px] leading-8 text-ink/78">
              把跨境选品当作一次产品投资决策。用真实市场数据、单位经济模型和卖家画像，
              判断每一个 SKU 是值得推进、继续观察，还是及时止损。
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/evaluations/new"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue px-5 text-[15px] font-medium text-white transition hover:bg-blue-strong"
              >
                新建产品评估
                <ArrowIcon />
              </Link>
              <Link
                href="/onboarding"
                className="inline-flex h-11 items-center rounded-lg border border-line bg-panel px-5 text-[15px] font-medium text-ink transition hover:border-line-strong hover:bg-paper"
              >
                设置卖家画像
              </Link>
            </div>

            <div className="mt-7 grid gap-2 sm:grid-cols-3">
              {metrics.map((item) => (
                <div key={item.label} className="rounded-lg border border-line bg-paper p-3">
                  <div className="text-[12px] text-muted">{item.label}</div>
                  <div className="mt-1 text-[13px] font-semibold leading-5">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-lg border border-line bg-paper p-2 shadow-pop">
              <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-panel">
                <Image
                  src="/alphapicker-product-preview.png"
                  alt="AlphaPicker 产品界面预览，包含评分仪表盘、关键词、ACOS 和情景模拟"
                  fill
                  priority
                  sizes="(min-width: 1024px) 54vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {signals.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-line bg-panel px-3 py-2 shadow-card"
                >
                  <div className="text-[11px] text-muted">{item.label}</div>
                  <div className={`mt-0.5 font-mono text-[16px] font-bold ${item.tone}`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="border-b border-line bg-paper">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionIntro
            eyebrow="WORKFLOW"
            title="从搜索一个关键词，到形成可执行的进入方案。"
            copy="AlphaPicker 把跨境选品拆成数据导入、卖家适配、财务验证和报告输出四个连续步骤，让团队能复盘每一次判断。"
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map((item) => (
              <div key={item.step} className="rounded-lg border border-line bg-panel p-5 shadow-card">
                <div className="font-mono text-[13px] font-bold text-blue">{item.step}</div>
                <h3 className="mt-5 text-[18px] font-semibold">{item.title}</h3>
                <p className="mt-3 text-[14px] leading-6 text-muted">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="model" className="border-b border-line bg-panel">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <SectionIntro
            eyebrow="DECISION MODEL"
            title="不是打一个漂亮分数，而是判断资金该不该进场。"
            copy="系统同时看市场需求、竞争集中度、利润空间、差异化缺口和风险反转，再用卖家画像权重生成综合结论。"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-blue/30 bg-blue-soft p-5">
              <div className="text-[13px] font-medium text-blue">机会指数</div>
              <div className="mt-2 font-mono text-6xl font-bold text-blue">76</div>
              <p className="mt-2 text-[14px] leading-6 text-ink/75">
                市场基分 × 利润乘数 × 风险乘数 × 卖家适配 × VOC 系数。
              </p>
            </div>
            <div className="rounded-lg border border-line bg-paper p-5">
              <div className="text-[13px] font-medium text-muted">财务底座</div>
              <div className="mt-4 space-y-3">
                {[
                  ["TACOS 安全边际", "+8.4pt", "text-green"],
                  ["广告后净利率", "21.6%", "text-green"],
                  ["资金需求", "¥38k", "text-ink"],
                  ["回本周期", "1.5 月", "text-blue"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="flex items-center justify-between gap-3 text-[14px]">
                    <span className="text-muted">{label}</span>
                    <span className={`font-mono font-bold ${tone}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-paper p-5 sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {modules.map((item) => (
                  <span
                    key={item}
                    className="rounded-lg border border-line bg-panel px-3 py-2 text-[13px] font-medium"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="data" className="border-b border-line bg-paper">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="lg:col-span-1">
            <SectionIntro
              eyebrow="DATA"
              title="数据源和成本口径对齐。"
              copy="导入框可补录真实采购与头程成本，评分、盈亏模拟器和报告页会共用同一套 COGS 基准。"
            />
          </div>
          <div className="grid gap-4 lg:col-span-2 md:grid-cols-2">
            <div className="rounded-lg border border-line bg-panel p-5 shadow-card">
              <div className="text-[15px] font-semibold">Amazon · Sorftime MCP</div>
              <p className="mt-3 text-[14px] leading-6 text-muted">
                拉取价格、FBA、毛利率、月销量、类目排名、反查关键词、搜索量、推荐竞价和 Top100 集中度。
              </p>
            </div>
            <div className="rounded-lg border border-line bg-panel p-5 shadow-card">
              <div className="text-[15px] font-semibold">eBay Browse API</div>
              <p className="mt-3 text-[14px] leading-6 text-muted">
                提供跨平台在售量、价格区间、中位价和样例 listing，让 Amazon 价格判断有外部参照。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-panel">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <div className="text-2xl font-semibold">把下一个 SKU 放进模型里看一遍。</div>
            <p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted">
              先完成卖家画像，再导入候选产品；AlphaPicker 会把选品结论落到评分、预算、关键词和止损动作上。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="inline-flex h-11 items-center rounded-lg border border-line bg-panel px-5 text-[15px] font-medium text-ink transition hover:border-line-strong hover:bg-paper"
            >
              完成画像
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue px-5 text-[15px] font-medium text-white transition hover:bg-blue-strong"
            >
              进入 AlphaPicker
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
