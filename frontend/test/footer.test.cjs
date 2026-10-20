const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const babel=require("next/dist/compiled/babel/core");
function render(authenticated) {
 const code=babel.transformSync(fs.readFileSync(path.join(__dirname,"../src/components/navigation/Footer.jsx"),"utf8"),{filename:"Footer.jsx",presets:[[require.resolve("next/babel"),{"preset-react":{runtime:"classic"}}]],babelrc:false,configFile:false}).code;
 const exports={};
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}})};
 vm.runInNewContext(code,{exports,React,require:name=>{
  if(name.includes("SmartLink"))return{__esModule:true,default:"Link"};
  if(name.includes("BrandMark"))return{BrandMark:"BrandMark"};
  if(name.includes("useAuth"))return{useAuth:()=>({isAuthenticated:authenticated})};
  return require(name.startsWith("@babel/runtime/")?"next/dist/compiled/"+name:name);
 }});
 return exports.Footer();
}
test("public footer has two ordered link groups, one brand and descriptive navigation",()=>{
 const tree=render(false),nodes=[];
 function walk(node){if(Array.isArray(node))return node.forEach(walk);if(node?.props){nodes.push(node);walk(node.props.children);}}
 walk(tree);assert.equal(tree.type,"footer");
 assert.equal(nodes.filter(n=>n.type==="nav").length,1);
 assert.equal(nodes.find(n=>n.type==="nav").props["aria-label"],"Footer navigation");
 assert.equal(nodes.filter(n=>n.type==="ul").length,2);
 assert.equal(nodes.filter(n=>n.type==="BrandMark").length,1);
 assert.equal(nodes.find(n=>n.type==="BrandMark").props.size,30);
 assert.equal(nodes.filter(n=>n.type==="li").length,8);
 assert.deepEqual(nodes.filter(n=>n.props.href).map(n=>n.props.href),["/","/routes","/live-map","/booking","/safety","/about","mailto:help@smarttransit.pk","/my-trips","/login"]);
});
test("authenticated workspaces use their existing role navigation, not guest footer sign-in links",()=>{
 assert.equal(render(true),null);
});
