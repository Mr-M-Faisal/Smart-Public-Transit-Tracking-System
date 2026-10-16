import Link from "../common/SmartLink";
import { Mail, MapPin } from "lucide-react";
import { BrandMark } from "../common/BrandMark";

const links = [
  { label: "Live Map", href: "/live-map" },
  { label: "Routes", href: "/routes" },
  { label: "Booking", href: "/booking" },
  { label: "Safety", href: "/safety" },
];

export function Footer() {
  return <footer className="legacy-footer public-footer border-t border-[var(--border)] bg-white">
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-7 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] md:py-10 lg:px-8">
      <div className="footer-brand"><Link href="/" className="inline-flex items-center gap-2.5"><BrandMark size={34} /><span className="font-bold text-[var(--foreground)]">Smart Safar</span></Link><p className="mt-3 max-w-xs text-sm leading-6 text-[var(--muted)]">Routes, live bus information and better journeys across Faisalabad.</p></div>
      <div className="footer-link-group"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Explore</p><div className="mt-4 grid gap-3">{links.map((link) => <Link key={link.href} href={link.href} className="text-sm text-[var(--foreground)] hover:text-[var(--primary-ink)]">{link.label}</Link>)}</div></div>
      <div className="footer-link-group"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Access</p><div className="mt-4 grid gap-3"><Link href="/my-trips" className="text-sm text-[var(--foreground)] hover:text-[var(--primary-ink)]">My Trips</Link><Link href="/login?redirect=/driver/dashboard" className="text-sm text-[var(--foreground)] hover:text-[var(--primary-ink)]">Driver Login</Link><Link href="/login?redirect=/admin/dashboard" className="text-sm text-[var(--foreground)] hover:text-[var(--primary-ink)]">Admin Login</Link><span className="inline-flex items-center gap-2 text-sm text-[var(--muted)]"><MapPin size={15} /> Faisalabad, Pakistan</span><a href="mailto:help@smarttransit.pk" className="inline-flex items-center gap-2 text-sm text-[var(--muted)]"><Mail size={15} /> Transit support</a></div></div>
    </div>
    <div className="border-t border-[var(--border)] px-4 py-4 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-1 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:gap-4"><span>&copy; 2026 Smart Safar Faisalabad</span><span>Public transit, made clearer.</span></div></div>
  </footer>;
}
