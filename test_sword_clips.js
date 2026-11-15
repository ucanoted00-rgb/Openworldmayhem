/* Teste numérico dos clipes de espada (sword-clips.js). Uso: node test_sword_clips.js
   Roda sem navegador: THREE.Quaternion mínimo (mesma matemática do r128) e OWM.ual.ORDER simulado. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');

/* ---- THREE.Quaternion mínimo (set/copy/slerp/normalize/setFromEuler XYZ, como no r128) ---- */
class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
  normalize() { let l = Math.hypot(this.x, this.y, this.z, this.w); if (l === 0) { this.set(0, 0, 0, 1) } else { l = 1 / l; this.x *= l; this.y *= l; this.z *= l; this.w *= l } return this; }
  dot(q) { return this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w; }
  slerp(qb, t) {
    if (t === 0) return this; if (t === 1) return this.copy(qb);
    const x = this.x, y = this.y, z = this.z, w = this.w;
    let c = w * qb.w + x * qb.x + y * qb.y + z * qb.z;
    if (c < 0) { this.w = -qb.w; this.x = -qb.x; this.y = -qb.y; this.z = -qb.z; c = -c } else this.copy(qb);
    if (c >= 1) { this.w = w; this.x = x; this.y = y; this.z = z; return this }
    const s2 = 1 - c * c;
    if (s2 <= Number.EPSILON) { const s = 1 - t; this.w = s * w + t * this.w; this.x = s * x + t * this.x; this.y = s * y + t * this.y; this.z = s * z + t * this.z; return this.normalize() }
    const sn = Math.sqrt(s2), ha = Math.atan2(sn, c), rA = Math.sin((1 - t) * ha) / sn, rB = Math.sin(t * ha) / sn;
    this.w = w * rA + this.w * rB; this.x = x * rA + this.x * rB; this.y = y * rA + this.y * rB; this.z = z * rA + this.z * rB;
    return this;
  }
  setFromEulerXYZ(a, b, c) {
    const c1 = Math.cos(a / 2), c2 = Math.cos(b / 2), c3 = Math.cos(c / 2), s1 = Math.sin(a / 2), s2 = Math.sin(b / 2), s3 = Math.sin(c / 2);
    this.x = s1 * c2 * c3 + c1 * s2 * s3; this.y = c1 * s2 * c3 - s1 * c2 * s3; this.z = c1 * c2 * s3 + s1 * s2 * c3; this.w = c1 * c2 * c3 - s1 * s2 * s3; return this;
  }
}
global.THREE = { Quaternion };
const ORDER = ['hip', 'upper', 'hm', 'LA', 'LE', 'RA', 'RE', 'LL', 'LK', 'RL', 'RK'];
global.window = { OWM: { ual: { ORDER } } };
require(path.join(__dirname, 'sword-clips.js'));
const SC = window.OWM.swordClips;

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FALHOU: ' + msg) } };
/* ângulo de rotação entre dois quaternions, estável perto de 0 (acos(1-ε) perde ~1e-6°): normaliza e usa a corda 4D, ângulo = 4·asin(|a−s·b|/2) */
const angleDeg = (a, b) => {
  const la = Math.hypot(a.x, a.y, a.z, a.w), lb = Math.hypot(b.x, b.y, b.z, b.w), s = (a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w) < 0 ? -1 : 1;
  const d = Math.hypot(a.x / la - s * b.x / lb, a.y / la - s * b.y / lb, a.z / la - s * b.z / lb, a.w / la - s * b.w / lb);
  return 4 * Math.asin(Math.min(1, d / 2)) * 180 / Math.PI;
};
const STRIDE = 53;

