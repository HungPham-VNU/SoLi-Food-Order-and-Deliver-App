import { Link } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal } from './components/Reveal';

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

const ctaPrimary =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold text-primary-foreground editorial-gradient ambient-shadow transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-px';

const ctaGhost =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 text-base font-semibold text-foreground transition-colors duration-200 hover:bg-muted';

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('material-symbols-outlined', className)} aria-hidden>
      {name}
    </span>
  );
}

/** Real photo with a guaranteed real-image fallback if the source fails. */
function Photo({
  src,
  fallbackSeed,
  alt,
  className,
  eager = false,
}: {
  src: string;
  fallbackSeed: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
      onError={(e) => {
        const t = e.currentTarget;
        if (!t.dataset.fallback) {
          t.dataset.fallback = '1';
          t.src = `https://picsum.photos/seed/${fallbackSeed}/1200/900`;
        }
      }}
    />
  );
}

function Avatar({ initials, label }: { initials: string; label: string }) {
  return (
    <span
      className="flex size-11 items-center justify-center rounded-full bg-primary-200 font-headline text-sm font-bold text-primary"
      aria-label={label}
    >
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border glass-panel">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary-200">
            <UtensilsCrossed className="size-5 text-primary" />
          </span>
          <span className="font-headline text-lg font-extrabold tracking-tight text-foreground">
            UITFood
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm font-medium text-on-surface-variant transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#how"
            className="text-sm font-medium text-on-surface-variant transition-colors hover:text-foreground"
          >
            How it works
          </a>
          <a
            href="#stories"
            className="text-sm font-medium text-on-surface-variant transition-colors hover:text-foreground"
          >
            Stories
          </a>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/auth/login"
            className="hidden h-10 items-center rounded-lg px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            to="/auth/onboarding"
            className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-primary-foreground editorial-gradient transition-transform hover:-translate-y-0.5 active:translate-y-px"
          >
            Start selling
          </Link>
        </div>
      </nav>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* soft brand glow, decorative */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 size-[34rem] rounded-full bg-primary-200/40 blur-3xl"
      />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24 lg:pb-28">
        <Reveal>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            <Icon name="storefront" className="text-base" />
            For restaurants
          </p>
          <h1 className="font-headline text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Run your delivery business from{' '}
            <span className="text-primary">one dashboard</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-on-surface-variant">
            List your menu, manage live orders, map delivery zones, and get
            paid. Everything your kitchen needs, in one place.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/auth/onboarding" className={ctaPrimary}>
              Start selling
              <Icon name="arrow_forward" className="text-xl" />
            </Link>
            <Link to="/auth/login" className={ctaGhost}>
              Sign in
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Free to set up. List your first dish in minutes.
          </p>
        </Reveal>

        <Reveal delay={120} className="relative">
          <div className="overflow-hidden rounded-3xl border border-border ambient-shadow">
            <Photo
              src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1100&q=80"
              fallbackSeed="soli-hero-kitchen"
              alt="A spread of freshly prepared dishes ready for delivery"
              eager
              className="h-[24rem] w-full object-cover lg:h-[30rem]"
            />
          </div>
          {/* live-order glass card */}
          <div className="glass-panel absolute -bottom-5 -left-2 w-64 rounded-2xl border border-border p-4 ambient-shadow sm:-left-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <span className="flex size-2 rounded-full bg-primary" />
              New order
            </div>
            <p className="mt-1 font-headline text-sm font-bold text-foreground">
              Phở Bắc Hải
            </p>
            <p className="text-xs text-on-surface-variant">
              2 items · ₫135,000
            </p>
          </div>
          {/* today stat glass card */}
          <div className="glass-panel absolute -top-4 right-2 rounded-2xl border border-border px-4 py-3 ambient-shadow sm:right-6">
            <p className="font-headline text-2xl font-extrabold text-foreground">
              142
            </p>
            <p className="text-xs text-on-surface-variant">orders today</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Trust strip                                                         */
/* ------------------------------------------------------------------ */

const trustedKitchens = [
  { mark: 'PH', name: 'Phở Bắc Hải' },
  { mark: 'CT', name: 'Cơm Tấm Ba Ghiền' },
  { mark: 'BX', name: 'Bánh Xèo Sáu Hỷ' },
  { mark: 'BC', name: 'Bún Chả Hương Sen' },
  { mark: 'XM', name: 'Xôi Mặn Cô Ba' },
];

function TrustStrip() {
  return (
    <section className="border-y border-border bg-surface-container-low">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-center text-sm font-medium text-muted-foreground">
          Trusted by 1,200+ kitchens across 30 cities in Vietnam
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {trustedKitchens.map((k) => (
            <div key={k.mark} className="flex items-center gap-2.5">
              <span className="flex size-10 items-center justify-center rounded-full border border-border bg-card font-headline text-sm font-bold text-on-surface-variant">
                {k.mark}
              </span>
              <span className="font-headline text-sm font-semibold text-on-surface-variant">
                {k.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Feature bento                                                       */
/* ------------------------------------------------------------------ */

function CellHead({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary-200 text-primary">
        <Icon name={icon} className="text-xl" />
      </span>
      <h3 className="mt-4 font-headline text-xl font-bold text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
        {children}
      </p>
    </>
  );
}

function FeatureBento() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <Reveal className="max-w-2xl">
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Everything the kitchen side needs.
        </h2>
        <p className="mt-4 text-lg text-on-surface-variant">
          One workspace for orders, menu, delivery, and money. No spreadsheets,
          no juggling apps.
        </p>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Live order board - wide, with photo */}
        <Reveal className="md:col-span-2">
          <article className="group flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card ambient-shadow">
            <div className="p-7">
              <CellHead icon="receipt_long" title="Live order board">
                Accept, prepare, and dispatch every order the moment it lands.
                Tickets move across the board so nothing slips.
              </CellHead>
            </div>
            <Photo
              src="https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=900&q=80"
              fallbackSeed="soli-orders"
              alt="Kitchen pass with plated orders ready for pickup"
              className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </article>
        </Reveal>

        {/* Menu & media - photo */}
        <Reveal delay={80}>
          <article className="group flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card ambient-shadow">
            <div className="p-7">
              <CellHead icon="photo_library" title="Menu & media">
                Build your menu and upload dish photos straight to the cloud.
              </CellHead>
            </div>
            <Photo
              src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=700&q=80"
              fallbackSeed="soli-menu"
              alt="Close-up of a photographed dish for a menu listing"
              className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </article>
        </Reveal>

        {/* Delivery zones - green gradient */}
        <Reveal>
          <article className="flex h-full flex-col justify-end rounded-3xl border border-primary/20 bg-gradient-to-br from-primary-200/60 to-primary-200/10 p-7">
            <CellHead icon="map" title="Delivery zones">
              Draw your delivery radius on a real map and set fees by distance.
            </CellHead>
          </article>
        </Reveal>

        {/* Analytics - wide */}
        <Reveal delay={80} className="md:col-span-2">
          <article className="flex h-full flex-col justify-center rounded-3xl border border-border bg-card p-7 ambient-shadow">
            <CellHead icon="monitoring" title="Analytics that read plainly">
              Revenue, busy hours, and best-selling dishes in clear charts. Know
              what to cook more of, and when.
            </CellHead>
          </article>
        </Reveal>

        {/* Promotions - amber tint */}
        <Reveal>
          <article className="flex h-full flex-col justify-end rounded-3xl border border-accent/30 bg-accent/15 p-7">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Icon name="sell" className="text-xl" />
            </span>
            <h3 className="mt-4 font-headline text-xl font-bold text-foreground">
              Promotions
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              Run discounts and combos that bring regulars back.
            </p>
          </article>
        </Reveal>

        {/* Payments - wide */}
        <Reveal delay={80} className="md:col-span-2">
          <article className="flex h-full flex-col justify-center rounded-3xl border border-border bg-card p-7 ambient-shadow">
            <CellHead icon="payments" title="Get paid in đồng">
              Payments settle on a clear schedule, with every payout itemised so
              the books stay simple.
            </CellHead>
          </article>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

const steps = [
  {
    icon: 'person_add',
    title: 'Create your account',
    body: 'Sign up and tell us about your restaurant. It takes a few minutes.',
  },
  {
    icon: 'restaurant_menu',
    title: 'Add your menu and zones',
    body: 'Upload dishes with photos, then draw the area you deliver to.',
  },
  {
    icon: 'delivery_dining',
    title: 'Start taking orders',
    body: 'Go live and watch orders arrive on your board, ready to cook.',
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-y border-border bg-surface-container-low">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <Reveal className="max-w-2xl">
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Live in three steps.
          </h2>
          <p className="mt-4 text-lg text-on-surface-variant">
            From sign-up to your first order without a sales call.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 100}>
              <div className="relative">
                <div className="flex items-center gap-4">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <Icon name={step.icon} className="text-2xl" />
                  </span>
                  <span className="font-headline text-5xl font-extrabold text-primary-200">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-5 font-headline text-xl font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-on-surface-variant">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Analytics showcase                                                  */
/* ------------------------------------------------------------------ */

const showcasePoints = [
  'Daily revenue and order volume at a glance',
  'Spot your busiest hours and staff for them',
  'See which dishes earn, and which to retire',
];

function AnalyticsShowcase() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal className="order-2 lg:order-1">
          <div className="overflow-hidden rounded-3xl border border-border ambient-shadow">
            <Photo
              src="https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1000&q=80"
              fallbackSeed="soli-analytics-owner"
              alt="A restaurant owner reviewing performance on a tablet"
              className="h-[26rem] w-full object-cover"
            />
          </div>
        </Reveal>

        <Reveal delay={100} className="order-1 lg:order-2">
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Know your numbers without a spreadsheet.
          </h2>
          <p className="mt-4 text-lg text-on-surface-variant">
            UITFood turns every order into a chart you can act on, so the next
            decision is an easy one.
          </p>
          <ul className="mt-8 space-y-4">
            {showcasePoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-200 text-primary">
                  <Icon name="check" className="text-base" />
                </span>
                <span className="text-foreground">{point}</span>
              </li>
            ))}
          </ul>
          <Link to="/auth/onboarding" className={cn(ctaPrimary, 'mt-9')}>
            Start selling
            <Icon name="arrow_forward" className="text-xl" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */

const stories = [
  {
    quote:
      'Orders used to come from three different apps. Now everything lands on one board and my kitchen just cooks.',
    initials: 'LN',
    name: 'Lê Thị Ngọc',
    role: 'Owner, Phở Bắc Hải · Hà Nội',
    featured: true,
  },
  {
    quote:
      'Setting our delivery zone on the map meant no more orders we could not actually reach.',
    initials: 'TB',
    name: 'Trần Quốc Bảo',
    role: 'Cơm Tấm Ba Ghiền · TP.HCM',
  },
  {
    quote:
      'The weekly numbers told me which dishes to keep. Revenue is up and waste is down.',
    initials: 'PM',
    name: 'Phạm Minh Châu',
    role: 'Bánh Xèo Sáu Hỷ · Đà Nẵng',
  },
];

function Testimonials() {
  return (
    <section id="stories" className="border-t border-border bg-surface-container-low">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <Reveal className="max-w-2xl">
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Kitchens that switched to UITFood.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {stories.map((s, i) => (
            <Reveal
              key={s.name}
              delay={i * 90}
              className={cn(s.featured && 'md:col-span-2')}
            >
              <figure className="flex h-full flex-col justify-between rounded-3xl border border-border bg-card p-8 ambient-shadow">
                <blockquote
                  className={cn(
                    'font-headline font-semibold leading-snug text-foreground',
                    s.featured ? 'text-2xl' : 'text-lg',
                  )}
                >
                  “{s.quote}”
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-3">
                  <Avatar initials={s.initials} label={s.name} />
                  <div>
                    <p className="font-semibold text-foreground">{s.name}</p>
                    <p className="text-sm text-on-surface-variant">{s.role}</p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] bg-primary px-8 py-16 text-center sm:px-16 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-16 size-80 rounded-full bg-primary-foreground/10 blur-3xl"
          />
          <h2 className="relative mx-auto max-w-2xl font-headline text-3xl font-extrabold tracking-tight text-primary-foreground sm:text-4xl">
            Ready to put your kitchen online?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
            Join the kitchens already selling on UITFood. Set up today.
          </p>
          <Link
            to="/auth/onboarding"
            className="relative mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-card px-7 text-base font-semibold text-primary transition-transform hover:-translate-y-0.5 active:translate-y-px"
          >
            Start selling
            <Icon name="arrow_forward" className="text-xl" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

const footerCols = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how' },
      { label: 'Stories', href: '#stories' },
    ],
  },
  {
    heading: 'Get started',
    links: [
      { label: 'Start selling', href: '/auth/onboarding' },
      { label: 'Sign in', href: '/auth/login' },
    ],
  },
];

function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-200">
              <UtensilsCrossed className="size-5 text-primary" />
            </span>
            <span className="font-headline text-lg font-extrabold tracking-tight text-foreground">
              UITFood
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-on-surface-variant">
            The order, menu, and delivery workspace for restaurants in Vietnam.
          </p>
        </div>

        {footerCols.map((col) => (
          <div key={col.heading}>
            <h4 className="font-headline text-sm font-bold text-foreground">
              {col.heading}
            </h4>
            <ul className="mt-4 space-y-3">
              {col.links.map((link) =>
                link.href.startsWith('#') ? (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-on-surface-variant transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ) : (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-on-surface-variant transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} UITFood. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <LandingNav />
      <main>
        <Hero />
        <TrustStrip />
        <FeatureBento />
        <HowItWorks />
        <AnalyticsShowcase />
        <Testimonials />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
