const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const { server, io } = require('../src/server');
const Bus = require('../src/models/Bus');
const User = require('../src/models/User');
const Route = require('../src/models/Route');
const Stop = require('../src/models/Stop');
const Shift = require('../src/models/Shift');
const dbName = 'transit_gps_test_' + crypto.randomBytes(8).toString('hex');
let base, driver, bus, token;
async function request(url, body, method = 'PATCH') {
  const response = await fetch(base + url, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(45000) });
  return { status: response.status, data: await response.json() };
}
const location = body => request('/api/buses/' + bus._id + '/location', body);
before(async () => {
  await mongoose.connect(process.env.TEST_MONGO_URI || process.env.MONGO_URI, { dbName, serverSelectionTimeoutMS: 10000 });
  assert.equal(mongoose.connection.name, dbName);
  for (const model of [Bus, User, Route, Stop, Shift]) await model.init();
  const route = await Route.create({ routeName:'GPS QA', startPoint:'Start', endPoint:'End' });
  await Stop.create({ route:route._id, stopName:'Target', latitude:31.42, longitude:73.082, stopOrder:1 });
  driver = await User.create({ name:'GPS QA Driver', email:'gps@qa.example', password:crypto.randomBytes(20).toString('hex'), role:'driver' });
  bus = await Bus.create({ busNumber:'GPS-QA', route:route._id, driver:driver._id, capacity:10, availableSeats:10, status:'active' });
  await User.updateOne({_id:driver._id},{$set:{assignedBus:bus._id}});
  await Shift.create({ driver:driver._id, bus:bus._id, route:route._id, status:'active', startDirection:'outbound', startedAt:new Date(Date.now()-60000) });
  token = jwt.sign({id:driver._id},process.env.JWT_SECRET);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  base = 'http://127.0.0.1:' + server.address().port;
}, {timeout:60000});
after(async () => {
  if (server.listening) { server.closeAllConnections(); await new Promise(resolve => io.close(resolve)); }
  try { if (mongoose.connection.readyState === 1) { assert.equal(mongoose.connection.name,dbName); assert.match(dbName,/^transit_gps_test_/); await mongoose.connection.dropDatabase(); } }
  finally { await mongoose.disconnect(); }
}, {timeout:30000});

test('GPS rejects invalid coordinates, speed, accuracy and capture times without storing them', async () => {
  const invalid = [
    {latitude:91,longitude:73}, {latitude:'31',longitude:73}, {latitude:31,longitude:-181},
    {latitude:31,longitude:73,speed:-1}, {latitude:31,longitude:73,speed:145},
    {latitude:31,longitude:73,accuracy:101}, {latitude:31,longitude:73,accuracy:'12'},
    {latitude:31,longitude:73,timestamp:Date.now()-60000}, {latitude:31,longitude:73,timestamp:Date.now()+60000},
  ];
  const saved = await Bus.findById(bus._id).lean();
  for (const body of invalid) assert.equal((await location(body)).status,400,JSON.stringify(body));
  assert.deepEqual((await Bus.findById(bus._id).lean()).currentLocation,saved.currentLocation);
});

test('GPS capture ordering rejects delayed and duplicate updates and converges under concurrency', async () => {
  await Bus.updateOne({_id:bus._id},{$set:{lastLocationUpdate:null}});
  const newest = Date.now()-1000;
  assert.equal((await location({latitude:31.415,longitude:73.07,timestamp:newest,speed:15})).status,200);
  for (const timestamp of [newest-1000,newest]) assert.equal((await location({latitude:31.4,longitude:73.06,timestamp})).status,422);
  const time = Date.now()-100;
  const results = await Promise.all([0,1,2].map(n => location({latitude:31.415+n/10000,longitude:73.07,timestamp:time+n,speed:15})));
  assert.ok(results.every(result => [200,422].includes(result.status)));
  const saved = await Bus.findById(bus._id);
  assert.equal(saved.lastLocationUpdate.getTime(),time+2);
  assert.equal(saved.currentLocation.latitude,31.415+2/10000);
});

