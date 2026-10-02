import type { HTMLAttributes, ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions}
    </header>
  );
}

export function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-line bg-white p-4 shadow-sm ${className ?? ""}`}
      {...props}
    />
  );
}

export function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[480px] overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
