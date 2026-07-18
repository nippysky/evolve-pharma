/**
 * StaffAuthVisual — the panel rendered beside the staff console sign-in
 * on desktop. Intentionally sober and internal: no customer marketing,
 * no testimonial. Dark gradient signals "back office" vs the customer
 * brand-green panel.
 */

import { Logo } from '@/components/shared/Logo';
import { Shield, Truck, Sparkle } from '@/components/icons';

export function StaffAuthVisual() {
  return (
    <aside
      aria-hidden
      className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-ink via-slate-900 to-slate-950 p-10 text-white lg:flex lg:p-16"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(700px_300px_at_85%_120%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(900px_400px_at_5%_-10%,rgba(56,189,124,0.16),transparent_60%)]"
      />

      <div className="relative">
        <Logo monochrome />
      </div>

      <div className="relative max-w-md">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
          Internal · Operations console
        </span>
        <h2
          className="display-serif mt-3 font-normal leading-[1.15] tracking-tight"
          style={{ fontSize: 'clamp(2rem, 3.4vw, 2.75rem)' }}
        >
          The control room behind <em className="not-italic text-white/85">Envolve</em>.
        </h2>
        <p className="mt-6 text-sm leading-relaxed text-white/70">
          Catalog, customers, agents, deliveries, and reporting — managed from one place. Access is
          scoped to your role.
        </p>

        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/70">
          <li className="inline-flex items-center gap-1.5">
            <Shield size={13} /> Role-based access
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Truck size={13} /> Live dispatch
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Sparkle size={13} /> Audit-ready
          </li>
        </ul>
      </div>

      <div className="relative max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
        <p className="text-sm leading-relaxed text-white/85">
          This portal is for EnvolveCare Express staff only. If you reached it by mistake, head to the customer
          sign-in.
        </p>
        <footer className="mt-4 text-xs text-white/55">
          Authorized personnel · EnvolveCare Express
        </footer>
      </div>
    </aside>
  );
}