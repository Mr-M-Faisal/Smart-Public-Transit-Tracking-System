const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const babel=require("next/dist/compiled/babel/core");
function source(file){return fs.readFileSync(path.join(__dirname,"../src",file),"utf8");}
function loadCard(props){
 const element=(type,props,...children)=>({type,props:{...props,...(children.length?{children}: {})}});
 const react={useState:()=>[1792411200000,()=>{}],useEffect(){},useRef:value=>({current:value}),createElement:element};
 const code=babel.transformSync(source("components/driver/DriverStatusCard.jsx"),{filename:"DriverStatusCard.jsx",presets:[[require.resolve("next/babel"),{"preset-react":{runtime:"classic"}}]],babelrc:false,configFile:false}).code;
 const exports={};const context={exports,React:react,require:name=>{
  if(name==="react")return react;
  if(name.includes("driverDisplay"))return {driverDisplay:()=>({gps:"GPS On",arrival:"4 min",currentLocation:"Reported stop",nextStop:"Next stop"})};
  if(name.includes("SmartLink"))return {default:"Link",__esModule:true};
  if(name.includes("/Button"))return {Button:"Button"};
  if(name.includes("/Card"))return {Card:"Card"};
  if(name==="lucide-react")return new Proxy({},{get:(_,key)=>key});
  return require(name.startsWith("@babel/runtime/") ? "next/dist/compiled/" + name : name);
 }};
 vm.runInNewContext(code,context);
 const tree=exports.DriverStatusCard({minimal:true,bus:{busNumber:"TEST"},route:{routeName:"Test route"},hasRouteAssignment:true,...props});
 const nodes=[];function visit(node){if(Array.isArray(node))return node.forEach(visit);if(node&&typeof node==="object"&&node.props){nodes.push(node);visit(node.props.children);}}visit(tree);
 return nodes;
}
test("operations reuses shift confirmation; no mutation before explicit confirmation",()=>{
 for(const shiftActive of [false,true]){
  let mutations=0,shown=0;
  const nodes=loadCard({shiftActive,onShift:()=>mutations++});
  const dialog=nodes.find(n=>n.type==="dialog");dialog.props.ref.current={showModal:()=>shown++,close(){}};
  const primary=nodes.find(n=>n.type==="Button"&&n.props["aria-busy"]!==undefined);
  primary.props.onClick();assert.equal(shown,1);assert.equal(mutations,0);
  const confirm=nodes.find(n=>n.type==="Button"&&n.props.onClick?.name==="confirmShift");
  confirm.props.onClick();assert.equal(mutations,1);
  assert.equal(nodes.filter(n=>n.type==="h1").length,1);
 }
});
test("pending shift prevents opening or confirming a second operation",()=>{
 let mutations=0;const nodes=loadCard({shiftActive:false,shiftBusy:"starting",onShift:()=>mutations++});
 const dialog=nodes.find(n=>n.type==="dialog");dialog.props.ref.current={showModal(){throw Error("pending dialog");},close(){}};
 const primary=nodes.find(n=>n.type==="Button"&&n.props["aria-busy"]!==undefined);
 assert.equal(primary.props.disabled,true);primary.props.onClick();
 nodes.find(n=>n.type==="Button"&&n.props.onClick?.name==="confirmShift").props.onClick();
 assert.equal(mutations,0);
});
test("legacy Shift route delegates to the Next redirect without rendering a page",async()=>{
 const m=new vm.SourceTextModule(source("app/driver/shift/page.js"));let destination;
 await m.link(()=>new vm.SyntheticModule(["redirect"],function(){this.setExport("redirect",url=>{destination=url;throw Error("NEXT_REDIRECT");});}));
 await m.evaluate();assert.throws(()=>m.namespace.default(),/NEXT_REDIRECT/);assert.equal(destination,"/driver/dashboard");
});
test("driver sidebar and mobile primary navigation retain Home Route Track Seats",()=>{
 const code=source("components/navigation/AppExperience.jsx");
 const block=code.match(/const driver = (\[[\s\S]*?\]);/)[1];
 const items=vm.runInNewContext(block,{House:0,History:0,MapPinned:0,BusFront:0,Ticket:0,ChartNoAxesCombined:0});
 assert.equal(items.map(i=>i.label).join(","),"Home,Route,Track,Seats,Reports");
 assert.match(code,/driver\.slice\(0, 4\)/);assert.match(code,/href="\/reports"/);
 assert.ok(!code.includes('href: "/driver/shift"'));
});
