import type { ReactNode } from "react";

export function BrowserChrome({
  url,
  children,
  maxWidth = "max-w-5xl",
}: {
  url: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className={`mx-auto w-full ${maxWidth}`}>
      <div className="rounded-2xl border border-line bg-panel shadow-[0_24px_60px_-30px_rgba(44,42,38,0.5)]">
        <div className="flex items-center gap-3 border-b border-dashed border-line px-5 py-3">
          <div className="flex gap-2">
            <span className="h-3 w-3 rounded-full border border-line" />
            <span className="h-3 w-3 rounded-full border border-line" />
            <span className="h-3 w-3 rounded-full border border-line" />
          </div>
          <div className="ml-2 flex-1">
            <div className="inline-flex max-w-full items-center truncate rounded-full border border-line bg-panel-2 px-4 py-1.5 font-mono text-[13px] text-muted">
              {url}
            </div>
          </div>
        </div>
        <div className="p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3 L21 20 H3 Z" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="14" r="2" fill="var(--color-blue)" />
      </svg>
      <span className="font-serif text-lg tracking-wide">AlphaPicker</span>
    </span>
  );
}
