"use client";
import Link from "../common/SmartLink";
import { BrandMark } from "../common/BrandMark";
import { useAuth } from "../../hooks/useAuth";

export function Footer() {
 const { isAuthenticated } = useAuth();
 // Signed-in workspaces already provide role-aware navigation in AppExperience.
 if (isAuthenticated) return null;
 return <footer className="legacy-footer public-footer safar-footer">
  <div className="safar-footer-inner">
   <div className="safar-footer-brand"><Link href="/" className="safar-footer-brand-link" aria-label="Smart Safar home"><BrandMark size={30} /><strong>Smart Safar</strong></Link><p>Routes, stops and transit information for Faisalabad.</p></div>
   <nav aria-label="Footer navigation" className="safar-footer-navigation">
    <div><h2>Explore</h2><ul><li><Link href="/routes">Routes</Link></li><li><Link href="/live-map">Live Map</Link></li><li><Link href="/booking">Booking</Link></li><li><Link href="/safety">Safety</Link></li></ul></div>
    <div><h2>Information</h2><ul><li><Link href="/about">About Us</Link></li><li><a href="mailto:help@smarttransit.pk">Contact Support</a></li><li><Link href="/my-trips">My Trips</Link></li><li><Link href="/login">Sign In</Link></li></ul></div>
   </nav>
  </div>
  <p className="safar-footer-copyright">&copy; 2026 Smart Safar Faisalabad</p>
 </footer>;
}
