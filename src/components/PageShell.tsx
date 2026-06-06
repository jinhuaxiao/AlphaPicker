import type { ReactNode } from "react";

// Shared header above each "browser" mockup: index number, title, subtitle.
export function PageShell({
  index,
  title,
  subtitle,
  footer,
  children,
}: {
  index?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-6 border-b border-dashed border-line pb-4">
        <h1 className="font-serif text-2xl md:text-3xl">
          {index ? <span className="text-muted">{index} · </span> : null}
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>
        ) : null}
      </header>
      {children}
      {footer ? (
        <footer className="mt-6 border-t border-dashed border-line pt-3 text-[13px] text-muted">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
