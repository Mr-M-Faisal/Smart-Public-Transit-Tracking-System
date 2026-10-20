import { AboutMotion } from "../../components/about/AboutMotion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Route, MapPin, Radio, Clock3, Ticket, Search, Navigation } from "lucide-react";
import { Navbar } from "../../components/navigation/Navbar";
import { Footer } from "../../components/navigation/Footer";
import { publicMetadata } from "../../lib/seo";

export const metadata = publicMetadata("/about");
const features = [
 { icon: Route, title: "Bus route discovery", text: "Explore listed routes and their endpoints to find a service that fits your journey." },
 { icon: MapPin, title: "Stop information", text: "Find stops along a route and understand where your journey begins and ends." },
 { icon: Radio, title: "Tracking with context", text: "View live GPS positions when available. Last-known locations are identified separately from fresh updates." },
 { icon: Clock3, title: "Arrival estimates", text: "Check estimated arrivals when reliable tracking information is available. Estimates can change with conditions." },
 { icon: Ticket, title: "Supported seat booking", text: "Use seat selection and booking for supported buses and journeys after signing in." },
];
export default function AboutPage() {
 return <><Navbar /><main className="about-premium"><AboutMotion />
  <header className="about-hero">
   <div className="about-hero-copy"><p className="about-eyebrow">About Smart Safar</p>
    <h1>Making Public Transport Simpler in Faisalabad</h1>
    <p className="about-intro">Smart Safar brings bus routes, stops, and available tracking information together to help passengers make more informed travel decisions.</p>
    <div className="about-actions"><Link href="/routes" className="about-action-primary">Explore Routes <ArrowRight size={18} aria-hidden="true" /></Link><Link href="/live-map">Live Map <ArrowRight size={18} aria-hidden="true" /></Link></div>
   </div>
   <figure className="about-hero-image"><Image src="/images/cards/transit-fleet.webp" alt="A white city bus on an urban street alongside local traffic and roadside shops" width={768} height={432} sizes="(max-width: 767px) 100vw, 48vw" priority /><figcaption>Better information for the journey ahead.</figcaption></figure>
  </header>
  <section className="about-editorial about-mission" aria-labelledby="about-mission"><div><p className="about-eyebrow">Our mission</p><h2 id="about-mission">A clearer starting point for every journey.</h2></div><div><p>Finding convenient public transport information can be difficult when routes, stops and bus updates are scattered or unavailable. That uncertainty can make even a familiar journey harder to plan.</p><p>Smart Safar aims to bring available information into one accessible place, helping passengers discover routes, understand their options and plan with greater confidence.</p></div></section>
  <section className="about-process" aria-labelledby="about-how"><div className="about-section-heading"><p className="about-eyebrow">How it works</p><h2 id="about-how">From a question to a journey.</h2></div><ol>
   <li><span className="about-step-marker" aria-hidden="true"><Search size={21} /><span>01</span></span><h3>Find your route.</h3><p>Search the available routes or buses for your destination.</p></li>
   <li><span className="about-step-marker" aria-hidden="true"><MapPin size={21} /><span>02</span></span><h3>Explore stops and available bus updates.</h3><p>Review stops, route information and the freshness of any GPS updates.</p></li>
   <li><span className="about-step-marker" aria-hidden="true"><Navigation size={21} /><span>03</span></span><h3>Plan your journey.</h3><p>Use the information available to choose your route and supported booking options.</p></li>
  </ol></section>
  <section className="about-editorial about-features" aria-labelledby="about-features"><div><p className="about-eyebrow">Useful by design</p><h2 id="about-features">The details that help you get moving.</h2><p>Practical tools, with clear limits when live information is unavailable.</p></div><ul>{features.map(({icon:Icon,title,text})=><li key={title}><Icon size={21} aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></li>)}</ul></section>
  <section className="about-local" aria-labelledby="about-local"><p className="about-eyebrow">Built for Faisalabad</p><h2 id="about-local">A local focus. An honest view of coverage.</h2><p>Smart Safar focuses on public transit information in Faisalabad. Coverage is limited to the routes, stops and buses currently listed on the platform; it does not include every service in the city.</p><p>Tracking depends on available driver GPS updates and network connectivity. The project does not claim an official government or transport authority affiliation.</p></section>
  <section className="about-editorial about-background" aria-labelledby="about-background"><div><p className="about-eyebrow">Project background</p><h2 id="about-background">Engineering for everyday travel.</h2></div><div><p>Smart Safar is a final-year software engineering project focused on public transit technology and improving access to useful travel information.</p><p>It brings passenger discovery, driver operations and authorized administration into one platform, with an emphasis on clear information and practical usability.</p></div></section>
  <section className="about-cta" aria-labelledby="about-ready"><div><p className="about-eyebrow">Your next journey</p><h2 id="about-ready">Start with the route. See what’s available.</h2></div><nav className="about-actions" aria-label="Plan your journey"><Link href="/routes" className="about-action-primary">Explore Faisalabad Routes <ArrowRight size={18} aria-hidden="true" /></Link><Link href="/live-map">Open Live Bus Map <ArrowRight size={18} aria-hidden="true" /></Link></nav></section>
 </main><Footer /></>;
}
