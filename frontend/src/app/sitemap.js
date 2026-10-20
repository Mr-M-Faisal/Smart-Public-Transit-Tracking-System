import { publicPages, siteOrigin } from "../lib/seo";
export default function sitemap() {
 const origin=siteOrigin();
 return origin ? Object.keys(publicPages).map(path=>({url:origin+(path==="/"? "" : path)})) : [];
}
