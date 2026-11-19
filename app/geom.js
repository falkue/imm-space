// IMM Raumplaner – gemeinsame Geometrie für Seite (wird beim Bau eingebettet) und Kommandozeile (node).
// Meter, x rechts, y unten; rot in Grad im Uhrzeigersinn; Stück lokal: b entlang x, t entlang y, Vorderseite +y.

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
const cm = m => Math.round(m * 100);
const f3 = x => Math.round(x * 1000) / 1000;

/* ---------- Vektoren ---------- */
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = a => Math.hypot(a[0], a[1]);
const nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const perp = a => [-a[1], a[0]];
const rotv = (p, deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
function inPoly(pt, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
const polyArea = p => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
function satOverlap(A, B, eps = 0.004) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const e = sub(P[(i + 1) % P.length], P[i]); const ax = [-e[1], e[0]];
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const p of A) { const d = dot(p, ax); a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const p of B) { const d = dot(p, ax); b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      const L = len(ax);
      if (a1 <= b0 + eps * L || b1 <= a0 + eps * L) return false;
    }
  }
  return true;
}
function segClosest(p, a, b) { const ab = sub(b, a); const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1))); return add(a, mul(ab, t)); }
function polyClosest(A, B) {
  let best = { d: Infinity };
  const run = (P, Q, flip) => {
    for (const p of P) for (let i = 0; i < Q.length; i++) {
      const q = segClosest(p, Q[i], Q[(i + 1) % Q.length]); const d = len(sub(p, q));
      if (d < best.d) best = flip ? { d, pa: q, pb: p } : { d, pa: p, pb: q };
    }
  };
  run(A, B, false); run(B, A, true); return best;
}
const bbox = P => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; };
const bbHit = (a, b, m = 0) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;

const FALLBACK = { id: '?', name: 'Unbekanntes Stück', typ: 'geraet', b: .5, t: .5, h: .5, farbe: '#999999' };
const ROUND = new Set(['rundtisch', 'pflanze']);
// Stühle dürfen unter Tische geschoben werden
const SEAT = new Set(['stuhl', 'buerostuhl']), TABLE = new Set(['tisch', 'rundtisch']);
const mayOverlap = (a, b) => (SEAT.has(a.typ) && TABLE.has(b.typ)) || (SEAT.has(b.typ) && TABLE.has(a.typ));

