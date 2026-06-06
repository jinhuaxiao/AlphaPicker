import Link from "next/link";
import type { ReactNode } from "react";
import type { Seller } from "@/lib/types";
import AgentPanel, { type AgentView } from "@/components/agent/AgentPanel";

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
    case "compass":
      return (
        <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2z" /></svg>
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
  // Derive the agent's page context from the shell props so AlphaPilot follows
  // whatever the seller is looking at.
  const agentView: AgentView = featuredAsin
    ? "decision"
    : active === "recommend"
      ? "recommend"
      : active === "dashboard"
        ? "dashboard"
        : "other";
  const agentLabel = typeof title === "string" ? title : undefined;
  const NAV = [
    { key: "dashboard", label: "我的选品", href: "/dashboard", icon: "grid" },
    { key: "discover", label: "市场机会", href: "/discover", icon: "compass" },
    { key: "recommend", label: "智能推荐", href: "/recommend", icon: "spark" },
    { key: "new", label: "新建评估", href: "/evaluations/new", icon: "plus" },
    { key: "sandbox", label: "沙盘模拟", href: productHref("sandbox"), icon: "scatter" },
    { key: "keywords", label: "关键词库", href: productHref("keywords"), icon: "keyword" },
    { key: "profile", label: "卖家画像", href: "/profile", icon: "profile" },
  ];
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-line px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" aria-hidden className="h-6 w-6 object-contain" />
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

        <div className="border-t border-line p-5">
          <div className="rounded-xl bg-panel-2/50 p-4">
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-blue"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              评估额度
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-2xl font-bold text-ink">{seller.eval_quota_used}</span>
              <span className="text-[14px] text-muted">/ {seller.eval_quota_total}</span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div 
                className="h-full rounded-full bg-blue" 
                style={{ width: `${(seller.eval_quota_used / seller.eval_quota_total) * 100}%` }}
              />
            </div>
            <div className="mt-3 text-[12px] text-muted">
              重置时间: 2025-06-23
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button className="text-muted hover:text-ink transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-[64px] items-center justify-between gap-3 bg-panel/80 backdrop-blur-md border-b border-line px-4 py-2 shadow-sm sm:gap-4 sm:px-6">
          <div className="min-w-0 flex-1">
            {breadcrumb ? (
              <div className="text-[13px] text-muted mb-1 flex items-center gap-2">
                {breadcrumb}
              </div>
            ) : null}
            {title ? (
              <h1 className="truncate text-[16px] font-semibold text-ink leading-relaxed tracking-tight">{title}</h1>
            ) : null}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {actions}
            <div className="flex items-center gap-2 text-muted border-l border-line pl-3 ml-1 sm:gap-3 sm:pl-4 sm:ml-2">
              <button className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-soft to-purple-50 px-3 py-1.5 text-[13px] font-medium text-blue transition hover:shadow-sm hover:opacity-90 border border-blue/10 sm:flex">
                <Icon name="spark" />
                升级套餐
              </button>
              <button className="hover:text-blue transition p-1.5 rounded-full hover:bg-blue-soft">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
              </button>
              <button className="hover:text-blue transition p-1.5 rounded-full hover:bg-blue-soft relative">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red ring-2 ring-panel"></span>
              </button>
              <div className="ml-1 flex items-center gap-2 cursor-pointer hover:bg-panel-2 p-1 pr-2 rounded-full transition border border-transparent hover:border-line">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue to-blue-strong text-[12px] font-medium text-white shadow-sm">
                  {seller.name.slice(0, 1)}
                </div>
                <span className="hidden text-[13px] font-medium text-ink sm:inline">{seller.name}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-muted"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6">{children}</main>
      </div>

      {/* Right rail · AlphaPilot agent (follows page context) */}
      <AgentPanel view={agentView} asin={featuredAsin} label={agentLabel} />
    </div>
  );
}
