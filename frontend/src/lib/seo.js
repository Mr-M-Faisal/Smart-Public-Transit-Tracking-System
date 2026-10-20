export function siteOrigin(value = process.env.NEXT_PUBLIC_SITE_URL) {
 if (!value) return null;
 try {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !url.hostname.includes(".") || /^(localhost|127\.|0\.|192\.168\.|10\.)/.test(url.hostname) || url.hostname.endsWith(".local")) return null;
  return url.origin;
 } catch { return null; }
}
export const publicPages = {
 "/": ["Smart Safar | Bus Routes & Live Transit in Faisalabad", "Explore available Faisalabad bus routes, stops and GPS tracking information. Plan your journey with Smart Safar."],
 "/routes": ["Faisalabad Bus Routes & Stops | Smart Safar", "Find available Faisalabad bus routes, endpoints and stops, and explore route information for your journey."],
 "/live-map": ["Live Bus Tracking in Faisalabad | Smart Safar", "Search buses and view available GPS positions, route geometry and arrival estimates. Tracking depends on current telemetry."],
 "/about": ["About Smart Safar | Public Transit Platform in Faisalabad", "Learn about Smart Safar, a Faisalabad-focused public transit platform for exploring bus routes, stops, and available live bus tracking information."],
};
export function publicMetadata(path, details = publicPages[path]) {
 const [title, description] = details;
 const origin = siteOrigin();
 const url = origin ? origin + (path === "/" ? "" : path) : undefined;
 const images = origin ? [{url: origin + "/images/logo.png", alt: "Smart Safar logo"}] : [];
 return { title, description, ...(url ? {alternates:{canonical:url}} : {}),
  openGraph:{title,description,type:"website",siteName:"Smart Safar",...(url?{url}:{}),images},
  twitter:{card:"summary",title,description,images:images.map(image=>image.url)} };
}
export const privateMetadata = { robots: { index:false, follow:false } };
export function websiteSchema() {
 const origin = siteOrigin();
 return origin ? {"@context":"https://schema.org","@type":"WebSite",name:"Smart Safar",url:origin,description:publicPages["/"][1],inLanguage:"en"} : null;
}
