import type { ReactNode } from 'react';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Optional right-aligned slot — e.g. action buttons. */
  actions?: ReactNode;
  /** Optional eyebrow text above the title. */
  eyebrow?: string;
}

/**
 * Decorative page header used across admin pages. Provides a softly tinted
 * gradient backdrop with subtle blurred shapes so each page has visual
 * personality without distracting from the content below.
 */
export function PageHero({ title, subtitle, icon, actions, eyebrow }: PageHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary-200/40 via-card to-card p-6 lg:p-8">
      {/* Decorative shapes */}
      <div className="pointer-events-none absolute -top-12 -right-8 h-44 w-44 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-secondary/15 blur-3xl" />
      {/* Diagonal accent line */}
      <div className="pointer-events-none absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-primary via-primary-700 to-transparent" />

      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          {icon && (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card border shadow-sm shrink-0">
              <span className="text-primary">{icon}</span>
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase mb-1">
                {eyebrow}
              </p>
            )}
            <h1 className="text-2xl lg:text-3xl font-extrabold text-on-surface font-headline tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-on-surface-variant mt-1.5 max-w-xl">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
