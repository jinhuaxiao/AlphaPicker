import type { KeywordInsight } from "@/lib/keywords";
import { usd } from "@/lib/format";

function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 px-3 py-2">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`font-mono text-[15px] font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function posTone(page: number): string {
  if (page === 1) return "border-green/40 text-green bg-green-soft";
  if (page === 2) return "border-orange/40 text-orange bg-orange-soft";
  return "border-line text-muted bg-panel-2";
}

export function KeywordGapCard({ ki }: { ki: KeywordInsight }) {
  const coverageTone =
    ki.coverageScore >= 50 ? "text-green" : ki.coverageScore >= 20 ? "text-orange" : "text-red";

  return (
    <div className="mt-5 rounded-xl border border-line bg-panel p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-semibold">关键词机会与流量缺口</span>
        <span className="rounded-full border border-green/40 bg-green-soft px-2 py-0.5 text-[11px] text-green">
          Sorftime 类目词 + 自然位
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="需求广度 · 核心词月搜索" value={compact(ki.breadthSearchTotal)} />
        <Stat label="首页覆盖率" value={`${ki.coverageScore}%`} tone={coverageTone} />
        <Stat label="流量缺口 · 未占首页" value={`${ki.gapCount} 词`} tone={ki.gapCount > 0 ? "text-orange" : ""} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* traffic gaps */}
        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 text-[13px] font-medium">
            流量缺口 · 高搜索核心词（本品未占首页）
          </div>
          {ki.gaps.length === 0 ? (
            <div className="rounded border border-dashed border-line p-4 text-center text-[13px] text-muted">
              核心词首页覆盖良好，暂无明显缺口。
            </div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[12px] text-muted">
                  <th className="pb-1 font-normal">关键词</th>
                  <th className="pb-1 text-right font-normal">月搜索</th>
                  <th className="pb-1 text-right font-normal">CPC</th>
                </tr>
              </thead>
              <tbody>
                {ki.gaps.map((g) => (
                  <tr key={g.keyword} className="border-t border-line">
                    <td className="py-1.5">{g.keyword}</td>
                    <td className="py-1.5 text-right font-mono">{compact(g.monthlySearch)}</td>
                    <td className="py-1.5 text-right font-mono text-muted">{usd(g.cpc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* long-tail opportunities */}
        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 text-[13px] font-medium">长尾机会 · 关联延伸词</div>
          {ki.longtail.length === 0 ? (
            <div className="rounded border border-dashed border-line p-4 text-center text-[13px] text-muted">
              暂无长尾延伸词。
            </div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[12px] text-muted">
                  <th className="pb-1 font-normal">关键词</th>
                  <th className="pb-1 text-right font-normal">月搜索</th>
                  <th className="pb-1 text-right font-normal">CPC</th>
                </tr>
              </thead>
              <tbody>
                {ki.longtail.map((l) => (
                  <tr key={l.keyword} className="border-t border-line">
                    <td className="py-1.5">{l.keyword}</td>
                    <td className="py-1.5 text-right font-mono">{compact(l.monthlySearch)}</td>
                    <td className="py-1.5 text-right font-mono text-muted">{usd(l.cpc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* product's own natural-rank coverage */}
      {ki.coverage.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 text-[13px] font-medium">本品自然位覆盖</div>
          <div className="flex flex-wrap gap-1.5">
            {ki.coverage.map((c) => (
              <span
                key={c.keyword}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] ${posTone(c.page)}`}
              >
                <span>{c.keyword}</span>
                <span className="font-mono">
                  {c.page ? `P${c.page}·#${c.slot}` : "—"}
                </span>
                <span className="text-muted">· {compact(c.monthlySearch)}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
