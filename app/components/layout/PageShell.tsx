import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function PageShell({
  title,
  description,
  action,
  children,
}: PageShellProps) {
  return (
    <div className="flex flex-col min-h-screen px-6 py-6 md:px-8 md:py-8 max-w-[1200px] mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[--text-primary] tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-[--text-muted] mt-1">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
