"use client";


import { useEffect, useRef, useState } from "react";
import Link from "../common/SmartLink";
import { usePathname } from "next/navigation";
import { BusFront, House, Route, Settings, UserRound } from "lucide-react";
import { BrandMark } from "../common/BrandMark";
import { PwaInstallAction } from "../pwa/PwaInstallAction";
import { useAuth } from "../../hooks/useAuth";

const links = [
  { href: "/", label: "Home" },
  { href: "/live-map", label: "Live Buses" },
  { href: "/routes", label: "Routes" },
];

const mobileLinks = [
  { href: "/", label: "Home", icon: House },
  { href: "/live-map", label: "Buses", icon: BusFront },
  { href: "/routes", label: "Routes", icon: Route },
];

export function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();


  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => {
    if (!accountOpen) return;
    const dismiss = event => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && (accountRef.current?.contains(event.target) || event.target.closest?.("[data-public-account]"))) return;
      setAccountOpen(false);
      if (event.type === "keydown") triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", dismiss); };
  }, [accountOpen]);
  if (isAuthenticated) return null;

  return <>
    <header className="legacy-navbar public-header">
      <div className="public-navbar-container">
        <Link href="/" className="public-navbar-brand" aria-label="Smart Safar home">
          <BrandMark size={40} priority />
          <span><strong>Smart Safar</strong><small>Faisalabad Transit</small></span>
        </Link>
        <nav className="public-navbar-links" aria-label="Public navigation">{links.map(link => {
          const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href + "/"));
          return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>{link.label}</Link>;
        })}</nav>
        <div className="public-navbar-actions" ref={accountRef}>
          <PwaInstallAction className="public-install-action" />
          <Link href="/register" className="public-navbar-register">Create Account</Link>
          <Link href="/login" className="public-navbar-signin">Sign In</Link>
          {accountOpen && <nav id="public-account-options" className="app-account-menu public-navbar-account-menu" aria-label="Account options"><Link href="/profile" onClick={() => setAccountOpen(false)}><UserRound size={17} /> Profile</Link><Link href="/settings" onClick={() => setAccountOpen(false)}><Settings size={17} /> Settings</Link><Link href="/register" onClick={() => setAccountOpen(false)}>Create Account</Link><Link href="/login" onClick={() => setAccountOpen(false)}>Sign In</Link></nav>}
        </div>
      </div>
    </header>
    <nav className="public-bottom-nav public-navbar-mobile" aria-label="Public mobile navigation">{mobileLinks.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? "is-active" : undefined}><Icon size={20} /><span>{label}</span></Link>;
    })}<button ref={triggerRef} type="button" data-public-account aria-expanded={accountOpen} aria-controls="public-account-options" onClick={() => setAccountOpen(open => !open)}><UserRound size={20} /><span>Account</span></button></nav>
  </>;
}