test('ETA is nullable for stale, missing and inactive telemetry; fresh no-speed fallback remains', async () => {
  for (const state of [
    {status:'active',lastLocationUpdate:new Date(Date.now()-60000)},
    {status:'active',lastLocationUpdate:null},
    {status:'idle',lastLocationUpdate:new Date()},
  ]) {
    await Bus.updateOne({_id:bus._id},{$set:{...state,currentLocation:{latitude:31.418,longitude:73.079},recentSpeeds:[]}});
    const result = await request('/api/buses/'+bus._id+'/eta',undefined,'GET');
    assert.equal(result.status,200); assert.equal(result.data.etaMinutes,null);
  }
  await Bus.updateOne({_id:bus._id},{$set:{status:'active',lastLocationUpdate:new Date(),recentSpeeds:[]}});
  assert.ok((await request('/api/buses/'+bus._id+'/eta',undefined,'GET')).data.etaMinutes>0);
});


test('a GPS request paused during reassignment loses authorization before commit', async () => {
  const {updateFleetBus}=require('../src/services/busAssignmentService');
  const replacement=await User.create({name:'Replacement',email:'replacement@qa.example',password:crypto.randomBytes(20).toString('hex'),role:'driver'});
  let release, entered;
  const gate=new Promise(resolve=>release=resolve), reached=new Promise(resolve=>entered=resolve);
  const save=Bus.prototype.save;
  let intercepted=false, pending;
  Bus.prototype.save=async function(...args) {
    if(!intercepted && String(this._id)===String(bus._id) && this.isModified('lastLocationUpdate')) {
      intercepted=true;entered();await gate;
    }
    return save.apply(this,args);
  };
  try {
    pending=location({latitude:31.417,longitude:73.078,timestamp:Date.now()});
    let timeout;
    try { await Promise.race([reached,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('GPS save not reached')),15000);})]); }
    finally {clearTimeout(timeout);}
    await updateFleetBus(String(bus._id),{driver:String(replacement._id)});
    release();
    assert.equal((await pending).status,403);
    assert.equal(String((await Bus.findById(bus._id)).driver),String(replacement._id));
  } finally {
    release();if(pending)await pending;Bus.prototype.save=save;
    await updateFleetBus(String(bus._id),{driver:String(driver._id)});
  }
});

test('a delayed GPS save cannot publish after its shift completes', async () => {
  let release, entered;
  const gate = new Promise(resolve => release = resolve);
  const reached = new Promise(resolve => entered = resolve);
  const save = Bus.prototype.save;
  let intercepted = false;
  Bus.prototype.save = async function(...args) {
    if (!intercepted && String(this._id)===String(bus._id) && this.isModified('lastLocationUpdate')) {
      intercepted = true; entered(); await gate;
    }
    return save.apply(this,args);
  };
  let pending;
  try {
    pending = location({latitude:31.417,longitude:73.078,timestamp:Date.now()});
    let timeout;
    try { await Promise.race([reached,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('GPS save was not reached')),15000);})]); }
    finally { clearTimeout(timeout); }
    assert.equal((await request('/api/buses/assigned/end-shift',undefined,'POST')).status,200);
    release();
    assert.equal((await pending).status,409);
    assert.equal((await Bus.findById(bus._id)).status,'idle');
    assert.equal(await Shift.countDocuments({bus:bus._id,status:'active'}),0);
  } finally { release(); if (pending) await pending; Bus.prototype.save=save; }
}, {timeout:60000});

test('starting another shift invalidates previous GPS freshness and speed history', async () => {
  await Bus.updateOne({_id:bus._id},{$set:{lastLocationUpdate:new Date(),recentSpeeds:[50]}});
  assert.equal((await request('/api/buses/assigned/start-shift',undefined,'POST')).status,201);
  const saved=await Bus.findById(bus._id);
  assert.equal(saved.lastLocationUpdate,null); assert.deepEqual([...saved.recentSpeeds],[]);
  const beforeShift = Date.now()-10000;
  assert.equal((await location({latitude:31.4,longitude:73.07,timestamp:beforeShift})).status,422);
  const accepted=await location({latitude:31.4,longitude:73.07,speed:15});
  assert.equal(accepted.status,200); // legacy clients remain compatible
});
