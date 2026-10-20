const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
async function load(relative) {
 const cache = new Map();
 async function module(file) {
  if(cache.has(file)) return cache.get(file);
  const m = new vm.SourceTextModule(fs.readFileSync(file,"utf8"), {identifier:file}); cache.set(file,m);
  await m.link((specifier, parent)=> module(path.resolve(path.dirname(parent.identifier),specifier+".js")));
  return m;
 }
 const m=await module(path.resolve(__dirname,relative)); await m.evaluate(); return m.namespace;
}
const now=1792411200000;
const fleet=[
 {id:"a",number:"BUS-101",routeId:"r1",routeName:"City Express",position:[31,73],status:"active",lastLocationUpdate:new Date(now).toISOString()},
 {id:"b",number:"BUS-102",routeId:"r2",routeName:"Campus",position:null,status:"idle"},
 {id:"c",number:"BUS-103",routeId:"r1",position:[32,74],status:"active",lastLocationUpdate:new Date(now-31000).toISOString()},
 {id:"d",number:"BUS-104",routeId:"r1",position:[91,73],status:"active"}
];
test("bus, route, endpoint and stop search are local, case/whitespace insensitive",async()=>{
 const h=await load("../src/lib/live-map/liveBusSearch.js");
 const index=h.routeSearchIndex([{route:{_id:"r1",routeName:"City Express",startPoint:"Railway Station",endPoint:"Clock Tower"},stops:[{stopName:"Main Market"}]}]);
 for(const [term,count] of [["BUS-101",1],["101",1],["  bus-101  ",1],["city   EXPRESS",3],["railway station",3],["Clock Tower",3],["main market",3],["unknown",0]]) {
  const result=h.searchBuses(fleet,{...h.INITIAL_SEARCH,searchTerm:term},index,now);
  assert.equal(result.results.length,count,term);
  assert.ok(result.markers.every(bus=>result.results.includes(bus)));
 }
});
test("composed route and live filters explain excluded matches and reject invalid/stale GPS",async()=>{
 const h=await load("../src/lib/live-map/liveBusSearch.js");
 const r=h.searchBuses(fleet,{...h.INITIAL_SEARCH,searchTerm:"bus",selectedRoute:"r1",selectedStatus:"Live"},new Map(),now);
 assert.deepEqual(r.results.map(b=>b.id),["a"]); assert.equal(r.excluded,3);
 assert.equal(h.searchBuses(fleet,h.INITIAL_SEARCH,new Map(),now).markers.length,2);
 assert.equal(h.busLocationLabel(fleet[1],now),"Bus found \u2014 location unavailable.");
 assert.equal(h.busLocationLabel(fleet[2],now),"Last known location");
 assert.equal(h.busLocationLabel({...fleet[0],isSaved:true},now),"Offline / last known location");
 assert.equal(h.searchBuses([{...fleet[0],isSaved:true}],{...h.INITIAL_SEARCH,selectedStatus:"Live"},new Map(),now).results.length,0);
});
test("selection uses ID without changing filters; query never requests a fit; reset fits",async()=>{
 const h=await load("../src/lib/live-map/liveBusSearch.js");const reduce=h.liveBusSearchReducer;
 let s=reduce(h.INITIAL_SEARCH,{type:"filter",field:"searchTerm",value:"101"});
 const fit=s.fitRevision;s=reduce(s,{type:"select",id:"a",collapse:true});
 assert.equal(s.searchTerm,"101");assert.equal(s.selectedRoute,"All routes");assert.equal(s.searchOpen,false);
 s=reduce(s,{type:"toggle-panel"});assert.equal(s.searchOpen,true);
 s=reduce(s,{type:"toggle-panel"});assert.equal(s.searchOpen,false);
 const revision=s.cameraRevision;s=reduce(s,{type:"select",id:"a"});assert.equal(s.cameraRevision,revision+1);
 s=reduce(s,{type:"follow",available:true});assert.equal(s.followBus,true);
 s=reduce(s,{type:"suspend"});assert.equal(s.followBus,false);
 assert.equal(reduce(s,{type:"catalogue",ids:["a"]}),s);
 s=reduce(s,{type:"catalogue",ids:[]});assert.equal(s.selectedBusId,null);
 s=reduce(s,{type:"filter",field:"searchTerm",value:"102"});assert.equal(s.fitRevision,fit);
 s=reduce(s,{type:"reset"});assert.equal(s.fitRevision,fit+1);assert.equal(s.searchTerm,"");assert.equal(s.selectedStatus,"All");
 s=reduce(s,{type:"filter",field:"searchTerm",value:"new"});assert.equal(s.fitRevision,fit+1);
 assert.equal(reduce(s,{type:"restore",saved:{searchTerm:"old"}}),s);
});
test("lightweight populated route retains authoritative endpoints",async()=>{
 const h=await load("../src/lib/transit/format.js");
 const b=h.normalizeBus({_id:"b",route:{_id:"r",routeName:"City"},direction:"return"},null,{r:{_id:"r",startPoint:"Station",endPoint:"Tower"}});
 assert.equal(b.routeStart,"Station");assert.equal(b.routeEnd,"Tower");assert.equal(b.routeId,"r");
});

