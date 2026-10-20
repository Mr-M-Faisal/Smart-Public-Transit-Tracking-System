import { siteOrigin } from "../lib/seo";
export default function robots() {
 const origin=siteOrigin();
 return {rules:{userAgent:"*",allow:"/",disallow:["/api/","/driver/","/admin/","/booking","/my-trips","/profile","/settings","/reports","/safety/track/"]},...(origin ? {sitemap:origin+"/sitemap.xml"} : {})};
}
