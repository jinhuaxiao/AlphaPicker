import Link from "next/link";
import type { ReactNode } from "react";
import type { Seller } from "@/lib/types";

function Icon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "grid":
      return (
        <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
      );
    case "plus":
      return (
        <svg {...common}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 8v8M8 12h8" /></svg>
      );
    case "scatter":
      return (
        <svg {...common}><path d="M4 4v16h16" /><circle cx="9" cy="14" r="1.4" /><circle cx="13" cy="9" r="1.4" /><circle cx="17" cy="12" r="1.4" /></svg>
      );
    case "keyword":
      return (
        <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      );
    case "template":
      return (
        <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
      );
    case "users":
      return (
        <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></svg>
      );
    case "profile":
      return (
        <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
      );
    case "spark":
      return (
        <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
      );
    default:
      return null;
  }
}

export function AppShell({
  seller,
  active,
  title,
  breadcrumb,
  actions,
  featuredAsin,
  children,
}: {
  seller: Seller;
  active?: string;
  title?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  featuredAsin?: string;
  children: ReactNode;
}) {
  const productHref = (key: string) =>
    featuredAsin ? `/evaluations/${featuredAsin}/${key}` : "/dashboard";
  const NAV = [
    { key: "dashboard", label: "我的选品", href: "/dashboard", icon: "grid" },
    { key: "recommend", label: "智能推荐", href: "/recommend", icon: "spark" },
    { key: "new", label: "新建评估", href: "/evaluations/new", icon: "plus" },
    { key: "sandbox", label: "沙盘模拟", href: productHref("sandbox"), icon: "scatter" },
    { key: "keywords", label: "关键词库", href: productHref("keywords"), icon: "keyword" },
    { key: "profile", label: "卖家画像", href: "/profile", icon: "profile" },
    { key: "templates", label: "模板", href: "/dashboard", icon: "template" },
    { key: "team", label: "团队", href: "/dashboard", icon: "users" },
  ];
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-line px-5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 3 L21 20 H3 Z" stroke="var(--color-blue)" strokeWidth="1.8" />
            <circle cx="12" cy="14" r="2.4" fill="var(--color-blue)" />
          </svg>
          <span className="text-[17px] font-semibold tracking-tight">AlphaPicker</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition ${
                active === n.key
                  ? "bg-blue-soft font-medium text-blue"
                  : "text-ink/75 hover:bg-panel-2"
              }`}
            >
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-soft text-[14px] font-semibold text-blue">
              {seller.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium">{seller.name}</div>
              <div className="truncate text-[12px] text-muted">
                {seller.plan} · {seller.eval_quota_used}/{seller.eval_quota_total}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-line bg-panel/90 px-6 backdrop-blur">
          <div className="min-w-0">
            {breadcrumb ? (
              <div className="text-[12px] text-muted">{breadcrumb}</div>
            ) : null}
            {title ? (
              <h1 className="truncate text-[16px] font-semibold leading-tight">{title}</h1>
            ) : null}
          </div>
          <div className="flex items-center gap-3">{actions}</div>
        </header>

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
