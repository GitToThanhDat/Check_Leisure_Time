const assert = require('assert');
const S = require('../js/schedule.js');
let n = 0; const t = (name, f) => { f(); n++; console.log('ok -', name); };

t('strToMin', () => {
  assert.equal(S.strToMin('07:30'), 450); assert.equal(S.strToMin('7h30'), 450); assert.equal(S.strToMin('24:00'), 1440);
  assert.equal(S.strToMin('7h'), 420); assert.equal(S.strToMin('1:15 PM'), 13 * 60 + 15); assert.ok(isNaN(S.strToMin('abc')));
});
t('dow/startOfWeek (2026-11-23 là Thứ 2)', () => {
  assert.equal(S.dow('2026-11-23'), 0); assert.equal(S.dow('2026-11-29'), 6);
  assert.equal(S.startOfWeek('2026-11-26'), '2026-11-23');
});
const sleep = { rec: { a: { d: 127, s: 22 * 60, e: 6 * 60, st: 'busy', lb: 'Ngủ' } } };
t('ngủ qua đêm: tối ngày D và sáng ngày D+1', () => {
  const r = S.resolveDay(sleep, '2026-11-24');
  assert.equal(r[0].st, 'busy'); assert.equal(r[11].st, 'busy'); assert.equal(r[12], null);
  assert.equal(r[43], null); assert.equal(r[44].st, 'busy'); assert.equal(r[47].lb, 'Ngủ');
});
t('rec có from/to', () => {
  const s = { rec: { a: { d: 1, s: 420, e: 555, st: 'busy', lb: 'Học', from: '2026-09-07', to: '2026-12-20' } } };
  assert.equal(S.resolveDay(s, '2026-11-23')[14].st, 'busy');   // T2 trong kỳ
  assert.equal(S.resolveDay(s, '2026-12-28')[14], null);        // ngoài kỳ
  assert.equal(S.resolveDay(s, '2026-11-24')[14], null);        // T3
  assert.equal(S.resolveDay(s, '2026-11-23')[18].st, 'busy');   // 9:00-9:30 chạm 9:15 => bận
  assert.equal(S.resolveDay(s, '2026-11-23')[19], null);
});
t('tô rảnh đè lên ngủ rồi xoá (che)', () => {
  let sc = JSON.parse(JSON.stringify(sleep));
  sc.one = { '2026-11-24': S.paintDay(sc, '2026-11-24', 0, 120, 'free') };
  let r = S.resolveDay(sc, '2026-11-24');
  assert.equal(r[0].st, 'free'); assert.equal(r[3].st, 'free'); assert.equal(r[4].st, 'busy');
  sc.one['2026-11-24'] = S.paintDay(sc, '2026-11-24', 0, 60, 'erase');
  r = S.resolveDay(sc, '2026-11-24');
  assert.equal(r[0], null); assert.equal(r[1], null); assert.equal(r[2].st, 'free');
});
t('paint gộp block liền kề & cắt block cũ', () => {
  let sc = { one: {} };
  sc.one.d = S.paintDay(sc, 'd', 600, 720, 'busy');
  sc.one.d = S.paintDay(sc, 'd', 720, 780, 'busy');
  assert.equal(Object.keys(sc.one.d).length, 1);
  sc.one.d = S.paintDay(sc, 'd', 660, 690, 'free');
  const v = Object.values(sc.one.d).sort((a, b) => a.s - b.s);
  assert.deepEqual(v.map(x => [x.s, x.e, x.st]), [[600, 660, 'busy'], [660, 690, 'free'], [690, 780, 'busy']]);
  sc.one.d = S.paintDay(sc, 'd', 600, 780, 'erase');
  assert.equal(sc.one.d, null);
});
t('findWindows: chung 2 người', () => {
  const A = { one: { '2026-11-23': S.paintDay({}, '2026-11-23', 18 * 60, 22 * 60, 'free') } };
  const B = { one: { '2026-11-23': S.paintDay({}, '2026-11-23', 19 * 60, 23 * 60, 'maybe') } };
  const m = { A, B };
  let w = S.findWindows({ members: ['A', 'B'], schedOf: id => m[id], from: '2026-11-23', days: 1, mode: 'flex', minDur: 60 });
  assert.equal(w.length, 1); assert.equal(w[0].s, 19 * 60); assert.equal(w[0].e, 22 * 60);
  w = S.findWindows({ members: ['A', 'B'], schedOf: id => m[id], from: '2026-11-23', days: 1, mode: 'strict', minDur: 60 });
  assert.equal(w.length, 0);
  w = S.findWindows({ members: ['A', 'B'], schedOf: id => m[id], from: '2026-11-23', days: 1, mode: 'strict', minDur: 60, minPeople: 1 });
  assert.deepEqual(w.map(x => [x.s, x.e, x.who.join()]), [[1080, 1320, 'A']]);
  w = S.findWindows({ members: ['A', 'B'], schedOf: id => m[id], from: '2026-11-23', days: 1, mode: 'flex', minDur: 60, fromMin: 20 * 60, toMin: 21 * 60 + 30 });
  assert.equal(w.length, 1); assert.equal(w[0].s, 1200); assert.equal(w[0].e, 1290);
});
t('parseImport: fence, alias, qua đêm', () => {
  const txt = 'Đây nhé:\n```json\n{"recurring":[{"days":["mon","T4"],"start":"7h","end":"09:15","status":"Bận","label":"NWC","from":"07/09/2026"}],' +
    '"events":[{"date":"25/11/2026","start":"22:00","end":"02:00","status":"free","label":"Cày game"}]}\n```';
  const r = S.parseImport(txt);
  assert.ok(r.ok, JSON.stringify(r)); assert.equal(r.rec[0].d, 1 | 4); assert.equal(r.rec[0].from, '2026-09-07');
  assert.equal(r.one['2026-11-25'][0].e, 1440); assert.equal(r.one['2026-11-26'][0].e, 120);
});
t('parseImport: lỗi', () => {
  assert.ok(!S.parseImport('hello').ok); assert.ok(!S.parseImport('{"a":1}').ok);
  const r = S.parseImport('{"events":[{"date":"xx","start":"1","end":"2"}]}'); assert.ok(!r.ok); assert.ok(r.warnings.length);
});
console.log(n + ' tests passed');
