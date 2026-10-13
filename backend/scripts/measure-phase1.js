// Read-only comparison against the original Phase 1 baseline handlers; no fixture writes.
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
const express = require('express');
const http = require('http');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');
const { performance } = require('perf_hooks');
const { app, io } = require('../src/server');
function original(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const source = execFileSync('git', ['show', '22deed35f23b61f7e66457c8c0e7dc21dea2a2a2:backend/' + relative], { encoding: 'utf8' });
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(source, filename);
  return loaded.exports;
}
const before = express();
before.get('/api/routes', original('src/controllers/routeController.js').getRoutes);
before.get('/api/buses', original('src/controllers/busController.js').getBuses);
const servers = [http.createServer(before), http.createServer(app)];
function request(server, endpoint, encoding) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const req = http.get({ host: '127.0.0.1', port: server.address().port, path: endpoint, headers: { 'Accept-Encoding': encoding } }, (res) => {
      let bytes = 0;
      res.on('data', (chunk) => { bytes += chunk.length; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('Unexpected status ' + res.statusCode));
        resolve({ bytes, ms: Math.round((performance.now() - started) * 100) / 100, encoding: res.headers['content-encoding'] || 'identity' });
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
  });
}
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
    for (const server of servers) await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const result = {};
    for (const endpoint of ['/api/routes', '/api/buses']) {
      result[endpoint] = {};
      for (const [label, server, encoding] of [['before', servers[0], 'identity'], ['after', servers[1], 'identity'], ['afterGzip', servers[1], 'gzip']]) {
        await request(server, endpoint, encoding); // Warm-up excluded.
        const samples = [];
        for (let i = 0; i < 3; i += 1) samples.push(await request(server, endpoint, encoding));
        result[endpoint][label] = { bytes: samples[0].bytes, encoding: samples[0].encoding,
          medianMs: samples.map((s) => s.ms).sort((a,b) => a-b)[1], samplesMs: samples.map((s) => s.ms) };
      }
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.log('Measurement unavailable: ' + (error.code || error.name)); process.exitCode = 1; }
  finally {
    for (const server of servers) if (server.listening) await new Promise((resolve) => server.close(resolve));
    io.close();
    await mongoose.disconnect();
  }
})();
