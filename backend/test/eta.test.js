const test = require('node:test');
const assert = require('node:assert/strict');
const { estimateEtaMinutes } = require('../src/utils/eta');
test('ETA preserves km and km/h conversion and the no-samples fallback', () => {
  assert.equal(estimateEtaMinutes(2, [20, 40]), 4);
  assert.equal(estimateEtaMinutes(2, []), 6);
});
test('ETA is unavailable for stationary, invalid and extremely long estimates', () => {
  for (const speeds of [[0], [0.1, 0.2], [-2], [Infinity], ['20'], [900]]) assert.equal(estimateEtaMinutes(3, speeds), null);
  assert.equal(estimateEtaMinutes(300, [20]), null);
  assert.equal(estimateEtaMinutes(NaN, [20]), null);
  assert.equal(estimateEtaMinutes(-1, [20]), null);
});
