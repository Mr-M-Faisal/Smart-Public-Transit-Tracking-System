const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
async function seo(origin) {
 const context=vm.createContext({URL,process:{env:{NEXT_PUBLIC_SITE_URL:origin}}});
 const m=new vm.SourceTextModule(fs.readFileSync(path.join(__dirname,"../src/lib/seo.js"),"utf8"),{context});
 await m.link(()=>{});await m.evaluate();return m.namespace;
}
test("SEO omits unverified domains and rejects local/insecure URLs",async()=>{
 const h=await seo();
 for(const url of [undefined,"http://localhost:3000","https://127.0.0.1","https://192.168.1.1","https://example.com/path","https://user:pass@example.com"])assert.equal(h.siteOrigin(url),null);
 assert.equal(h.publicMetadata("/about").alternates,undefined);assert.equal(h.websiteSchema(),null);
});
test("public metadata, logo and structured data use one explicit production origin",async()=>{
 const h=await seo("https://transit.example.org");
 assert.equal(h.siteOrigin(),"https://transit.example.org");
 for(const route of Object.keys(h.publicPages)) {
  const m=h.publicMetadata(route);assert.ok(m.alternates.canonical.startsWith("https://transit.example.org"));
  assert.equal(m.openGraph.images[0].url,"https://transit.example.org/images/logo.png");
  assert.equal(m.twitter.title,m.title);
 }
 assert.equal(h.publicPages["/safety"],undefined);
 assert.equal(h.privateMetadata.robots.index,false);
 const schema=JSON.parse(JSON.stringify(h.websiteSchema()));
 assert.equal(schema["@type"],"WebSite");assert.equal(schema.url,"https://transit.example.org");
 assert.equal(schema.aggregateRating,undefined);
});
test("built About is server-rendered and private layouts emit noindex",()=>{
 const root=path.join(__dirname,"../.next/server/app");
 if(!fs.existsSync(path.join(root,"about.html")))return;
 const about=fs.readFileSync(path.join(root,"about.html"),"utf8");
 assert.match(about,/About Smart Safar/);const page=about.match(/<main class="about-premium">[\s\S]*?<\/main>/)?.[0];
 assert.ok(page,"About content is server-rendered separately from streaming fallback");
 assert.equal((page.match(/<h1[ >]/g)||[]).length,1);
 assert.match(page,/Making Public Transport Simpler in Faisalabad/);
 assert.match(about,/About Smart Safar \| Public Transit Platform in Faisalabad/);
 assert.match(about,/software engineering project/);
 for(const page of ["driver/shift","admin/dashboard","profile","login"]) {
  const html=fs.readFileSync(path.join(root,page+".html"),"utf8");assert.match(html,/<meta name="robots" content="noindex, nofollow"/);
 }
});