/* TS e envelope: lidos do próprio código (avatar.js / KSW), não copiados à mão */
const av = fs.readFileSync(path.join(__dirname, 'avatar.js'), 'utf8');
const tsm = av.match(/const SWORD_TS=\{lmb:([\d.]+),m1:([\d.]+),m2:([\d.]+)\}/);
assert(tsm, 'SWORD_TS não encontrado em avatar.js');
const TS = { lmb: +tsm[1], m1: +tsm[2], m2: +tsm[3] };
const ENV = [[-.12, .34], [-.34, 0], [-.72, -.2]];
const KG = av.match(/const KG=\[([^\]]+)\]/)[1].split(',').map(Number);   // KG de avatar.js: RA(x,y,z) RE(x) torso(x,y) LA(x,z) LE(x)
const guard = { RA: new Quaternion().setFromEulerXYZ(KG[0], KG[1], KG[2]), RE: new Quaternion().setFromEulerXYZ(KG[3], 0, 0),
  upper: new Quaternion().setFromEulerXYZ(KG[4], KG[5], 0), LA: new Quaternion().setFromEulerXYZ(KG[6], 0, KG[7]), LE: new Quaternion().setFromEulerXYZ(KG[8], 0, 0) };

ok(JSON.stringify(SC.order) === JSON.stringify(ORDER), 'order');
for (const id of ['lmb', 'm1', 'm2']) {
  const c = SC.clips[id]; console.log('\n[' + id + '] frames ' + c.frames + ' dur ' + c.dur.toFixed(4) + ' hit ' + c.hit.toFixed(4) + ' travel ' + c.travel + ' m  ' + c.source);
  ok(c && c.data && c.data.length === c.frames * STRIDE, id + ': tamanho dos dados');
  ok(Math.abs(c.dur - (c.frames - 1) / 30) < 1e-6, id + ': dur=(frames-1)/30');
  ok(c.hit > 0 && c.hit < c.dur, id + ': hit dentro de dur');
  ok(typeof c.travel === 'number' && c.travel >= 0 && typeof c.source === 'string', id + ': metadados travel/source');
  const d = c.data; let nan = 0, maxNormErr = 0, minW = 1, hipXZ = 0, hipYmin = 9, hipYmax = -9, maxStep = 0, maxStepBone = '', fpMax = 0;
  const qs = []; for (let f = 0; f < c.frames; f++) { const o = f * STRIDE; qs.push(ORDER.map((_, k) => new Quaternion(d[o + 3 + k * 4], d[o + 4 + k * 4], d[o + 5 + k * 4], d[o + 6 + k * 4]))) }
  for (let i = 0; i < d.length; i++) if (!Number.isFinite(d[i])) nan++;
  for (let f = 0; f < c.frames; f++) {
    const o = f * STRIDE; hipXZ = Math.max(hipXZ, Math.abs(d[o]), Math.abs(d[o + 2])); hipYmin = Math.min(hipYmin, d[o + 1]); hipYmax = Math.max(hipYmax, d[o + 1]);
    for (let k = 0; k < 11; k++) { const q = qs[f][k]; maxNormErr = Math.max(maxNormErr, Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1)); minW = Math.min(minW, q.w) }
    for (let k = 0; k < 6; k++) fpMax = Math.max(fpMax, Math.abs(d[o + 47 + k]));
    if (f) for (let k = 0; k < 11; k++) { const a = angleDeg(qs[f - 1][k], qs[f][k]); if (a > maxStep) { maxStep = a; maxStepBone = ORDER[k] + '@' + f } }
  }
  console.log('  NaN ' + nan + ' | erro de norma máx ' + maxNormErr.toExponential(2) + ' | w mín ' + minW.toFixed(4) + ' | quadril |X|,|Z| máx ' + hipXZ + ' | quadril Y [' + hipYmin.toFixed(3) + ', ' + hipYmax.toFixed(3) + '] | passo máx entre frames ' + maxStep.toFixed(1) + '° (' + maxStepBone + ') | |FP| máx ' + fpMax.toFixed(3));
  ok(nan === 0, id + ': sem NaN');
  ok(maxNormErr < 0.001, id + ': quaternions com norma 1 ± 0,001');
  ok(minW >= -1e-4, id + ': w >= 0');
  ok(hipXZ === 0, id + ': X e Z do quadril = 0 em todos os frames');
  ok(hipYmin > -0.5 && hipYmax < 0.5, id + ': Y do quadril dentro de ±0,5 m');
  ok(maxStep < 90, id + ': ângulo entre frames consecutivos < 90° por osso (sem flips)');
  ok(fpMax < 32767 / 8000, id + ': mão FP cabe em Int16/8000 (±4,09)');
  let envOut = 0; for (let f = 0; f < c.frames; f++) for (let k = 0; k < 3; k++) { const v = d[f * STRIDE + 47 + k]; if (v < ENV[k][0] - 1e-3 || v > ENV[k][1] + 1e-3) envOut++ }
  ok(envOut === 0, id + ': posição da mão FP dentro do envelope de KSW (x −0,12..0,34; y −0,34..0; z −0,72..−0,2)');
  /* acerto: tempo real depois do clique = hit/ts, entre 0,18 e 0,26 s; e com peso pleno (depois da entrada e antes da saída) */
  const hitReal = c.hit / TS[id], totReal = c.dur / TS[id];
  console.log('  acerto em ' + hitReal.toFixed(3) + ' s (TS ' + TS[id] + '), golpe total ' + totReal.toFixed(3) + ' s');
  ok(hitReal >= 0.18 && hitReal <= 0.26, id + ': acerto entre 0,18 e 0,26 s');
  ok(c.hit >= 0.12 && c.hit <= c.dur - 0.25, id + ': acerto com peso pleno (depois da entrada 0,12 s, antes da saída)');
  /* último frame x guarda KSW (blend de saída 0,2 s): distância angular por osso */
  const last = qs[c.frames - 1], first = qs[0]; const gd = {}, g0 = {};
  for (const b of Object.keys(guard)) { gd[b] = angleDeg(last[ORDER.indexOf(b)], guard[b]); g0[b] = angleDeg(first[ORDER.indexOf(b)], guard[b]) }
  const fmt = o => Object.keys(o).map(b => b + ' ' + o[b].toFixed(0) + '°').join('  ');
  console.log('  guarda x ÚLTIMO frame: ' + fmt(gd)); console.log('  guarda x PRIMEIRO frame: ' + fmt(g0));
  ok(Object.values(gd).every(a => a < 90), id + ': último frame a < 90° da guarda em todos os ossos (o blend de saída de ~0,2 s é um slerp pelo caminho curto)');
  /* amostragem: extremos, ponto médio unitário, remapeamento por nome */
  const outQ = ORDER.map(() => new Quaternion()), pos = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z } }, fp = new Array(6).fill(0);
  ok(SC.sample(id, 0, outQ, pos, fp) === true, id + ': sample(0)');
  ok(angleDeg(outQ[5], qs[0][5]) < 1e-3 && Math.abs(fp[0] - d[47]) < 1e-9, id + ': sample(0) = frame 0');
  SC.sample(id, c.dur + 5, outQ, pos, fp); ok(angleDeg(outQ[6], qs[c.frames - 1][6]) < 1e-3, id + ': sample além do fim = último frame');
  SC.sample(id, c.dur / 2, outQ, pos, fp); ok(outQ.every(q => Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-6), id + ': slerp normalizado');
  const rev = ORDER.slice().reverse(); window.OWM.ual.ORDER = rev; const rq = rev.map(() => new Quaternion()); SC.sample(id, c.dur / 3, rq, null, null);
  window.OWM.ual.ORDER = ORDER; const nq = ORDER.map(() => new Quaternion()); SC.sample(id, c.dur / 3, nq, null, null);
  ok(ORDER.every((n, k) => angleDeg(nq[k], rq[rev.indexOf(n)]) < 1e-6), id + ': remapeia os ossos por nome (ORDER do rig diferente)');
}
ok(SC.sample('nao-existe', 0, [], null, null) === false, 'clipe inexistente devolve false (avatar.js cai no KSW)');
console.log('\n' + (checks - fails) + '/' + checks + ' verificações OK' + (fails ? ', ' + fails + ' FALHARAM' : ''));
process.exit(fails ? 1 : 0);
