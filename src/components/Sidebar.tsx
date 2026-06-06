import Link from "next/link";
import { Logo } from "./BrowserChrome";
import type { Seller } from "@/lib/types";

const NAV = [
  { label: "我的选品", href: "/dashboard", key: "dashboard" },
  { label: "新建评估", href: "/evaluations/new", key: "new" },
  { label: "沙盘模拟", href: "/evaluations/B0DTPXR4M2/sandbox", key: "sandbox" },
  { label: "关键词库", href: "/evaluations/B0DTPXR4M2/keywords", key: "keywords" },
  { label: "模板", href: "/dashboard", key: "templates" },
  { label: "团队", href: "/dashboard", key: "team" },
];

export function Sidebar({
  seller,
  active = "dashboard",
}: {
  seller: Seller;
  active?: string;
}) {
  return (
    <aside className="flex w-52 shrink-0 flex-col justify-between border-r border-dashed border-line pr-5">
      <div>
        <Logo />
        <nav className="mt-7 space-y-3">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              className={`flex items-center gap-2.5 font-serif text-[15px] ${
                active === n.key ? "text-blue" : "text-ink/80 hover:text-ink"
              }`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full border ${
                  active === n.key ? "border-blue bg-blue" : "border-muted"
                }`}
              />
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="text-[13px]">
        <div className="text-muted">团队 · {seller.name}</div>
        <div className="text-blue">
          {seller.plan} · {seller.eval_quota_used}/{seller.eval_quota_total} 评估
        </div>
      </div>
    </aside>
  );
}
