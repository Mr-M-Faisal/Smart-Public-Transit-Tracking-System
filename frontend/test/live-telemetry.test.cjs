const test=require("node:test"), assert=require("node:assert/strict"), vm=require("node:vm"), fs=require("node:fs"), path=require("node:path");
async function helpers() {
  const loaded=new vm.SourceTextModule(fs.readFileSync(path.join(__dirname,"../src/lib/transit/liveTelemetry.js"),"utf8"));
  await loaded.link(()=>{}); await loaded.evaluate(); return loaded.namespace;
}
test("an active shift alone is not fresh GPS; missing, future, cached and stale fixes are not live",async()=>{
  const h=await helpers(),now=Date.now(),bus={status:"active",position:[31.4,73.1],lastLocationUpdate:new Date(now).toISOString()};
  assert.equal(h.hasFreshTelemetry(bus,now),true);
  for(const variant of [{lastLocationUpdate:null},{lastLocationUpdate:new Date(now-30001).toISOString()},{lastLocationUpdate:new Date(now+1).toISOString()},{position:[91,73]},{isSaved:true},{status:"idle"}])
    assert.equal(h.hasFreshTelemetry({...bus,...variant},now),false);
});
test("older socket telemetry cannot replace a fresh snapshot and null ETA clears an old estimate",async()=>{
  const h=await helpers(),bus={lastLocationUpdate:"2026-10-19T12:00:01Z",etaMinutes:3,status:"active"};
  assert.equal(h.mergeTelemetry(bus,{lastLocationUpdate:"2026-10-19T12:00:00Z",latitude:31}),bus);
  assert.equal(h.mergeTelemetry(bus,{latitude:31}),bus);
  assert.equal(h.mergeTelemetry(bus,{lastLocationUpdate:bus.lastLocationUpdate,etaMinutes:null}).etaMinutes,null);
  assert.equal(h.mergeTelemetry(bus,{lastLocationUpdate:bus.lastLocationUpdate,status:"idle"}).status,"idle");
  for(const value of [null,undefined,-1,Infinity,121,"5"]) assert.equal(h.liveEtaLabel(value),null);
  assert.equal(h.liveEtaLabel(5),"5 min");
});

test("a late equal-time GPS event cannot overwrite a completed shift",async()=>{
  const h=await helpers(),bus={status:"idle",lastLocationUpdate:"2026-10-19T12:00:00Z"};
  assert.equal(h.mergeTelemetry(bus,{status:"active",lastLocationUpdate:bus.lastLocationUpdate,latitude:31,longitude:73}),bus);
});
test("public coordinate helper accepts the actual Socket.IO latitude/longitude payload",async()=>{
  const loaded=new vm.SourceTextModule(fs.readFileSync(path.join(__dirname,"../src/lib/transit/format.js"),"utf8"));
  await loaded.link(()=>{});await loaded.evaluate();
  assert.deepEqual(Array.from(loaded.namespace.getBusPosition({latitude:31.4,longitude:73.1})),[31.4,73.1]);
});

test("shared query cache rejects old positions and rejoins bus rooms on reconnect",async()=>{
  const {QueryClient}=require("@tanstack/react-query"), {EventEmitter}=require("node:events");
  const client=new QueryClient(), socket=new EventEmitter(), watched=[];
  socket.connected=true; socket.disconnect=()=>socket; socket.connect=()=>socket;
  socket.on("watchBus",id=>watched.push(id));
  const bus={_id:"a",status:"active",currentLocation:{latitude:31,longitude:73},lastLocationUpdate:"2026-10-19T12:00:01Z"};
  client.setQueryData(["transit","buses",{}],[bus]);
  let effect;
  const deps={
    react:{createContext:()=>({}),useEffect:fn=>effect=fn,useState:initial=>[typeof initial==="function"?initial():initial,()=>{}]},
    "@tanstack/react-query":{QueryClientProvider:()=>null},
    "../../lib/query/transitQueries":{getQueryClient:()=>client,restoreQueries:async()=>{},persistQueries:()=>{},isPublicQuery:()=>false},
    "../../lib/auth/token":{AUTH_CHANGE_EVENT:"auth",getAccessToken:()=>null},
    "../../lib/socket/socket":{connectSocket:()=>socket,disconnectSocket:()=>{}},
    "../../lib/transit/liveTelemetry":await helpers(),
  };
  const context=vm.createContext({setTimeout,clearTimeout,window:{addEventListener:()=>{},removeEventListener:()=>{}}});
  // Only replace the provider's JSX return; exercise its actual subscription effect.
  const source=fs.readFileSync(path.join(__dirname,"../src/components/providers/TransitProvider.jsx"),"utf8");
  const loaded=new vm.SourceTextModule(source.slice(0, source.indexOf("  return <QueryClientProvider")) + "  return null; }",{context});
  await loaded.link(name=>new vm.SyntheticModule(Object.keys(deps[name]),function(){for(const [key,value] of Object.entries(deps[name]))this.setExport(key,value);},{context}));
  await loaded.evaluate();loaded.namespace.TransitProvider({children:null});
  const cleanup=effect();
  try {
    assert.deepEqual(watched,["a"]);
    socket.emit("locationUpdate",{busId:"a",latitude:30,longitude:72,lastLocationUpdate:"2026-10-19T12:00:00Z"});
    assert.equal(client.getQueryData(["transit","buses",{}])[0].currentLocation.latitude,31);
    socket.emit("connect"); assert.deepEqual(watched,["a","a"]);
  } finally {cleanup();client.clear();}
});