/* ---------- Raum vorbereiten ---------- */
function prepRoom(raum) {
  const zones = (raum.zonen || []).map(z => ({ ...z, area: polyArea(z.polygon) }));
  const inside = pt => zones.length ? zones.some(z => inPoly(pt, z.polygon)) : true;
  const walls = (raum.waende || []).map(w => {
    const d = nrm(sub(w.b, w.a)), L = len(sub(w.b, w.a)), n = perp(d), t = w.dicke;
    return { ...w, d, n, L, t };
  });
  for (const w of walls) {
    const joined = P => walls.some(o => o !== w && (len(sub(o.a, P)) < .02 || len(sub(o.b, P)) < .02));
    w.j0 = joined(w.a); w.j1 = joined(w.b);
    w.e0 = w.j0 ? w.t / 2 : 0; w.e1 = w.j1 ? w.t / 2 : 0;
    const mid = add(w.a, mul(w.d, w.L / 2)), off = w.t / 2 + .3;
    w.side = inside(add(mid, mul(w.n, off))) ? 1 : inside(add(mid, mul(w.n, -off))) ? -1 : 1;
    w.nIn = mul(w.n, w.side);
  }
  const at = (w, s, o = 0) => add(add(w.a, mul(w.d, s)), mul(w.n, o));
  const rectAlong = (w, s0, s1) => [at(w, s0, -w.t / 2), at(w, s1, -w.t / 2), at(w, s1, w.t / 2), at(w, s0, w.t / 2)];
  const openings = (raum.oeffnungen || []).map(o => {
    const w = walls.find(x => x.id === o.wand); if (!w) return null;
    const s0 = o.pos, s1 = o.pos + o.breite, p0 = at(w, s0), p1 = at(w, s1);
    const r = { ...o, w, s0, s1, p0, p1, mid: mul(add(p0, p1), .5), poly: rectAlong(w, s0, s1) };
    if (o.typ === 'tuer') {
      const nIn = o.oeffnet === 'aussen' ? mul(w.nIn, -1) : w.nIn;
      const right = [nIn[1], -nIn[0]];
      const p1Right = dot(sub(p1, p0), right) > 0;
      const hingeAtP1 = p1Right === (o.anschlag === 'rechts');
      const face = mul(nIn, w.t / 2);
      const H = add(hingeAtP1 ? p1 : p0, face), O = add(hingeAtP1 ? p0 : p1, face);
      const u = nrm(sub(O, H)), bw = o.breite;
      const swing = [H];
      for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI / 2; swing.push(add(H, add(mul(u, Math.cos(a) * bw), mul(nIn, Math.sin(a) * bw)))); }
      Object.assign(r, { nIn, H, O, u, swing, leafEnd: add(H, mul(nIn, bw)) });
    }
    return r;
  }).filter(Boolean);
  // Wandstücke ohne Öffnungen
  const wallSegs = [];
  for (const w of walls) {
    const ops = openings.filter(o => o.w === w).sort((a, b) => a.s0 - b.s0);
    let s = -w.e0;
    for (const o of ops) { if (o.s0 > s + 1e-4) wallSegs.push({ w, s0: s, s1: o.s0, poly: rectAlong(w, s, o.s0) }); s = Math.max(s, o.s1); }
    if (w.L + w.e1 > s + 1e-4) wallSegs.push({ w, s0: s, s1: w.L + w.e1, poly: rectAlong(w, s, w.L + w.e1) });
  }
  const cols = (raum.stuetzen || []).map(c => ({ ...c, poly: [[c.x - c.b / 2, c.y - c.t / 2], [c.x + c.b / 2, c.y - c.t / 2], [c.x + c.b / 2, c.y + c.t / 2], [c.x - c.b / 2, c.y + c.t / 2]] }));
  const allPts = [...wallSegs.flatMap(s => s.poly), ...openings.flatMap(o => o.poly), ...zones.flatMap(z => z.polygon)];
  const bounds = allPts.length ? bbox(allPts) : { x0: 0, y0: 0, x1: 10, y1: 8 };
  const obstacles = [
    ...wallSegs.map(s => ({ kind: 'Wand', poly: s.poly, bb: bbox(s.poly) })),
    ...openings.filter(o => o.typ === 'fenster').map(o => ({ kind: 'Wand', poly: o.poly, bb: bbox(o.poly) })),
    ...cols.map(c => ({ kind: 'Stütze', poly: c.poly, bb: bbox(c.poly) })),
    ...openings.filter(o => o.typ === 'tuer').map(o => ({ kind: 'Türschwenk', poly: o.swing, bb: bbox(o.swing) }))
  ];
  // Einrast-Flächen: Wandseiten (aussen-Normale zeigt vom Wandkörper weg)
  const faces = [];
  for (const w of walls) for (const s of [1, -1]) {
    const n = mul(w.n, s); faces.push({ p: add(w.a, mul(n, w.t / 2)), n, d: w.d, s0: -w.e0, s1: w.L + w.e1, o: w.a });
  }
  for (const c of cols) faces.push(...polyFaces(c.poly));
  return { walls, openings, wallSegs, cols, zones, bounds, obstacles, faces, H: raum.geschosshoehe?.wert ?? 2.8, area: zones.reduce((s, z) => s + z.area, 0) };
}
function polyFaces(P) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], e = sub(b, a), L = len(e); if (L < .05) continue;
    const d = mul(e, 1 / L), n = [d[1], -d[0]];
    out.push({ p: a, n, d, s0: 0, s1: L, o: a });
  }
  return out;
}

/* ---------- Stück-Geometrie ---------- */
function localPoly(st) {
  const hb = st.b / 2, ht = st.t / 2;
  if (ROUND.has(st.typ)) { const P = []; for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; P.push([Math.cos(a) * hb, Math.sin(a) * ht]); } return P; }
  return [[-hb, -ht], [hb, -ht], [hb, ht], [-hb, ht]];
}
const itemPoly = (M, p) => localPoly(M.piece(p.stueck)).map(q => add(rotv(q, p.rot), [p.x, p.y]));