test("actual viewport only moves on selection/reset/follow, not typing, updates or resizing", async()=>{
 const effects=[],refs=[],calls=[];let cursor=0,pending=[],resize;
 const map={on(){},off(){},stop(){},getContainer:()=>({addEventListener(){},removeEventListener(){}}),
 getZoom:()=>16,setView:(...args)=>calls.push(["select",...args]),fitBounds:(...args)=>calls.push(["fit",...args]),
 panTo:(...args)=>calls.push(["follow",...args]),invalidateSize:()=>calls.push(["resize"])};
 const effect=(fn,deps)=>{const i=cursor++;const old=effects[i];if(!old||deps.some((v,n)=>v!==old[n]))pending.push(fn);effects[i]=deps;};
 const react={useEffect:effect,useLayoutEffect:effect,useRef:value=>{const i=cursor++;return refs[i] ||= {current:value};}};
 const context=vm.createContext({window:{matchMedia:()=>({matches:false})},navigator:{},ResizeObserver:class{constructor(fn){resize=fn}observe(){}disconnect(){}}});
 const m=new vm.SourceTextModule(fs.readFileSync(path.join(__dirname,"../src/components/map/MapViewport.jsx"),"utf8"),{context});
 const mods={react,"react-leaflet":{useMap:()=>map},"../../lib/transit/coordinates":{isValidPosition:p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)},
 "../../lib/live-map/liveMapStorage":{readLiveMapState:async()=>null,saveLiveMapViewport(){}}};
 await m.link(name=>{const exports=mods[name];return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value]of Object.entries(exports))this.setExport(key,value)},{context});});
 await m.evaluate();
 function render(props){cursor=0;pending=[];m.namespace.MapViewport(props);pending.forEach(fn=>fn());}
 const base={positions:[[31,73],[32,74]],fitKey:0,focusKey:null};
 render(base);assert.equal(calls.length,1);
 render({...base,positions:[[31.1,73],[32,74]]});assert.equal(calls.length,1);
 resize();assert.equal(calls.at(-1)[0],"resize");
 render({...base,focusKey:1,focusPosition:[31,73]});assert.equal(calls.at(-1)[0],"select");
 const count=calls.length;
 render({...base,focusKey:1,focusPosition:[31.2,73]});assert.equal(calls.length,count);
 render({...base,focusKey:2,focusPosition:null});assert.equal(calls.length,count);
 render({...base,fitKey:1});assert.equal(calls.at(-1)[0],"fit");
 const resetCount=calls.length;render({...base,fitKey:1});assert.equal(calls.length,resetCount);
 render({...base,fitKey:1,followPosition:[31.3,73]});assert.equal(calls.at(-1)[0],"follow");
});

test("tracking distinguishes passenger offline, unavailable, weak and stale without inventing driver state",async()=>{
 const {trackingStatus}=await load("../src/lib/live-map/trackingStatus.js");
 assert.equal(trackingStatus(fleet[0],now).label,"Live GPS");
 assert.equal(trackingStatus(fleet[0],now).canFollow,true);
 assert.equal(trackingStatus(fleet[1],now).canFollow,false);
 assert.equal(trackingStatus(fleet[1],now).label,"GPS unavailable");
 assert.equal(trackingStatus(fleet[2],now).label,"Last known location");
 assert.equal(trackingStatus(fleet[2],now).canFollow,false);
 const disconnected=trackingStatus({...fleet[0],isSaved:true},now,true);
 assert.ok(!disconnected.explanation.includes("You are offline"));
 assert.ok(disconnected.explanation.includes("Driver connection status is unavailable"));
 assert.equal(trackingStatus(fleet[0],now,false).canFollow,false);
 assert.match(trackingStatus(fleet[0],now,false).explanation,/You are offline/);
 assert.equal(trackingStatus({...fleet[0],accuracy:120},now).label,"GPS weak");
 assert.equal(trackingStatus({...fleet[0],accuracy:120},now).canFollow,false);
});
test("compact default, typing opens results, selection collapses and closing preserves query",async()=>{
 const h=await load("../src/lib/live-map/liveBusSearch.js");
 assert.equal(h.INITIAL_SEARCH.searchOpen,false);
 let s=h.liveBusSearchReducer(h.INITIAL_SEARCH,{type:"filter",field:"searchTerm",value:"101"});
 assert.equal(s.searchOpen,true);
 s=h.liveBusSearchReducer(s,{type:"select",id:"a",collapse:true});
 assert.equal(s.searchOpen,false);
 s=h.liveBusSearchReducer(s,{type:"close-selection"});
 assert.equal(s.searchTerm,"101");assert.equal(s.selectedBusId,null);
 s=h.liveBusSearchReducer(s,{type:"filter",field:"searchTerm",value:""});
 assert.equal(s.searchOpen,false);
});
