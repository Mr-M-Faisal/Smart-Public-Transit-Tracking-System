const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
async function load(){
 const m=new vm.SourceTextModule(fs.readFileSync(path.join(__dirname,"../src/lib/aboutMotion.js"),"utf8"));
 await m.link(()=>{});await m.evaluate();return m.namespace;
}
test("About reveal is optional and never writes hidden styles",async()=>{
 const h=await load();assert.doesNotThrow(()=>h.observeAboutSections(null,null)());
 assert.doesNotThrow(()=>h.observeAboutSections({querySelectorAll(){throw Error("unsupported observer");}},undefined)());
});
test("About observes sections, reveals only intersecting targets and cleans up animations",async()=>{
 const h=await load();let callback,disconnected=0,cancelled=0;const observed=[],unobserved=[],calls=[];
 const target={animate:(frames,options)=>{calls.push({frames,options});return{cancel:()=>cancelled++};}};
 class Observer{constructor(cb){callback=cb;}observe(node){observed.push(node);}unobserve(node){unobserved.push(node);}disconnect(){disconnected++;}}
 const stop=h.observeAboutSections({querySelectorAll:()=>[target]},Observer);
 assert.equal(observed.length,1);callback([{target,isIntersecting:false}]);assert.equal(calls.length,0);
 callback([{target,isIntersecting:true}]);assert.equal(calls.length,1);assert.equal(unobserved[0],target);
 assert.equal(calls[0].options.duration,360);assert.equal(calls[0].frames[1].opacity,1);
 stop();assert.equal(disconnected,1);assert.equal(cancelled,1);
});