/* ---------- 2D-Zeichnung ---------- */
function glyph(st, u) {
  const hb = st.b / 2, ht = st.t / 2, c = esc(st.farbe || '#aaa'), sw = (1.1 * u).toFixed(4), thin = (.9 * u).toFixed(4);
  const R = (x, y, w, h, cls, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${cls}" ${extra}/>`;
  const base = (rx = 0) => R(-hb, -ht, st.b, st.t, 'ib', `fill="${c}" stroke-width="${sw}" rx="${rx}"`);
  const L = (x1, y1, x2, y2, extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ig" stroke-width="${thin}" ${extra}/>`;
  switch (st.typ) {
    case 'rundtisch': return `<ellipse rx="${hb}" ry="${ht}" class="ib" fill="${c}" stroke-width="${sw}"/>`;
    case 'pflanze': return `<ellipse rx="${hb}" ry="${ht}" class="ib" fill="${c}" stroke-width="${sw}"/><ellipse rx="${hb * .42}" ry="${ht * .42}" class="ig" stroke-width="${thin}"/>` +
      [0, 60, 120].map(a => { const [dx, dy] = rotv([hb * .9, 0], a); return L(-dx, -dy * ht / hb, dx, dy * ht / hb); }).join('');
    case 'stuhl': return base(.04) + R(-hb, -ht, st.b, Math.min(.08, st.t * .2), 'ish');
    case 'buerostuhl': return `<ellipse rx="${hb}" ry="${ht}" class="ig" stroke-width="${thin}" stroke-dasharray="${2 * u} ${2 * u}"/>` +
      R(-hb * .78, -ht * .7, st.b * .78, st.t * .78, 'ib', `fill="${c}" stroke-width="${sw}" rx="${.06}"`) + R(-hb * .72, -ht * .78, st.b * .72, .09, 'ish', `rx=".03"`);
    case 'sofa': case 'sessel': { const ab = Math.min(.16, st.b * .18), bk = Math.min(.22, st.t * .26);
      return base(.05) + R(-hb, -ht, st.b, bk, 'ish') + R(-hb, -ht + bk, ab, st.t - bk, 'ish') + R(hb - ab, -ht + bk, ab, st.t - bk, 'ish'); }
    case 'schrank': return base() + L(-hb, -ht, hb, ht) + L(-hb, ht, hb, -ht);
    case 'regal': return base() + L(-hb + .03, ht - .03, hb - .03, ht - .03, `stroke-dasharray="${3 * u} ${2 * u}"`) + L(0, -ht, 0, ht);
    case 'sideboard': case 'rollcontainer': return base() + L(-hb + .02, ht - .04, hb - .02, ht - .04);
    case 'geraet': return base(.03) + R(-hb * .6, -ht * .6, st.b * .6, st.t * .6, 'ig', `stroke-width="${thin}"`);
    case 'whiteboard': return R(-hb, -ht, st.b, st.t, 'ig', `stroke-width="${thin}" stroke-dasharray="${3 * u} ${3 * u}"`) + R(-hb, -.025, st.b, .05, 'ib', `fill="${c}" stroke-width="${sw}"`);
    default: return base(.02);
  }
}

function dimLine(a, b, label, u, cls = 'dim', off = 0) {
  const d = nrm(sub(b, a)), n = perp(d), t = 4 * u;
  const A = add(a, mul(n, off)), B = add(b, mul(n, off)), M = mul(add(A, B), .5);
  let ang = Math.atan2(d[1], d[0]) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
  const tick = P => `<line x1="${P[0] - n[0] * t + d[0] * t * .7}" y1="${P[1] - n[1] * t + d[1] * t * .7}" x2="${P[0] + n[0] * t - d[0] * t * .7}" y2="${P[1] + n[1] * t - d[1] * t * .7}" class="${cls}" stroke-width="${u * 1.1}"/>`;
  const fs = 10.5 * u;
  return `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" class="${cls}" stroke-width="${u * .9}"/>${tick(A)}${tick(B)}` +
    `<text x="${M[0]}" y="${M[1]}" transform="rotate(${ang} ${M[0]} ${M[1]}) translate(0 ${-3 * u})" text-anchor="middle" font-size="${fs}" class="${cls}t" stroke-width="${3 * u}">${esc(label)}</text>`;
}

function selDistances(M, platz, p, u) {
  const poly = itemPoly(M, p), c = [p.x, p.y], st = M.piece(p.stueck);
  const others = [...M.R.obstacles.filter(o => o.kind !== 'Türschwenk').map(o => o.poly), ...platz.filter(q => q.uid !== p.uid).map(q => itemPoly(M, q))];
  const best = {};
  for (const O of others) {
    if (satOverlap(poly, O, 0)) continue;
    const r = polyClosest(poly, O); if (r.d > 4 || r.d < .005) continue;
    const loc = rotv(sub(r.pa, c), -p.rot);
    const key = Math.abs(loc[0]) / (st.b / 2) > Math.abs(loc[1]) / (st.t / 2) ? (loc[0] > 0 ? 'r' : 'l') : (loc[1] > 0 ? 'f' : 'h');
    if (!best[key] || r.d < best[key].d) best[key] = r;
  }
  return Object.values(best).map(r => dimLine(r.pa, r.pb, cm(r.d) + ' cm', u, 'seldim')).join('');
}

function renderPlan(M, v, ctx) {
  const { u, interactive } = ctx, o = ctx.opts, R = M.R, out = [], piece = M.piece, hits = ctx.hits || new Map();
  const b = R.bounds;
  for (const z of R.zones) out.push(`<polygon points="${z.polygon.map(p => p.join(',')).join(' ')}" class="zone"/>`);
  if (o.grid) {
    const x0 = Math.floor(b.x0) - 1, x1 = Math.ceil(b.x1) + 1, y0 = Math.floor(b.y0) - 1, y1 = Math.ceil(b.y1) + 1, g = [];
    const step = ctx.k > 28 ? .5 : 1;
    for (let x = x0; x <= x1 + 1e-6; x += step) g.push(`<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" class="${Math.abs(x % 1) < 1e-6 ? 'gma' : 'gmi'}" stroke-width="${u * .8}"/>`);
    for (let y = y0; y <= y1 + 1e-6; y += step) g.push(`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" class="${Math.abs(y % 1) < 1e-6 ? 'gma' : 'gmi'}" stroke-width="${u * .8}"/>`);
    out.push(`<g>${g.join('')}</g>`);
  }
  if (ctx.zoneLabels !== false) for (const z of R.zones) {
    const bb = bbox(z.polygon); out.push(`<text x="${bb.x0 + .5}" y="${bb.y0 + .62}" text-anchor="start" font-size="${10 * u}" class="zlbl">${esc(z.name)} · ${num(z.area, 1)} m²</text>`);
  }
  if (o.swing) for (const d of R.openings.filter(d => d.typ === 'tuer')) out.push(`<polygon points="${d.swing.map(p => p.join(',')).join(' ')}" class="swing"/>`);
  for (const s of R.wallSegs) out.push(`<polygon points="${s.poly.map(p => p.join(',')).join(' ')}" class="wall"/>`);
  for (const w of R.openings) {
    if (w.typ === 'fenster') {
      out.push(`<polygon points="${w.poly.map(p => p.join(',')).join(' ')}" class="win" stroke-width="${u}"/>`);
      const ln = off => { const a = add(w.p0, mul(w.w.n, off)), c = add(w.p1, mul(w.w.n, off)); return `<line x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}" class="winl" stroke-width="${u * .9}"/>`; };
      out.push(ln(-w.w.t / 8) + ln(w.w.t / 8));
    } else {
      const r = w.breite, sa = add(w.H, mul(w.u, r));
      out.push(`<line x1="${w.H[0]}" y1="${w.H[1]}" x2="${w.leafEnd[0]}" y2="${w.leafEnd[1]}" class="leaf" stroke-width="${u * 2}"/>`);
      const sweep = (w.u[0] * w.nIn[1] - w.u[1] * w.nIn[0]) > 0 ? 1 : 0;
      out.push(`<path d="M${sa[0]} ${sa[1]} A${r} ${r} 0 0 ${sweep} ${w.leafEnd[0]} ${w.leafEnd[1]}" class="arc" stroke-width="${u}" stroke-dasharray="${4 * u} ${3 * u}"/>`);
    }
  }
  for (const c of R.cols) out.push(`<polygon points="${c.poly.map(p => p.join(',')).join(' ')}" class="col"/>`);
  if (o.dims) {
    for (const w of R.walls) {
      const L = w.L - (w.j0 ? w.t / 2 : 0) - (w.j1 ? w.t / 2 : 0); if (L < .8) continue;
      const A = add(add(w.a, mul(w.d, w.j0 ? w.t / 2 : 0)), mul(w.nIn, w.t / 2 + .28)), B = add(add(w.b, mul(w.d, w.j1 ? -w.t / 2 : 0)), mul(w.nIn, w.t / 2 + .28));
      out.push(dimLine(A, B, num(L) + ' m', u));
    }
    for (const w of R.openings) {
      const A = add(w.p0, mul(w.w.nIn, -w.w.t / 2 - .22)), B = add(w.p1, mul(w.w.nIn, -w.w.t / 2 - .22));
      out.push(dimLine(A, B, (w.typ === 'tuer' ? 'Tür ' : 'Fenster ') + num(w.breite) + ' m', u));
    }
  }
  // Inventar
  const labels = [];
  for (const p of v.platzierungen) {
    const st = piece(p.stueck), hit = hits.has(p.uid) && ctx.showHits !== false, sel = interactive && ctx.sel === p.uid;
    let g = `<g ${interactive ? `data-act="item" data-uid="${p.uid}"` : ''} transform="translate(${f3(p.x)} ${f3(p.y)}) rotate(${p.rot})">${glyph(st, u)}`;
    if (hit) g += ROUND.has(st.typ) ? `<ellipse rx="${st.b / 2}" ry="${st.t / 2}" class="hitbox" stroke-width="${2 * u}"/>` : `<rect x="${-st.b / 2}" y="${-st.t / 2}" width="${st.b}" height="${st.t}" class="hitbox" stroke-width="${2 * u}"/>`;
    if (sel) {
      const m = 4 * u, hy = -st.t / 2 - 30 * u;
      g += `<rect x="${-st.b / 2 - m}" y="${-st.t / 2 - m}" width="${st.b + 2 * m}" height="${st.t + 2 * m}" class="selbox" stroke-width="${1.6 * u}" stroke-dasharray="${5 * u} ${3 * u}"/>`;
      g += `<line x1="0" y1="${-st.t / 2 - m}" x2="0" y2="${hy}" class="hline" stroke-width="${1.4 * u}"/><circle cy="${hy}" r="${7 * u}" class="handle" stroke-width="${2 * u}"/>`;
      g += `<circle cy="${hy}" r="${18 * u}" fill="transparent" data-act="rot" data-uid="${p.uid}"/>`;
    }
    out.push(g + '</g>');
    if (o.labels && st.b / u > 46) labels.push(`<text x="${p.x}" y="${p.y + 3.5 * u}" text-anchor="middle" font-size="${10 * u}" class="lbl" stroke-width="${3 * u}" pointer-events="none">${esc(shortName(st.name, st.b / u))}</text>`);
  }
  out.push(...labels);
  if (interactive && ctx.sel && o.dims) { const p = v.platzierungen.find(q => q.uid === ctx.sel); if (p) out.push(selDistances(M, v.platzierungen, p, u)); }
  return out.join('');
}
const shortName = (n, px) => { const max = Math.max(4, Math.floor(px / 6.2)); return n.length > max ? n.slice(0, max - 1) + '…' : n; };

const EXPORT_CSS = `.zone{fill:#ffffff}.gmi{stroke:#edf0f2}.gma{stroke:#dde2e6}.wall,.col{fill:#22282d}.win{fill:#d6e7f2;stroke:#22282d}.winl{stroke:#22282d}
.leaf{stroke:#22282d}.arc{stroke:#7a858e;fill:none}.swing{fill:rgba(0,100,166,.07)}.ib{stroke:#22282d}.ig{stroke:#22282d;fill:none;opacity:.55}.ish{fill:rgba(0,0,0,.28)}
.hitbox{stroke:#c0392b;fill:rgba(192,57,43,.12)}.lbl{fill:#1c2227;stroke:#ffffff;paint-order:stroke;font-family:'IBM Plex Sans',Helvetica,Arial,sans-serif}
.zlbl{fill:#6d7882;font-family:'IBM Plex Sans',Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}
.dim{stroke:#6d7882}.dimt{fill:#5b6670;stroke:#ffffff;paint-order:stroke;font-family:'IBM Plex Mono',Menlo,Courier,monospace}
.t{font-family:'IBM Plex Sans',Helvetica,Arial,sans-serif;fill:#1c2227}.m{font-family:'IBM Plex Mono',Menlo,Courier,monospace;fill:#5b6670}`;

/* ---------- Modell, Kollisionen, Einrasten ---------- */
function makeModel(raum, kat) {
  const byId = Object.fromEntries((kat.stuecke || []).map(s => [s.id, s]));
  return { raum, kat, byId, piece: id => byId[id] || { ...FALLBACK, id }, R: prepRoom(raum) };
}
function computeHits(M, platz) {
  const hits = new Map(), piece = M.piece;
  const P = platz.map(p => { const poly = itemPoly(M, p); return { p, poly, bb: bbox(poly) }; });
  const mark = (u, why) => { if (!hits.has(u)) hits.set(u, new Set()); hits.get(u).add(why); };
  for (let i = 0; i < P.length; i++) {
    for (let j = i + 1; j < P.length; j++) if (bbHit(P[i].bb, P[j].bb) && !mayOverlap(piece(P[i].p.stueck), piece(P[j].p.stueck)) && satOverlap(P[i].poly, P[j].poly)) { mark(P[i].p.uid, piece(P[j].p.stueck).name); mark(P[j].p.uid, piece(P[i].p.stueck).name); }
    for (const o of M.R.obstacles) if (bbHit(P[i].bb, o.bb) && satOverlap(P[i].poly, o.poly)) mark(P[i].p.uid, o.kind);
  }
  return hits;
}
function snapPos(M, platz, p, raw, thr, enabled = true) {
  let x = raw[0], y = raw[1];
  if (!enabled) return [x, y];
  const g = 0.05; x = Math.round(x / g) * g; y = Math.round(y / g) * g;
  const poly = itemPoly(M, { ...p, x, y }), c = [x, y];
  const faces = [...M.R.faces];
  for (const q of platz) if (q.uid !== p.uid && !ROUND.has(M.piece(q.stueck).typ)) faces.push(...polyFaces(itemPoly(M, q)));
  const cands = [];
  for (const f of faces) {
    if (dot(sub(c, f.p), f.n) <= 0) continue;
    let m = Infinity; for (const q of poly) m = Math.min(m, dot(sub(q, f.p), f.n));
    if (m > thr || m < -thr) continue;
    let a0 = Infinity, a1 = -Infinity; for (const q of poly) { const s = dot(sub(q, f.o), f.d); a0 = Math.min(a0, s); a1 = Math.max(a1, s); }
    if (a1 < f.s0 + .02 || a0 > f.s1 - .02) continue;
    cands.push({ m, n: f.n });
  }
  cands.sort((a, b) => Math.abs(a.m) - Math.abs(b.m));
  if (cands[0]) {
    const a = cands[0]; x -= a.m * a.n[0]; y -= a.m * a.n[1];
    const b = cands.find(q => Math.abs(dot(q.n, a.n)) < .3);
    if (b) { x -= b.m * b.n[0]; y -= b.m * b.n[1]; }
  }
  return [x, y];
}

/* ---------- Bewertung einer Variante (für Seite und Kommandozeile) ---------- */
// Liefert Kennzahlen und Befunde: Überschneidungen, Stücke ausserhalb des Raums, Bestand überschritten,
// enge Durchgänge (lichter Abstand 30 cm bis `gang` Meter zwischen zwei Stücken oder Stück und Wand; kleinere Spalten gelten als gewollt).
function analyse(M, v, { gang = 0.8 } = {}) {
  const pl = v.platzierungen || [], piece = M.piece, R = M.R;
  const hits = computeHits(M, pl);
  const inside = pt => R.zones.length ? R.zones.some(z => inPoly(pt, z.polygon)) : true;
  const ausserhalb = [], unbekannt = [], enge = [];
  const polys = pl.map(p => itemPoly(M, p));
  pl.forEach((p, i) => {
    if (!M.byId[p.stueck]) unbekannt.push(p.uid);
    const c = [p.x, p.y];
    if (!polys[i].every(q => inside(add(q, mul(nrm(sub(c, q)), .02))))) ausserhalb.push(p.uid);
  });
  const solid = [...R.wallSegs.map(s => s.poly), ...R.cols.map(c => c.poly)];
  for (let i = 0; i < pl.length; i++) {
    const si = piece(pl[i].stueck); if (SEAT.has(si.typ)) continue;
    for (let j = i + 1; j < pl.length; j++) {
      const sj = piece(pl[j].stueck); if (SEAT.has(sj.typ)) continue;
      if (satOverlap(polys[i], polys[j], 0)) continue;
      const r = polyClosest(polys[i], polys[j]);
      if (r.d > .3 && r.d < gang) enge.push({ a: pl[i].uid, b: pl[j].uid, abstand: Math.round(r.d * 100) / 100, zwischen: `${si.name} – ${sj.name}` });
    }
    for (const W of solid) { if (satOverlap(polys[i], W, 0)) continue; const r = polyClosest(polys[i], W); if (r.d > .3 && r.d < gang) enge.push({ a: pl[i].uid, b: null, abstand: Math.round(r.d * 100) / 100, zwischen: `${si.name} – Wand/Stütze` }); }
  }
  const used = {}; for (const p of pl) used[p.stueck] = (used[p.stueck] || 0) + 1;
  const bestand = Object.entries(used).map(([id, n]) => ({ stueck: id, name: piece(id).name, gesetzt: n, vorhanden: piece(id).anzahl ?? null }));
  const je_typ = {}; for (const p of pl) { const t = piece(p.stueck).typ; je_typ[t] = (je_typ[t] || 0) + 1; }
  const flaeche = pl.reduce((s, p) => { const st = piece(p.stueck); return s + (ROUND.has(st.typ) ? Math.PI * st.b * st.t / 4 : st.b * st.t); }, 0);
  return {
    stuecke: pl.length, je_typ,
    arbeitsplaetze: pl.filter(p => piece(p.stueck).typ === 'buerostuhl').length,
    sitzplaetze: pl.filter(p => ['stuhl', 'buerostuhl', 'sessel'].includes(piece(p.stueck).typ)).length + pl.filter(p => piece(p.stueck).typ === 'sofa').length * 3,
    belegung_prozent: R.area ? Math.round(flaeche / R.area * 1000) / 10 : null,
    ueberschneidungen: [...hits].map(([uid, s]) => ({ uid, name: piece(pl.find(p => p.uid === uid).stueck).name, mit: [...s] })),
    ausserhalb, unbekannt, enge,
    bestand_ueberschritten: bestand.filter(b => b.vorhanden != null && b.gesetzt > b.vorhanden),
    bestand
  };
}

export { esc, num, cm, f3, add, sub, mul, dot, len, nrm, perp, rotv, inPoly, polyArea, satOverlap, segClosest, polyClosest, bbox, bbHit,
  FALLBACK, ROUND, SEAT, TABLE, mayOverlap, prepRoom, polyFaces, localPoly, itemPoly, glyph, dimLine, selDistances, renderPlan, shortName,
  EXPORT_CSS, makeModel, computeHits, snapPos, analyse };

