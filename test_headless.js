// Headless-Test v3 — neue Architektur: Airport-Liste + eigenes Routen-Panel (live)
const fs = require('fs');
const html = fs.readFileSync('MSFS_Airport_Scout.html', 'utf8');
let script = html.match(/<script>([\s\S]*)<\/script>/)[1];
script += `
;window.__t = { update, applyFilters, selectAirport, render, routeUpdate, renderRoutes, simbriefGo, focusPair, catOf, saveSb, computeWorld, worldTxt, AP, RW, LAND, META, byIcao, distKm, timeForDist, inBand,
  get sortCol(){return sortCol}, set sortCol(v){sortCol=v}, get lastFiltered(){return lastFiltered}, get routePairs(){return routePairs}, get routeOrigin(){return routeOrigin},
  get zoom(){return zoom}, get SB(){return SB}, drawMap, DEMEB64, DEME_W, DEME_H, ctrySuggest, ctryChain, ctryResolve, ctryCommit, ctryShow, ctryHide, CTRY_CNT,
  worldRoll, isCommRow, rwCommsOf, rwDetailOf, tipHtml, importData, precipSet, precipClear, windSet, windClear, BORDERS, BORDERS_HI, LAKES, rfState, rfTags, rfSave, rfLoad, layoutHeight, tapSelect, setRi, WBASE, HBASE, sizeMap, COLS_AP_M, RT_COLS_M,
  get W(){return W}, get H(){return H}, get MAPSC(){return MAPSC},
  get worldOk(){return worldOk}, get worldRollN(){return worldRollN} };`;

const ids = {};
// Canvas-Recorder: moveTo/lineTo-Paare mit strokeStyle, arc für Ringe, fillText für Labels, fill für gefüllte Pfade (Berg-Dreiecke)
const segs = [];
const arcs = [];
const texts = [];
const fills = [];
const recCtx = {
  strokeStyle: null, fillStyle: null, lineWidth: 1, font: '', _m: null, _path: null,
  setTransform() {}, save() {}, restore() {}, translate() {}, scale() {},
  beginPath() { this._path = null; }, closePath() {}, fill() { if (this._path && fills.length < 30000) fills.push({ pts: this._path.slice(), col: this.fillStyle }); }, stroke() {}, arc(x, y, r) { if (arcs.length < 50000) arcs.push({ x, y, r, col: this.strokeStyle }); }, fillText(t) { if (texts.length < 100000) texts.push(String(t)); }, fillRect() {}, drawImage() {}, putImageData() {},
  createImageData() { throw new TypeError('mock — DEM bewusst übersprungen'); },
  moveTo(x, y) { this._m = [x, y]; this._path = [[x, y]]; },
  lineTo(x, y) { if (this._m && segs.length < 300000) segs.push({ x1: this._m[0], y1: this._m[1], x2: x, y2: y, col: this.strokeStyle, lw: this.lineWidth }); this._m = [x, y]; if (this._path && this._path.length < 4000) this._path.push([x, y]); },
};
function el(id) {
  if (!ids[id]) ids[id] = {
    id, value: '', checked: false, innerHTML: '', textContent: '', style: {}, dataset: {}, children: [],
    addEventListener() {}, querySelectorAll() { return []; }, querySelector(sel) { return el("_qs_" + (sel || Math.random())); },
    appendChild(c) { this.children.push(c); }, scrollIntoView() {}, scrollTop: 0, offsetTop: 0,
    getContext() { return recCtx; },
    classList: { _s: new Set(), toggle(c, f) { if (f === undefined) { if (this._s.has(c)) this._s.delete(c); else this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
  };
  return ids[id];
}
const catBoxes = [0, 2, 3].map(v => ({ value: String(v), checked: true }));
global.document = { nodeType: 9, getElementById: el, querySelectorAll: s => (s === '.fcat:checked' ? catBoxes.filter(b => b.checked) : []), createElement: () => el('_c' + Math.random()), addEventListener() {} };
const openedUrls = [];
global.window = { addEventListener(t, f) { (global.window.__l = global.window.__l || {})[t] = (global.window.__l[t] || []).concat(f); }, open: u => { openedUrls.push(u); return null; } };
const store = {};
global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = v, removeItem: k => delete store[k] };

function rowcount() { return (el('tbody').innerHTML.match(/<tr/g) || []).length; }
// Recorder-Ausgaben an jedem Szenario-Start räumen — sonst wachsen sie über 40 Szenarien in den Heap (Umgebung: 544 MB Limit)
const _log = console.log.bind(console);
console.log = function (...a) { if (typeof a[0] === 'string' && a[0].startsWith('--- ')) { segs.length = 0; arcs.length = 0; texts.length = 0; fills.length = 0; } return _log(...a); };
function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else console.log('ok  :', msg); }

new Function('document', 'window', 'localStorage', script)(global.document, global.window, global.localStorage);
const T = window.__t;

// Szenario 1: Initial (live, ohne Anwenden-Button)
console.log('--- S1 Initial ---');
console.log('Treffer:', el('count').textContent, '| Zeilen:', rowcount());
assert(rowcount() === 600, 'Initial: CAP 600 Zeilen gerendert');
assert(T.AP.length === 36779, '36779 Airports geladen');

// Kalibrierung Bergig (Hochgebirge = >=1800 m in 10 nm)
const mtnOf = icao => T.AP[T.byIcao.get(icao)][21];
assert(mtnOf('LOWI') === 3, 'LOWI (Innsbruck) = Hochgebirge 3');
assert(mtnOf('LSZS') === 3, 'LSZS (Samedan) = 3');
assert(mtnOf('LESU') === 3, 'LESU (Seu d\'Urgell) = 3');
assert(mtnOf('LIMF') === 2, 'LIMF (Turin) = Berg 2');
assert(mtnOf('LIPX') >= 1, 'LIPX (Villafranca) >= 1');
assert(mtnOf('EDDF') <= 1, 'EDDF flach bis Hügel (<=1)');
const blackForest = T.AP.filter(r => r[2] === 'DE' && r[21] === 3).length;
console.log('DE-Hochgebirge (lvl3):', blackForest);

// fMtnMin=3 filtert live
el('fMtnMin').value = '3';
T.update();
console.log('--- S1b fMtnMin=3 ---');
console.log('Treffer:', el('count').textContent);
assert(T.lastFiltered.length > 100 && T.lastFiltered.length < 1000 && T.lastFiltered.every(i => T.AP[i][21] >= 3), 'fMtnMin=3 filtert auf Hochgebirge (inkl. Procedures-Standard)');
el('fMtnMin').value = '0';
T.update();

// Szenario 2: Filter RWY>=3000 ft, paved, ILS
el('rwyMin').value = '3000'; el('surf').value = 'P'; el('fProc').value = 'ils';
T.update();
console.log('--- S2 RWY>=3000 ft paved ILS ---');
console.log('Treffer:', el('count').textContent);
assert(rowcount() > 50 && rowcount() <= 600, 'S2 plausible Trefferzahl');
el('rwyMin').value = ''; el('surf').value = '-1'; el('fProc').value = 'any';
T.update();

// Szenario 3: Routen-Panel: ab Start EDLN, 1.5h ±15min
el('routeMode').value = 'from'; el('rOrig').value = 'EDLN'; el('rDur').value = '1.5'; el('rTol').value = '15';
T.routeUpdate();
console.log('--- S3 Route ab EDLN (Panel) ---');
console.log('routeInfo:', el('routeInfo').textContent);
assert((T.routePairs || []).length > 20, 'S3 Ziele gefunden');
const d3 = T.routePairs.map(p => p.d);
assert(Math.min(...d3) > 620 && Math.max(...d3) < 1030, 'S3 Distanzband ~627-1022 km (1,5 h ± 15 min inkl. +10 %/+15 min)');
assert(T.routeOrigin === T.byIcao.get('EDLN'), 'S3 Origin gesetzt');
assert(el('routeWrap').style.display === 'block', 'S3 Routentabelle sichtbar');

// Szenario 4: Paare DACH, RWY>=2000 ft, paved, 1.0h ±20min
el('ctry').value = 'DE,CH,AT'; el('rwyMin').value = '2000'; el('surf').value = 'P';
T.update();
el('routeMode').value = 'pairs'; el('rDur').value = '1.0'; el('rTol').value = '20';
T.routeUpdate();
console.log('--- S4 Paare DACH 1.0h ---');
console.log('routeInfo:', el('routeInfo').textContent);
assert((T.routePairs || []).length > 0, 'S4 Paare gefunden');
if (T.routePairs && T.routePairs.length) {
  const p = T.routePairs[0];
  console.log('Bestes Paar:', T.AP[p.i][0], '<->', T.AP[p.j][0], Math.round(p.d), 'km');
  const t = (0.35 + Math.max(0, p.d - 140) / 871) * 1.10 + 0.25;
  assert(t > 0.65 && t < 1.35, 'S4 Zeit im Band (inkl. +10 % +15 min)');
  // Routentabelle gerendert?
  assert((el('rTbody').innerHTML.match(/<tr/g) || []).length > 0, 'S4 Routentabelle gerendert');
}
el('ctry').value = ''; el('rwyMin').value = ''; el('surf').value = '-1';
T.update();

// Szenario 5: Detail EDDF
T.selectAirport(T.byIcao.get('EDDF'));
console.log('--- S5 Detail EDDF ---');
const det = el('detail').innerHTML;
assert(det.includes('Pisten'), 'Detail zeigt Pistentabelle');
assert(det.includes('13123'), 'Detail Pistenlänge in ft (4000 m = 13123 ft)');
console.log('Detail-Auszug:', det.slice(0, 200).replace(/<[^>]+>/g, ' '));

// Szenario 6: Sortierung
T.sortCol = 4; T.render();
console.log('--- S6 Sort RWY ---');
assert(rowcount() === 600, 'S6 rendert 600 Zeilen');

// Szenario 7: Hochgebirge + RWY>=4000 ft paved DACH+IT+FR
el('fMtnMin').value = '3'; el('rwyMin').value = '4000'; el('surf').value = 'P'; el('ctry').value = 'DE,AT,CH,IT,FR';
T.update();
console.log('--- S7 Hochgebirge >=4000 ft DACH/IT/FR ---');
console.log('Treffer:', el('count').textContent);
assert(T.lastFiltered.length > 0, 'S7 Treffer');
el('fMtnMin').value = '0'; el('rwyMin').value = ''; el('surf').value = '-1'; el('ctry').value = '';
T.update();

// Szenario 8: Kategorie-Merge (NavData → AI), PKG_DEFAULT, Surface-Namen
console.log('--- S8 Kategorien & Surface ---');
assert(T.catOf(T.byIcao.get('EDDF')) === 0, 'EDDF: NavData in AI (rot) aufgegangen');
assert(T.catOf(T.byIcao.get('EDKG')) === 3, 'EDKG: PKG_DEFAULT = 3rd-Party');
assert(T.catOf(T.byIcao.get('KASE')) === 0, 'KASE: ohne Import rot (AI) — wie designed');
assert((el('tbody').innerHTML.match(/>Asph<|>Conc<|>Bitu<|>Tarm</g) || []).length > 0, 'Surface-Spalte zeigt Namen statt Zahl');
el('cont').value = 'EU'; T.update();
console.log('Kontinent EU Treffer (mit Verfahren):', el('count').textContent);
assert(T.lastFiltered.length > 400 && T.lastFiltered.length < 36779, 'Kontinent-Filter EU greift (inkl. Geo-Fallback)');
assert(T.lastFiltered.every(i => T.AP[i][9] || T.AP[i][11]), 'EU-Menge: nur Häfen mit ILS o. RNAV');
assert(T.lastFiltered.every(i => T.AP[i][2] !== 'US' && T.AP[i][2] !== 'JP' && T.AP[i][2] !== 'BR'), 'EU-Menge enthält keine US/JP/BR-Plätze');
const deEu = T.lastFiltered.filter(i => T.AP[i][2] === 'DE').length;
assert(deEu >= 80 && deEu < 454, 'EU-Filter enthält die DE-Plätze mit Verfahren (81 von 454)');
el('cont').value = ''; T.update();

// Szenario 9: SimBrief-Profil (Airline, Callsign, fortlaufende Flugnummer, Pax, FL)
console.log('--- S9 SimBrief-Profil ---');
el('routeMode').value = 'from'; el('rOrig').value = 'EDDM'; el('rDur').value = '1.5'; el('rTol').value = '15';
T.routeUpdate();
T.simbriefGo();
T.simbriefGo();
const u1 = openedUrls[openedUrls.length - 2], u2 = openedUrls[openedUrls.length - 1];
console.log('URL:', u2.slice(0, 160));
assert(u2.includes('orig=EDDM') && u2.includes('type=C25X'), 'S9 orig/type übergeben');
assert(u2.includes('airline=BVR') && u2.includes('callsign=BVR0113'), 'S9 Airline + Callsign übergeben');
assert(u1.includes('fltnum=1') && u2.includes('fltnum=2'), 'S9 Flugnummer fortlaufend 1, 2 (+1 je Übergabe)');
assert(u2.includes('units=LBS') && !u2.includes('pax=') && !u2.includes('&fl='), 'S9 pax auto / FL leer = Parameter weggelassen');
assert(u2.includes('civalue=200'), 'S9 Cost Index 200 übergeben');
assert(T.SB.counter === 2, 'S9 Zähler = 2 nach zwei Übergaben');
el('sbPaxMode').value = 'none'; el('sbFltMode').value = 'fix'; el('sbFltNum').value = '1103'; el('sbFlSel').value = 'manual'; el('sbFL').value = 'FL340';
T.saveSb();
T.simbriefGo();
const u3 = openedUrls[openedUrls.length - 1];
assert(u3.includes('fltnum=1103') && u3.includes('pax=0') && u3.includes('fl=FL340'), 'S9 fest: Flugnummer 1103, 0 Pax, FL340');

// Szenario 10: Routenzeile → focusPair (gelbe Route, Zoom auf Paar)
console.log('--- S10 focusPair ---');
T.routeUpdate();
const p0 = T.routePairs[0];
const zoomBefore = T.zoom;
T.focusPair(p0.i, p0.j);
assert(global.window.selPair && global.window.selPair[0] === p0.i && global.window.selPair[1] === p0.j, 'S10 selPair gesetzt');
assert(el('pairInfo').innerHTML.includes('→') && el('pairInfo').innerHTML.includes('ft RWY'), 'S10 pairInfo mit Key-Daten beider Plätze');
assert(T.zoom > zoomBefore || T.zoom >= 3, 'S10 Zoom auf Paar angepasst');
el('routeMode').value = 'off'; T.routeUpdate();
assert(global.window.selPair === null, 'S10 Neuberechnung leert Paar-Fokus');

// Szenario 11: DEME Europa-Ausrichtung (Punkt-Checks statt Zeilendurchschnitt)
console.log('--- S11 DEME-Ausrichtung ---');
const g = Buffer.from(T.DEMEB64, 'base64');
const Wd = T.DEME_W, Hd = T.DEME_H;
const cell = (lat, lon) => { const north = 33 + Hd * 0.016, row = Math.floor((north - lat) / 0.016), col = Math.floor((lon + 12) / (Wd === 2094 ? 0.02197265625 : 0.021973)); return g[row * Wd + col] * 32 - 500; };
const mInnsbruck = cell(47.26, 11.4), mMatterhorn = cell(45.98, 7.66), mMedi = cell(35, 18), mNorwegen = cell(61.9, 8);
console.log('Innsbruck:', mInnsbruck, 'm · Matterhorn:', mMatterhorn, 'm · Mittelmeer 35/18:', mMedi, 'm · Norwegen 62N:', mNorwegen, 'm');
assert(mMatterhorn > 3000, 'S11 Matterhorn-Zelle > 3000 m (Alpen an richtiger Stelle = nicht gespiegelt)');
assert(mMedi <= 0, 'S11 Mittelmeer-Zelle = Meer');
assert(mInnsbruck > 400, 'S11 Innsbruck-Tal > 400 m');
assert(mNorwegen > 300, 'S11 Süd-Norwegen > 300 m');

// Szenario 12: Flugzeit pro Muster (Citation X via Tool, TBM manuell)
console.log('--- S12 Cruise je Muster ---');
const tX = T.timeForDist(800);                       // aktuelles Muster: Citation X 470 kt
const tTbm = (0.35 + Math.max(0, 800 - 140) / (280 * 1.852)) * 1.10 + 0.25;   // TBM 930 280 kt — +10 % +15 min
console.log('Citation X 800 km:', tX.toFixed(2), 'h · TBM 930:', tTbm.toFixed(2), 'h');
assert(tX > 1.35 && tX < 1.6, 'S12 Citation X 470 kt: 800 km ≈ 1:28 (inkl. +10 % Route +15 min Startup)');
assert(tTbm > 1.9 && tTbm < 2.2, 'S12 TBM 280 kt: 800 km ≈ 2:02 (inkl. +10 % Route +15 min Startup)');

// Szenario 13: Weltumrundung (Ø 2,5 h ± 30 min, RWY >= 3000 ft paved)
console.log('--- S13 Weltumrundung ---');
const _rnd = Math.random; Math.random = () => 0.5;   // deterministischer Seed: Zufallsauswahl reprobar
el('rwyMin').value = '3000'; el('surf').value = 'P'; T.update();
el('routeMode').value = 'world'; el('rOrig').value = 'EDDM'; el('rDur').value = '2.5'; el('rTol').value = '30'; el('wDir').value = 'east';
T.routeUpdate();
let wl = global.window.worldLegs;
assert(wl && wl.length >= 5, 'S13 Weltumrundung gerendert');
console.log('routeInfo:', el('routeInfo').textContent);
if (wl && wl.length) {
  const dHiW = 140 + ((2.5 + 0.5 - 0.25) / 1.1 - 0.35) * 870.44;
  const longs = wl.filter(l => l.d > dHiW).length;
  assert(wl.every(l => l.d <= dHiW * 1.9), 'S13 alle Etappen <= 1,9 × Band');
  assert(longs >= 0 && el('routeInfo').textContent.includes('überlang'), 'S13 Ausnahmen-Zähler immer ausgewiesen (kein Limit mehr, Route endet nicht am Zähler)');
  const excInTxt = T.worldTxt().match(/Ausnahmen aus der Ø-Vorgabe: (\d+)/);
  assert(excInTxt && +excInTxt[1] === longs, 'S13 TXT-Export listet Ausnahmen-Anzahl korrekt');
  let sumE = 0; wl.forEach(l => { let e = ((T.AP[l.j][4] - T.AP[l.i][4]) * 1) % 360; if (e < 0) e += 360; sumE += e; });
  console.log('Fortschritt:', Math.round(sumE), '° · Etappen:', wl.length);
  assert(sumE >= 340, 'S13 Gesamtfortschritt >= 340°');
  assert(sumE <= 425, 'S13 kein Überhol-Backtracking: Gesamtfortschritt inkl. Schlussflug ~360°, Start wird nicht überholen');
  assert(el('worldChain').innerHTML.includes('EDDM') && el('worldChain').innerHTML.includes('→'), 'S13 ICAO-Kette mit Pfeilen');
  const wtxt = T.worldTxt();
  assert(wtxt.includes('Route:') && wtxt.includes('nm') && wtxt.includes('EDDM'), 'S13 TXT-Export mit Route und Etappen');
  T.computeWorld();
  assert(global.window.worldLegs && global.window.worldLegs.length >= 5, 'S13 Reroll liefert erneut gültige Route');
  // S13b: Länder-Meiden — max. 1 Etappe je gelistetem Land
  el('wAvoid').value = 'CN,RU'; T.computeWorld();
  const wlA = global.window.worldLegs;
  const intoC = wlA.filter(l => T.AP[l.j][2] === 'CN').length;
  const intoR = wlA.filter(l => T.AP[l.j][2] === 'RU').length;
  console.log('Meiden CN/RU — Etappen hinein:', intoC, '×CN ·', intoR, '×RU · Etappen gesamt:', wlA.length);
  assert(intoC <= 1 && intoR <= 1, 'S13b max. 1 Etappe je gemiedenem Land (CN, RU)');
  assert(el('routeInfo').textContent.includes('meidet CN'), 'S13b Meidliste in routeInfo ausgewiesen');
  assert(T.worldTxt().includes('Gemiedene Länder') && T.worldTxt().includes('CN, RU'), 'S13b TXT-Export listet Meidliste');
  el('wAvoid').value = ''; T.computeWorld();
}
Math.random = _rnd;   // Zufall für alle weiteren Szenarien zurückstellen
el('routeMode').value = 'off'; el('rOrig').value = ''; el('rDur').value = '1.5'; el('rTol').value = '15';
el('rwyMin').value = ''; el('surf').value = '-1'; T.update(); T.routeUpdate();

// Szenario 14: Regressionsschutz — Label-Umschreibung darf Input nicht zerstören
console.log('--- S14 Label-Regression ---');
assert(html.includes('<span id="rDurLbl">Dauer</span>'), 'S14 rDurLbl ist eigenes Span (Input bleibt erhalten)');
const dangerous = script.match(/\$\('[^']*Lbl'\)\.textContent/);
assert(!dangerous || dangerous.every(m => m.includes('rDurLbl')), 'S14 kein textContent auf Label mit Input');
// Szenario 15: Naht-Regression — Routensegmente überspannen nie mehr als W/2 (kein Strich quer über die Karte)
console.log('--- S15 Karten-Naht ---');
const iRJTT = T.byIcao.get('RJTT'), iPHNL = T.byIcao.get('PHNL');
if (iRJTT !== undefined && iPHNL !== undefined) {
  el('routeMode').value = 'world'; T.routeUpdate();          // routeMode intern auf world setzen
  global.window.worldLegs = [{ i: iRJTT, j: iPHNL, d: 3600 }];   // 139,9°O -> -157,9° = quer über die Naht
  segs.length = 0; T.drawMap();
  const routeSegs = segs.filter(s => s.col === '#ffd23b' || s.col === '#4aa3ff55');
  assert(routeSegs.length > 0, 'S15 Routensegmente gezeichnet');
  const maxDx = Math.max(...routeSegs.map(s => Math.abs(s.x2 - s.x1)));
  console.log('max. Segmentbreite:', Math.round(maxDx), 'px (Zoom 1, Karte 1280 px breit)');
  assert(maxDx <= 642, 'S15 kein Naht-Überspannen (max W/2 = 640 px)');
  el('routeMode').value = 'off'; T.routeUpdate();
} else { console.log('S15 übersprungen (RJTT/PHNL nicht in Daten)'); }

// Szenario 16: Routen-Ringe — Airports der aktiven Route bekommen einen weißen Ring
console.log('--- S16 Routen-Ringe ---');
{
  const iF = T.byIcao.get('EDDF'), iM = T.byIcao.get('EDDM'), iL = T.byIcao.get('EGLL');
  el('mzReset').onclick();   // Zoom 1 → Punkt-Modus (Ring r=8)
  const rings = () => arcs.filter(a => a.r === 8 && a.col === '#ffffff').length;
  // Weltumrundung: alle Stops geringelt (EDDF ist zusätzlich ausgewählt — ein Ring)
  el('routeMode').value = 'world'; T.routeUpdate();
  global.window.worldLegs = [{ i: iF, j: iM, d: 300 }, { i: iM, j: iL, d: 800 }];
  arcs.length = 0; T.drawMap();
  console.log('Weiße Ringe (World, 3 Stops):', rings());
  assert(rings() === 3, 'S16 World: alle 3 Route-Airports mit weißem Ring');
  // Normalmodus: gewähltes Paar geringelt
  el('routeMode').value = 'pairs'; T.routeUpdate();
  global.window.selPair = [iF, iM];
  arcs.length = 0; T.drawMap();
  console.log('Weiße Ringe (Paar-Modus):', rings());
  assert(rings() === 2, 'S16 Paar-Modus: gewähltes Paar mit weißem Ring');
  // Ohne Route: nur noch der Auswahl-Ring des selektierten Airports (EDDF aus S3)
  global.window.selPair = null; el('routeMode').value = 'off'; T.routeUpdate();
  arcs.length = 0; T.drawMap();
  assert(rings() === 1, 'S16 ohne aktive Route nur Auswahl-Ring (kein Route-Ring)');
}

// Szenario 17: Schalter "Nicht-Routen-Häfen aus" — nur Route-Häfen auf der Karte (nur Anzeige)
console.log('--- S17 Nicht-Routen-Häfen ---');
{
  const iF = T.byIcao.get('EDDF'), iM = T.byIcao.get('EDDM'), iL = T.byIcao.get('EGLL');
  el('mzReset').onclick();
  el('routeMode').value = 'world'; T.routeUpdate();
  global.window.worldLegs = [{ i: iF, j: iM, d: 300 }, { i: iM, j: iL, d: 800 }];
  const dots = () => arcs.filter(a => a.r === 4 || a.r === 6).length;
  el('onlyRoute').checked = true; arcs.length = 0; T.drawMap();
  console.log('Punkte mit Schalter an:', dots());
  assert(dots() === 3, 'S17 Schalter an: nur die 3 Route-Häfen sichtbar');
  el('onlyRoute').checked = false; arcs.length = 0; T.drawMap();
  console.log('Punkte mit Schalter aus:', dots());
  assert(dots() > 1000, 'S17 Schalter aus: alle Filter-Häfen wieder sichtbar');
  el('routeMode').value = 'off'; T.routeUpdate();
}
// Szenario 18: Zoom-Schwellen — ICAO-Label ab 23×, Pisten-Symbole ab 30×
console.log('--- S18 Zoom-Schwellen ---');
{
  const iF = T.byIcao.get('EDDF');
  const rF = T.AP[iF];
  const icaoTxt = () => texts.filter(t => /^[A-Z0-9]{3,4}$/.test(t)).length;
  const rwyCols = ['#ff3b3b', '#4aa3ff', '#3ddc84', '#ffffff'];
  const rwySegs = () => segs.filter(s => rwyCols.includes(s.col)).length;
  const camOn = (z) => global.window.setCam((rF[4] + 180) / 360 * 1280, (90 - rF[3]) / 180 * 640, z);
  el('onlyRoute').checked = false;
  camOn(20); texts.length = 0; segs.length = 0; T.drawMap();
  assert(icaoTxt() === 0 && rwySegs() === 0, 'S18 unter 23×: kein ICAO-Label, keine Pisten-Symbole');
  camOn(24); texts.length = 0; segs.length = 0; T.drawMap();
  console.log('ICAO-Labels bei 24×:', icaoTxt(), '· Pisten-Symbole:', rwySegs());
  assert(icaoTxt() > 0 && rwySegs() === 0, 'S18 ab 23×: ICAO-Label da, Pisten noch als Punkt');
  camOn(29); texts.length = 0; segs.length = 0; T.drawMap();
  assert(rwySegs() === 0, 'S18 unter 30×: weiterhin keine Pisten-Symbole');
  camOn(31); texts.length = 0; segs.length = 0; T.drawMap();
  console.log('Pisten-Symbole bei 31×:', rwySegs());
  assert(rwySegs() > 0, 'S18 ab 30×: Pisten-Richtung als Symbol aufgelöst');
  global.window.setCam(1280 / 2, 640 / 2, 1);
}

// Szenario 19: Routenliste sortierbar (Spaltenkopf), RNAV neben ILS, Kat-Spalte entfernt
console.log('--- S19 Routenliste sortieren ---');
{
  el('ctry').value = 'DE,CH,AT'; el('rwyMin').value = '2000'; el('surf').value = 'P';
  T.update();
  el('routeMode').value = 'pairs'; el('rDur').value = '1.0'; el('rTol').value = '20';
  T.routeUpdate();
  assert((T.routePairs || []).length > 0, 'S19 Paare vorhanden');
  assert(el('rThead').innerHTML.includes('RNAV A') && el('rThead').innerHTML.includes('RNAV B'), 'S19 RNAV A/B in Routenliste neben ILS');
  const rows = () => el('rTbody').innerHTML.split('</tr>').filter(r => r.includes('<td>'));
  const nmOf = row => { const tds = row.match(/<td>([\s\S]*?)<\/td>/g).map(t => t.slice(4, -5)); return +tds[2]; };
  global.window.routeSortClick(4);            // nm aufsteigend (Idx 4: zwei schmale Kat-Spalten vorangestellt)
  let vals = rows().map(nmOf);
  console.log('nm aufsteigend:', vals.slice(0, 5).join(', '), '...');
  assert(vals.every((v, k) => k === 0 || vals[k - 1] <= v), 'S19 Spaltenkopf-Klick: nm aufsteigend');
  global.window.routeSortClick(4);            // zweiter Klick = absteigend
  vals = rows().map(nmOf);
  assert(vals.every((v, k) => k === 0 || vals[k - 1] >= v), 'S19 zweiter Klick: nm absteigend');
  const th = el('thead').innerHTML;
  assert(!th.includes('>Kat<'), 'S19 Kat-Spalte entfernt (Farbcode am Zeilenanfang genügt)');
  assert(/ILS<\/th><th[^>]*>RNAV/.test(th), 'S19 RNAV direkt neben ILS in der Airport-Liste');
  el('ctry').value = ''; el('rwyMin').value = ''; el('surf').value = '-1';
  el('routeMode').value = 'off'; T.routeUpdate(); T.update();
}

// Szenario 20: Procedures-Dropdown + aktive Routenzeile markiert
console.log('--- S20 Procedures & aktive Route ---');
{
  el('q').value = ''; el('fProc').value = 'any'; T.update();
  const uAny = T.lastFiltered;
  assert(uAny.length === 3428, 'S20 ILS o. RNAV: genau die 3428 Häfen mit mindestens einem Verfahren');
  assert(uAny.every(i => T.AP[i][9] || T.AP[i][11]), 'S20 ILS o. RNAV: jeder Treffer hat ILS oder RNAV');
  const cybd = T.byIcao.get('CYBD');
  assert(!uAny.includes(cybd), 'S20 CYBD (ohne jedes Verfahren) unter ILS o. RNAV ausgeblendet');
  el('fProc').value = 'ils'; T.update();
  assert(T.lastFiltered.length > 0 && T.lastFiltered.every(i => T.AP[i][9] === 1), 'S20 Procedures ILS: nur Häfen mit ILS');
  el('fProc').value = 'rnav'; T.update();
  assert(T.lastFiltered.length > 0 && T.lastFiltered.every(i => T.AP[i][11] === 1), 'S20 Procedures RNAV: nur Häfen mit RNAV');
  el('fProc').value = 'none'; T.update();
  assert(T.lastFiltered.length > 0 && T.lastFiltered.every(i => !T.AP[i][9] && !T.AP[i][11]), 'S20 Procedures none: weder ILS noch RNAV');
  assert(T.lastFiltered.includes(cybd), 'S20 CYBD nur unter „none" sichtbar');
  el('fProc').value = 'all'; T.update();
  assert(T.lastFiltered.length === 36779, 'S20 Procedures „alle": kein Filter, alle 36779 Häfen');
  assert(T.lastFiltered.includes(cybd), 'S20 „alle" zeigt auch verfahrenslose Häfen');
  el('fProc').value = 'any'; T.update();
  // aktive Routenzeile markiert wie Auswahl in der Airport-Liste
  el('ctry').value = 'DE,CH,AT'; el('rwyMin').value = '2000'; el('surf').value = 'P'; T.update();
  el('routeMode').value = 'pairs'; el('rDur').value = '1.0'; el('rTol').value = '20'; T.routeUpdate();
  const pX = (T.routePairs || [])[3] || (T.routePairs || [])[0];
  assert(pX, 'S20 Paare vorhanden');
  T.focusPair(pX.i, pX.j);
  assert(el('rTbody').innerHTML.includes('class="sel"'), 'S20 aktive Paar-Zeile mit sel markiert');
  global.window.selPair = null; T.renderRoutes();
  assert(!el('rTbody').innerHTML.includes('class="sel"'), 'S20 ohne Auswahl keine Zeile markiert');
  el('ctry').value = ''; el('rwyMin').value = ''; el('surf').value = '-1';
  el('routeMode').value = 'off'; T.routeUpdate(); T.update();
}

// Szenario 21: Flughistorie-Import (Karte violett) + Kat-Balken/✓ in Routenliste
console.log('--- S21 Historie & Kat-Balken ---');
{
  global.window.selPair = null;
  const res = global.window.histImport('EDDM,KJFK\nEDDM EDDF\nLOWI\njunk 123 xyz');
  assert(res.legs === 2 && res.icaos === 4 && res.lines === 3, 'S21 histImport: 2 Beine, 4 Häfen, Junk ignoriert');
  const st = JSON.parse(localStorage.getItem('asc_hist_v1'));
  assert(st.legs.length === 2 && st.icaos.length === 4, 'S21 Historie in localStorage persistiert');
  // Karte: violette Linien + Ringe, nur mit aktivem Overlay (Mock setzt checked nicht per Attribut)
  el('histShow').checked = true;
  global.window.setCam(1280 / 2, 640 / 2, 1); segs.length = 0; arcs.length = 0; T.drawMap();
  const vSegs = () => segs.filter(s => s.col === '#c77dff').length;
  const vArcs = () => arcs.filter(a => a.col === '#c77dff').length;
  assert(vSegs() > 0, 'S21 geflogene Verbindungen violett auf der Karte');
  assert(vArcs() > 0, 'S21 geflogene Häfen mit violettem Ring');
  el('histShow').checked = false; segs.length = 0; arcs.length = 0; T.drawMap();
  assert(vSegs() === 0 && vArcs() === 0, 'S21 Overlay aus = keine Historie auf der Karte');
  el('histShow').checked = true;
  // Aktive geflogene Etappe = dicke violette Unterlage (mehr violette Segmente mit selPair)
  const eddm = T.byIcao.get('EDDM'), eddf = T.byIcao.get('EDDF');
  segs.length = 0; T.drawMap(); const base = vSegs();
  global.window.selPair = [eddf, eddm]; segs.length = 0; T.drawMap();
  assert(vSegs() > base, 'S21 geflogene aktive Etappe bekommt violette Unterlage (dicker Strich)');
  global.window.selPair = null;
  // Routenliste: Balken vor Ziel (3rd-Party grün) + ✓ violett bei geflogenem Paar
  el('q').value = 'EDD'; el('ctry').value = ''; el('rwyMin').value = ''; el('surf').value = '-1'; el('fProc').value = 'all';
  T.update();
  el('routeMode').value = 'pairs'; el('rDur').value = '0.75'; el('rTol').value = '60'; T.routeUpdate();
  const pF = (T.routePairs || []).find(p => (p.i === eddm && p.j === eddf) || (p.i === eddf && p.j === eddm));
  assert(pF, 'S21 Paar EDDM–EDDF in der Liste');
  T.focusPair(pF.i, pF.j);
  assert(el('rTbody').innerHTML.includes('color:#c77dff">✓'), 'S21 geflogenes Paar (EDDM–EDDF) mit violettem ✓ markiert');
  el('q').value = 'LIL'; T.update(); T.routeUpdate();
  const liln = T.byIcao.get('LILN');
  const pKg = (T.routePairs || []).find(p => p.j === liln);
  assert(pKg, 'S21 Paar mit 3rd-Party-Ziel LILN in der Liste');
  T.focusPair(pKg.i, pKg.j);
  assert(/width:4px;height:11px;background:#3ddc84/.test(el('rTbody').innerHTML), 'S21 grüner Kat-Balken vor Ziel-ICAO');
  const expBar = (T.routePairs || []).filter(p => T.catOf(p.j) >= 2).length + (T.routePairs || []).filter(p => T.catOf(p.i) >= 2).length;
  assert((el('rTbody').innerHTML.match(/width:4px/g) || []).length === expBar, 'S21 Balken exakt nur bei Asobo/3rd-Party (Abflug + Ziel, AI ohne)');
  global.window.selPair = null;
  el('q').value = ''; el('routeMode').value = 'off'; T.routeUpdate();
  el('histClr').onclick();
  assert(!localStorage.getItem('asc_hist_v1'), 'S21 Entfernen leert die Historie');
  el('fProc').value = 'any'; T.update();
}

// Szenario 22: FLA-CSV wird spaltengenau gelesen (keine False Positives aus SID/Piste/Livery)
console.log('--- S22 FLA-CSV Import ---');
{
  const fla = 'Flight Number, Start Time (UTC),Sim Start Time (UTC),FS Version,Origination Airport,Origination Airport Name,Departure Runway,SID,Gate - Departure,Destination Airport,Destination Airport Name,Planned Destination Runway,STAR,Approach\n'
    + '1,04.02.2021 23:54:35,07.09.2018 22:40:00,2020,KSEZ,"Sedona Airport,  AZ Sedona",,"",0,P52,"Cottonwood Airport,  AZ Cottonwood",,"",""\n'
    + '2,05.02.2021 00:21:46,05.02.2021 00:35:23,2020,LOWI,"Innsbruck Airport,  7 Innsbruck",26,"",0,LOWI,"Innsbruck Airport,  7 Innsbruck",22,"",""\n'
    + '3,17.02.2021 05:54:01,17.02.2021 07:36:14,2020,EDDM,"Munich Airport,  BY Munich",26R,"RIDAV6N",0,EDDF,"Frankfurt Main Airport,  HE Frankfurt am Main",25C,"","ILS-07-Y"\n'
    + '4,01.01.2022 10:00:00,01.01.2022 10:00:00,2020,EDDM,"Munich Airport,  BY Munich",26R,"",0,EDPC,"Bad Endorf",,"",""\n';
  const res = global.window.histImport(fla);
  assert(res.legs === 2 && res.icaos === 5 && res.lines === 4, 'S22 FLA-CSV: 2 Beine (KSEZ–P52, EDDM–EDDF), 5 Häfen, Kopfzeile übersprungen');
  assert(res.unknown === 1, 'S22 FLA-CSV: unbekanntes Ziel EDPC gezählt und übersprungen');
  const st = JSON.parse(localStorage.getItem('asc_hist_v1'));
  assert(st.legs.length === 2 && st.icaos.length === 5, 'S22 FLA-CSV in localStorage persistiert');
  const bad = new Set(['26R', '22', '25C', 'GATE', 'SCHL', 'ILS', 'EDPC', 'RIDAV6N']);
  assert(!st.legs.some(l => l.some(i => bad.has(T.AP[i][0]))) && !st.icaos.some(i => bad.has(T.AP[i][0])),
    'S22 keine False Positives aus Pisten-/SID-/Livery-/Namens-Tokens');
  const single = global.window.histImport('EDDM,KJFK\nEDDM EDDF\nLOWI\njunk 123 xyz');
  assert(single.legs === 2 && single.icaos === 4 && single.lines === 3, 'S22 Fallback: einfache Listen weiterhin Token-basiert');
  el('histClr').onclick();
  assert(!localStorage.getItem('asc_hist_v1'), 'S22 Entfernen leert die Historie');
}

// Szenario 23: schmale Marker-Spalte (Ziel-ICAO unverschoben) + Route-Vorgaben 💾 speichern
console.log('--- S23 Marker-Spalte & rtSave ---');
{
  global.window.histImport('EDDM,KJFK\nEDDM EDDF');
  el('q').value = 'EDD'; el('ctry').value = ''; el('fProc').value = 'all'; T.update();
  el('routeMode').value = 'pairs'; el('rDur').value = '0.75'; el('rTol').value = '60'; T.routeUpdate();
  assert(el('rThead').innerHTML.includes('<th style="width:12px"></th>'), 'S23 schmale Marker-Spalte im Tabellenkopf (nicht sortierbar)');
  const eddm = T.byIcao.get('EDDM'), eddf = T.byIcao.get('EDDF');
  const pF = (T.routePairs || []).find(p => (p.i === eddm && p.j === eddf) || (p.i === eddf && p.j === eddm));
  assert(pF, 'S23 Paar EDDM–EDDF vorhanden');
  T.focusPair(pF.i, pF.j);
  assert(/width:12px;padding-left:2px"><span style="color:#c77dff">✓<\/span><\/td><td><b style="color:#4aa3ff">/.test(el('rTbody').innerHTML),
    'S23 ✓ in eigener Spalte, Ziel-ICAO unverschoben in der Nach-Spalte');
  el('q').value = 'LIL'; T.update(); T.routeUpdate();
  const liln = T.byIcao.get('LILN');
  const pKg = (T.routePairs || []).find(p => p.j === liln);
  assert(pKg, 'S23 Paar mit 3rd-Party-Ziel LILN vorhanden');
  T.focusPair(pKg.i, pKg.j);
  assert(/width:12px;padding-left:2px"><span style="display:inline-block;width:4px;height:11px;background:#3ddc84;border-radius:1px"><\/span><\/td><td><b style="color:#4aa3ff">LILN/.test(el('rTbody').innerHTML),
    'S23 Kat-Balken in eigener Spalte, Ziel-ICAO exakt in Spaltenlinie');
  // rtSave: Vorgaben pro Route-Modus speichern
  el('routeMode').value = 'pairs'; el('rDur').value = '0.8'; el('rTol').value = '55';
  el('rtSave').onclick();
  let st = JSON.parse(localStorage.getItem('asc_rt_v1'));
  assert(st.pairs && st.pairs.dur === '0.8' && st.pairs.tol === '55', 'S23 💾 speichert Dauer/± für den aktiven Modus');
  // Import enthält rt und wendet die Vorgaben des aktiven Modus an
  el('routeMode').value = 'world';
  el('impIn').value = JSON.stringify({ rt: { pairs: { dur: '0.75', tol: '60' }, world: { dur: '2.5', tol: '30' } } });
  el('impBtn').onclick();
  assert(el('rDur').value === '2.5' && el('rTol').value === '30', 'S23 Import wendet Route-Vorgaben des aktiven Modus (world) an');
  st = JSON.parse(localStorage.getItem('asc_rt_v1'));
  assert(st.world && st.world.dur === '2.5' && st.pairs && st.pairs.dur === '0.75', 'S23 Import persistiert Route-Vorgaben');
  global.window.selPair = null;
  el('q').value = ''; el('routeMode').value = 'off'; el('rDur').value = '1.5'; el('rTol').value = '15'; T.routeUpdate();
  el('histClr').onclick();
  localStorage.removeItem('asc_rt_v1');
}

// Szenario 24: Abflug-Kategorie-Balken, violette Zeile für geflogene Route, kompakter Historie-Schalter oben
console.log('--- S24 Abflug-Balken & Zeilen-Tönung ---');
{
  global.window.histImport('EDDM,KJFK\nEDDM EDDF');
  assert(!!el('histShow'), 'S24 kompakter Historie-Schalter in der Filtersektion vorhanden');
  el('flagIcao').value = 'EDDF'; el('flagCat').value = '3'; el('flagGo').onclick();
  el('q').value = 'EDD'; el('ctry').value = ''; el('fProc').value = 'all'; T.update();
  el('routeMode').value = 'pairs'; el('rDur').value = '0.5'; el('rTol').value = '100'; T.routeUpdate();
  assert((el('rThead').innerHTML.match(/<th style="width:12px"><\/th>/g) || []).length === 2,
    'S24 zwei schmale Marker-Spalten (Abflug + Ziel)');
  const eddf = T.byIcao.get('EDDF'), eddm = T.byIcao.get('EDDM');
  const pD = (T.routePairs || []).find(p => p.i === eddf);
  assert(pD, 'S24 Paar mit EDDF als Abflug vorhanden');
  T.focusPair(pD.i, pD.j);
  assert(/width:12px;padding-left:2px"><span style="display:inline-block;width:4px;height:11px;background:#3ddc84;border-radius:1px"><\/span><\/td><td>EDDF/.test(el('rTbody').innerHTML),
    'S24 grüner Kat-Balken in eigener Spalte vor der Abflug-ICAO');
  const pF = (T.routePairs || []).find(p => (p.i === eddm && p.j === eddf) || (p.i === eddf && p.j === eddm));
  assert(pF, 'S24 geflogenes Paar EDDM–EDDF in Liste');
  T.focusPair(pF.i, pF.j);
  assert(el('rTbody').innerHTML.includes('background:#c77dff26'), 'S24 geflogene Routenzeile violett getönt');
  el('flagIcao').value = 'EDDF'; el('flagCat').value = '-1'; el('flagGo').onclick();
  global.window.selPair = null;
  el('q').value = ''; el('routeMode').value = 'off'; T.routeUpdate();
  el('histClr').onclick();
}

// Szenario 25: Moduswechsel in die Weltumrundung räumt alte Paar-Linien ab (und umgekehrt)
console.log('--- S25 Modus-Wechsel-Reset ---');
{
  el('q').value = 'EDD'; el('ctry').value = ''; el('fProc').value = 'all'; T.update();
  el('routeMode').value = 'pairs'; el('rDur').value = '0.75'; el('rTol').value = '60'; T.routeUpdate();
  assert((T.routePairs || []).length > 0, 'S25 Paar-Modus: blaue Paar-Linien berechnet');
  segs.length = 0; global.window.setCam(1280 / 2, 640 / 2, 1); T.drawMap();
  assert(segs.some(s => s.col === '#4aa3ff55'), 'S25 Paar-Modus: hellblaue Linien auf der Karte');
  el('q').value = ''; T.update();
  el('routeMode').value = 'world'; el('rOrig').value = 'EDDM'; el('rDur').value = '2.5'; el('rTol').value = '30'; T.routeUpdate();
  assert(!T.routePairs, 'S25 Weltumrundung: routePairs nach Moduswechsel geräumt');
  segs.length = 0; T.drawMap();
  assert(!segs.some(s => s.col === '#4aa3ff55'), 'S25 Welt-Modus: keine hellblauen Paar-Linien mehr');
  assert(segs.some(s => s.col === '#ffd23b'), 'S25 Welt-Modus: Etappen gelb gezeichnet');
  el('q').value = 'EDD'; T.update();
  el('routeMode').value = 'pairs'; el('rOrig').value = ''; el('rDur').value = '0.75'; el('rTol').value = '60'; T.routeUpdate();
  segs.length = 0; T.drawMap();
  assert(!segs.some(s => s.col === '#ffd23b'), 'S25 zurück im Paar-Modus: keine gelben Welt-Etappen mehr');
  assert(segs.some(s => s.col === '#4aa3ff55'), 'S25 zurück im Paar-Modus: hellblaue Linien wieder da');
  el('q').value = ''; el('routeMode').value = 'off'; el('rOrig').value = ''; el('rDur').value = '1.5'; el('rTol').value = '15'; T.routeUpdate();
  el('fProc').value = 'any'; T.update();
}

// Szenario 26: RNAV in der Paar-Summary + AI-Prio-Flag (Weltumrundung wie Asobo, sonst AI)
console.log('--- S26 RNAV-Summary & AI Prio ---');
{
  el('q').value = 'EDD'; el('ctry').value = ''; el('rwyMin').value = ''; el('surf').value = '-1'; el('fProc').value = 'all'; T.update();
  el('routeMode').value = 'pairs'; el('rDur').value = '0.75'; el('rTol').value = '60'; T.routeUpdate();
  const pR = (T.routePairs || []).find(p => T.AP[p.i][11] || T.AP[p.j][11]);
  assert(pR, 'S26 Paar mit RNAV-Verfahren vorhanden');
  T.focusPair(pR.i, pR.j);
  assert(el('pairInfo').innerHTML.includes('RNAV ✓'), 'S26 RNAV ✓ jetzt auch in der Paar-Summary unter der Routenliste');
  global.window.selPair = null;
  // AI Prio setzen
  const eddf = T.byIcao.get('EDDF');
  el('flagIcao').value = 'EDDF'; el('flagCat').value = '4'; el('flagGo').onclick();
  assert(T.catOf(eddf) === 4, 'S26 AI-Prio-Flag gesetzt (Kategorie 4)');
  assert(el('flagOut').textContent.includes('Weltumrundung wie Asobo'), 'S26 AI-Prio-Erklärung im Flag-Feedback');
  // Paar-Modus, AI-Haken aus: AI Prio zählt als AI und fliegt aus der Grundmenge
  catBoxes[0].checked = false; el('routeMode').value = 'pairs'; T.routeUpdate();
  assert(!T.lastFiltered.includes(eddf), 'S26 Paar-Modus mit AI aus: AI Prio ist draußen (zählt als AI)');
  // Welt-Modus, Asobo an: AI Prio zählt als Asobo und ist in der Grundmenge
  el('routeMode').value = 'world'; T.routeUpdate();
  assert(T.lastFiltered.includes(eddf), 'S26 Welt-Modus mit AI aus: AI Prio zählt als Asobo und ist drin');
  // Zurücksetzen
  el('flagIcao').value = 'EDDF'; el('flagCat').value = '-1'; el('flagGo').onclick();
  catBoxes[0].checked = true;
  assert(T.catOf(eddf) === 0, 'S26 Werkseinstellung entfernt AI-Prio-Flag');
  el('q').value = ''; el('routeMode').value = 'off'; el('rOrig').value = ''; el('rDur').value = '1.5'; el('rTol').value = '15'; T.routeUpdate();
  el('fProc').value = 'any'; T.update();
}

// Szenario 27: Länder-Autocomplete (Land-Filter & Meiden)
console.log('--- S27 Länder-Autocomplete ---');
{
  assert(T.ctrySuggest('deut')[0].code === 'DE', 'S27 „deut" → DE Deutschland');
  assert(T.ctrySuggest('germany')[0].code === 'DE', 'S27 „germany" → DE');
  assert(T.ctrySuggest('irische republik')[0].code === 'IE', 'S27 „irische republik" → IE');
  assert(T.ctrySuggest('irish').some(c => c.code === 'IE'), 'S27 „irish" → IE in Vorschlägen');
  assert(T.ctrySuggest('lux')[0].code === 'LU', 'S27 „lux" → LU Luxemburg');
  const ukSug = T.ctrySuggest('united kingdom');
  assert(ukSug.length > 0 && ukSug.every(c => c.code === 'GB' || c.code === 'UK'), 'S27 „united kingdom" → nur GB/UK');
  assert(T.ctrySuggest('de').every(c => T.CTRY_CNT[c.code] != null), 'S27 Vorschläge haben Platzanzahl aus der DB');
  assert(T.ctryChain('uk,it,ger', 'DE') === 'uk,it,DE,', 'S27 Anfügen an bestehende Kette ersetzt Fragment');
  assert(T.ctryChain('ger', 'LU') === 'LU,', 'S27 Leeres Feld → Code + Komma');
  assert(T.ctryChain('uk,it,', 'DE') === 'uk,it,DE,', 'S27 Fragment nach Komma wird ersetzt');
  // Popup: zeigen, per Commit übernehmen, Liste schließt
  el('ctry').value = 'deut'; T.ctryShow(el('ctry'));
  assert(el('ctrySug').style.display === 'block' && el('ctrySug').innerHTML.includes('DE'), 'S27 Popup zeigt Vorschläge');
  T.ctryCommit(el('ctry'), 'DE');
  assert(el('ctry').value === 'DE,' && el('ctrySug').style.display === 'block', 'S27 Commit fügt DE, ein — Popup bleibt mit Top-Liste offen');
  assert(el('ctrySug').innerHTML.includes('have'), 'S27 Bereits gewähltes Land in der Top-Liste gedimmt (have)');
  el('fProc').value = 'all'; T.update();
  assert(T.lastFiltered.length === T.CTRY_CNT['DE'] && T.lastFiltered.every(i => T.AP[i][2] === 'DE'), 'S27 Nach Commit: Filter liefert genau die DE-Plätze');
  // Meiden-Feld im Welt-Modus: gleiche Mechanik
  el('wAvoid').value = 'ru,'; T.ctryShow(el('wAvoid'));
  assert(el('ctrySug').style.display === 'block' && el('ctrySug').innerHTML.includes('US'), 'S27 Meiden-Feld: leeres Fragment nach Komma → Top-Liste zum Weitertippen');
  el('wAvoid').value = 'kaz'; T.ctryShow(el('wAvoid'));
  assert(el('ctrySug').innerHTML.includes('KZ'), 'S27 Meiden-Feld: „kaz" → Kasachstan Vorschlag');
  T.ctryCommit(el('wAvoid'), 'KZ');
  assert(el('wAvoid').value === 'KZ,', 'S27 Meiden-Feld: Commit ergibt KZ,');
  el('wAvoid').value = ''; el('ctry').value = ''; el('fProc').value = 'any'; T.update();
}

// Szenario 28: DOM-Reihenfolge — alles, was das Script beim Start anspricht, muss VOR dem Script-Block stehen
// (im echten Browser läuft der Script, bevor dahinter stehende Elemente existieren; Mock erzeugt sie sonst automatisch)
console.log('--- S28 DOM-Reihenfolge im gebauten HTML ---');
{
  const src = fs.readFileSync('MSFS_Airport_Scout.html', 'utf8');
  const scriptStart = src.indexOf('<script>');
  const after = src.slice(src.lastIndexOf('</script>'));
  const idsAfter = after.match(/id="[^"]+"/g) || [];
  assert(idsAfter.length === 0, 'S28 Keine Elemente mit id nach dem Script-Block (' + (idsAfter.join(', ') || 'ok') + ')');
  const sugPos = src.indexOf('id="ctrySug"');
  assert(sugPos > -1 && sugPos < scriptStart, 'S28 ctrySug-Popup-Div steht vor dem Script (im Browser zur Init-Zeit im DOM)');
}

// Szenario 29: Ländernamen direkt verstehen — kein „Null-Treffer"-Fall mehr beim Namen statt Code
console.log('--- S29 Länder-Namen im Filter & Meiden ---');
{
  assert(T.ctryResolve('deut') === 'DE', 'S29 Resolve „deut" → DE');
  assert(T.ctryResolve('germany') === 'DE', 'S29 Resolve „germany" → DE');
  assert(T.ctryResolve('österreich') === 'AT', 'S29 Resolve „österreich" → AT');
  assert(T.ctryResolve('lux') === 'LU', 'S29 Resolve „lux" → LU');
  assert(T.ctryResolve('de') === 'DE', 'S29 Code bleibt Code: „de" → DE');
  assert(T.ctryResolve('irish') === 'IE', 'S29 Resolve „irish" → IE');
  assert(T.ctryResolve('a') === null, 'S29 „a" mehrdeutig → null');
  assert(T.ctryResolve('united kingdom') === null, 'S29 „united kingdom" (GB+UK) mehrdeutig → null');
  assert(T.ctryResolve('xyzq') === null, 'S29 Unbekanntes „xyzq" → null');
  // Name im Land-Feld filtert sofort wie der Code
  el('q').value = ''; el('fProc').value = 'all'; el('ctry').value = 'deutschland'; T.update();
  assert(T.lastFiltered.length === T.CTRY_CNT['DE'] && T.lastFiltered.every(i => T.AP[i][2] === 'DE'), 'S29 „deutschland" im Land-Feld filtert wie DE');
  // Unbekannter Token: leer + Benennung statt stummem „Filter lockern"
  el('ctry').value = 'gernmany'; T.update();
  assert(T.lastFiltered.length === 0 && el('tbody').innerHTML.includes('Unbekanntes Land'), 'S29 Unbekannter Name → leer + „Unbekanntes Land: gernmany"');
  // Meiden-Feld mit Namen im Welt-Modus
  const _r29 = Math.random; Math.random = () => 0.5;
  el('ctry').value = ''; el('fProc').value = 'any'; el('routeMode').value = 'world'; el('rDur').value = '2.5'; el('rTol').value = '30'; el('wAvoid').value = 'china,russia'; T.routeUpdate();
  const wl29 = global.window.worldLegs || [];
  const intoC29 = wl29.filter(l => T.AP[l.j][2] === 'CN').length;
  const intoR29 = wl29.filter(l => T.AP[l.j][2] === 'RU').length;
  assert(wl29.length >= 3 && intoC29 <= 1 && intoR29 <= 1, 'S29 Meiden „china,russia" wirkt wie CN,RU (max. 1 Lückenhüpfer je Land)');
  assert(el('routeInfo').textContent.includes('meidet CN'), 'S29 Meidliste in routeInfo zeigt aufgelöste Codes');
  Math.random = _r29;
  el('wAvoid').value = ''; el('routeMode').value = 'off'; el('rDur').value = '1.5'; el('rTol').value = '15'; T.routeUpdate(); T.update();
}

// Szenario 30: Popup überlebt Scroll-Events des Eingabefelds (Horizontal-Scroll bei langer Kette), Seiten-Scroll schließt
console.log('--- S30 Scroll-Regression ---');
{
  el('ctry').value = 'DE,AT,LU,ger'; T.ctryShow(el('ctry'));
  assert(el('ctrySug').style.display === 'block' && el('ctrySug').innerHTML.includes('DE'), 'S30 Popup mit Fragment „ger" offen');
  (global.window.__l.scroll || []).forEach(f => f({ target: el('ctry') }));
  assert(el('ctrySug').style.display === 'block', 'S30 Scroll vom Eingabefeld (Horizontal-Scroll zum Caret) schließt Popup nicht');
  (global.window.__l.scroll || []).forEach(f => f({ target: global.document }));
  assert(el('ctrySug').style.display === 'none', 'S30 Seiten-Scroll (document) schließt Popup');
  // Ketten-Eingabe über Popup in Serie: dreimal committen, Popup bleibt hilfsbereit
  el('ctry').value = ''; T.ctryShow(el('ctry'));
  T.ctryCommit(el('ctry'), 'DE'); T.ctryCommit(el('ctry'), 'AT'); T.ctryCommit(el('ctry'), 'LU');
  assert(el('ctry').value === 'DE,AT,LU,' && el('ctrySug').style.display === 'block', 'S30 Dritte Eingabe in Serie: Kette DE,AT,LU, und Popup bleibt offen');
  el('ctry').value = ''; T.update();
}

// Szenario 31: Reroll springt auf komplette Umrundungen, Roll#-Zähler
console.log('--- S31 Reroll/Roll# ---');
{
  const _r31 = Math.random; Math.random = () => 0.5;
  el('routeMode').value = 'world'; el('rDur').value = '2.5'; el('rTol').value = '60'; el('wAvoid').value = '';
  T.routeUpdate();
  assert(T.worldOk === true, 'S31 Erste Welt-Route ist komplett (ungültige Versuche übersprungen)');
  assert(el('wRollN').textContent.startsWith('Roll# 1'), 'S31 Roll# 1 nach Start');
  el('wRoll').onclick();
  assert(el('wRollN').textContent.startsWith('Roll# 2') && T.worldOk === true, 'S31 Reroll → Roll# 2, wieder komplett');
  Math.random = _r31;
  el('routeMode').value = 'off'; el('rDur').value = '1.5'; el('rTol').value = '15'; T.routeUpdate();
}

// Szenario 32: Ländergrenzen (dünn schwarz) + Orientierungsseen auf der Karte
console.log('--- S32 Grenzen & Seen ---');
{
  assert(T.BORDERS.length > 200 && T.LAKES.length > 300, 'S32 Geo-Daten eingebettet (' + T.BORDERS.length + ' Grenzlinien, ' + T.LAKES.length + ' Seen)');
  const near = (l, lo, la) => l[1].some((v, i) => i % 2 === 0 && Math.abs(v - lo) < 0.6) && l[1].some((v, i) => i % 2 === 1 && Math.abs(v - la) < 0.5);
  assert(T.LAKES.some(l => near(l, 10.8, 45.6)), 'S32 Gardasee vorhanden');
  assert(T.LAKES.filter(l => near(l, 11.3, 48.0)).length >= 2, 'S32 Starnberger + Ammersee vorhanden');
  assert(T.LAKES.some(l => near(l, 11.35, 47.67)), 'S32 Kochelsee vorhanden');
  global.window.setCam(640, 320, 1);   // Weltansicht (vorherige Szenarien haben gezoomt)
  segs.length = 0; T.drawMap();
  assert(segs.filter(s => s.col === '#000').length > 500, 'S32 Ländergrenzen dünn schwarz gezeichnet');
  assert(segs.filter(s => s.col === '#2a4f77').length > 100, 'S32 Seen-Umrisse gezeichnet');
}

// Szenario 33: Details ohne NaN-Piste, Frequenzen als Funk-Zeile, farbige Flags, ATIS im Mouseover
console.log('--- S33 Details & Frequenzen ---');
{
  const withComms = T.AP.map(r => r[0]).filter(ic => T.rwCommsOf(ic).length > 0);
  assert(withComms.length > 1000, 'S33 Frequenz-Daten erkannt (vorher als NaN-Piste gerendert): ' + withComms.length + ' Airports');
  const ic = withComms.includes('EDDF') ? 'EDDF' : withComms[0];
  const idx = T.byIcao.get(ic);
  T.selectAirport(idx, { noMapFocus: true });
  const det = el('detail').innerHTML;
  assert(!det.includes('NaN'), 'S33 Keine NaN-Piste mehr in den Details');
  assert(!det.includes('Funk:'), 'S33 Funk-Zeile entfernt — Details kompakter');
  assert(det.includes('ILS') && det.includes('RNAV') && det.includes('ATIS') && det.includes('TWR'), 'S33 Flags ILS/RNAV/ATIS/TWR in der Flag-Zeile');
  assert(det.includes(' ft</b>') && !det.includes(' m</b>'), 'S33 Pistenlänge nur in ft (Meter raus)');
  // Airport ohne ILS → Flag rot
  const woIls = T.AP.findIndex(r => !r[9]);
  T.selectAirport(woIls, { noMapFocus: true });
  assert(el('detail').innerHTML.includes('ILS ✗'), 'S33 ILS fehlt → rote Flag mit ✗');
  assert(el('detail').innerHTML.includes('color:#ff6b6b'), 'S33 Fehlende Features rot');
  // Mouseover mit ATIS
  const th = T.tipHtml(idx);
  assert(th.includes('ATIS'), 'S33 Mouseover zeigt ATIS');
  const thNo = T.tipHtml(woIls);
  assert(thNo.includes('class="no"'), 'S33 Mouseover: fehlende Features rot');
}

// Szenario 34: Spaltenfolge — Elev ft und Surf hinter Gates, vor IATA
console.log('--- S34 Spaltenfolge ---');
{
  T.update();
  const th = el('thead').innerHTML;
  const pos = s => th.indexOf(s);
  assert(pos('Gates') < pos('Elev ft') && pos('Elev ft') < pos('Surf') && pos('Surf') < pos('IATA'), 'S34 Reihenfolge Gates → Elev ft → Surf → IATA');
  assert(pos('Elev ft') > pos('RWY ft'), 'S34 Elev ft nicht mehr vorn (hinter RWY-Block)');
}

// Szenario 35: Import — Textzeile bleibt, Savegame-Datei-Funktion nutzt gleiche Logik
console.log('--- S35 Import ---');
{
  assert(T.importData('kein json') === false, 'S35 Ungültiges Format → false mit Meldung');
  assert(el('impOut').textContent.includes('fehlgeschlagen'), 'S35 Fehlermeldung im Ausgabefeld');
  const ok = T.importData(JSON.stringify({ pkg: { EDDF: 3 } }));
  assert(ok === true && T.catOf(T.byIcao.get('EDDF')) === 3, 'S35 Savegame-Import (pkg) wirkt sofort');
  assert(el('impOut').textContent === 'Import ok.', 'S35 Import ok.');
  el('impIn').value = JSON.stringify({ pkg: {} });
  el('impBtn').onclick();
  assert(T.catOf(T.byIcao.get('EDDF')) !== 3, 'S35 Textzeilen-Import (weiterhin vorhanden) funktioniert');
  el('impIn').value = '';
}

// Szenario 36: Wetter-Layer — Wind-Pfeile farbcodiert, Regen-Overlay, Legende
console.log('--- S36 Wetter-Layer ---');
{
  global.window.windSet([{ la: 47, lo: 11, sp: 150, dir: 270 }, { la: 0, lo: 0, sp: 30, dir: 90 }]);
  assert(el('windLeg').style.display === 'inline', 'S36 Wind-Legende sichtbar');
  global.window.setCam(640, 320, 1);   // Weltansicht — beide Pfeile im Sichtbereich
  segs.length = 0; T.drawMap();
  assert(segs.filter(s => s.col === '#ff3b3b').length >= 2, 'S36 Jetkern 150 kt rot gezeichnet');
  assert(segs.filter(s => s.col === '#7f8b96').length >= 2, 'S36 Schwacher Wind grau gezeichnet');
  global.window.windClear();
  assert(el('windLeg').style.display === 'none', 'S36 Wind-Legende aus nach Clear');
  segs.length = 0; T.drawMap();
  assert(segs.filter(s => s.col === '#ff3b3b').length === 0, 'S36 Keine Wind-Pfeile mehr nach Clear');
  global.window.precipSet({ w: 2, h: 1 });
  assert(el('rainLeg').style.display === 'inline', 'S36 Regen-Legende sichtbar');
  T.drawMap();   // Overlay aktiv, kein Fehler
  global.window.precipClear();
  assert(el('rainLeg').style.display === 'none', 'S36 Regen-Legende aus nach Clear');
  T.drawMap();
}

// Szenario 37: AI-Prio-Flags sind Teil des Daten-Exports/Imports (pkgOverride wird 1:1 gesichert)
console.log('--- S37 AI Prio im Settings-Export ---');
{
  const eddf = T.byIcao.get('EDDF');
  el('flagIcao').value = 'EDDF'; el('flagCat').value = '4'; el('flagGo').onclick();
  assert(T.catOf(eddf) === 4, 'S37 AI-Prio gesetzt (Kategorie 4)');
  const pkg = JSON.parse(store['asc_pkg'] || '{}');
  assert(pkg.EDDF === 4, 'S37 AI-Prio steht im gespeicherten pkgOverride (asc_pkg) — Basis des Exports');
  assert(T.importData(JSON.stringify({ pkg })) === true, 'S37 Export/importierter pkg-Block wird akzeptiert');
  assert(T.catOf(eddf) === 4, 'S37 AI-Prio überlebt den Import (pkgOverride wird komplett übernommen)');
  const built = fs.readFileSync('MSFS_Airport_Scout.html', 'utf8');
  assert(built.includes('pkg:pkgOverride'), 'S37 Export enthält pkgOverride komplett (auch Kategorie 4)');
  el('flagIcao').value = 'EDDF'; el('flagCat').value = '-1'; el('flagGo').onclick();
  assert(T.catOf(eddf) !== 4, 'S37 Aufräumen: Werkseinstellung entfernt AI-Prio-Flag');
}

// Szenario 38: Route-Filter — HQ-Route und mind. 1× Ausstattung (nur Paare/Ab Start, Liste+Karte unangetastet)
console.log('--- S38 Route-Filter HQ / 1× Features ---');
{
  T.importData(JSON.stringify({ pkg: { EDDM: 2, LOWI: 3, LSZS: 3, EPKK: 2, LFMN: 3 } }));   // definierte HQ-Häfen für den Test (EPKK 800 km, LFMN 716 km — sicher im 1,5-h-Band ab EDDF)
  el('q').value = ''; el('ctry').value = 'DE,AT'; el('rwyMin').value = '2000'; el('surf').value = 'P'; el('fProc').value = 'any'; T.update();
  el('routeMode').value = 'pairs'; el('rDur').value = '1.0'; el('rTol').value = '30'; T.routeUpdate();
  const info = () => parseInt((el('routeInfo').textContent.match(/(\d+) Paare/) || [0, 0])[1], 10);
  const n0 = info();
  const nList0 = T.lastFiltered.length;
  assert(n0 > 50, 'S38 Paar-Grundmenge ohne Filter (' + n0 + ' Paare)');
  assert(el('rtFilterWrap').style.display !== 'none', 'S38 Route-Filter sichtbar im Paar-Modus');
  // HQ: mindestens ein Ende blau (2) oder grün (3)
  el('rfHQ').checked = true; T.routeUpdate();
  const nHQ = info();
  assert(nHQ > 0 && nHQ < n0, 'S38 HQ-Route reduziert die Paarmenge (' + nHQ + ' von ' + n0 + ')');
  assert((T.routePairs || []).every(p => [2, 3].includes(T.catOf(p.i)) || [2, 3].includes(T.catOf(p.j))), 'S38 HQ-Route: jedes Paar hat mind. 1 hochwertigen Flughafen');
  assert(el('routeInfo').textContent.includes('HQ-Route'), 'S38 Filter-Tag in der blauen Infozeile');
  assert(T.lastFiltered.length === nList0, 'S38 Airport-Ergebnisliste bleibt von HQ unberührt');
  // 1× ILS
  el('rfHQ').checked = false; el('rfILS').checked = true; T.routeUpdate();
  const nIls = info();
  assert(nIls > 0 && nIls < n0 && (T.routePairs || []).every(p => T.AP[p.i][9] || T.AP[p.j][9]), 'S38 1×ILS: mind. ein Ende pro Paar hat ILS (' + nIls + ' von ' + n0 + ')');
  // 1× ILS+TWR: derselbe Flughafen muss beide haben
  el('rfTWR').checked = true; T.routeUpdate();
  assert((T.routePairs || []).every(p => (T.AP[p.i][9] && T.AP[p.i][13]) || (T.AP[p.j][9] && T.AP[p.j][13])), 'S38 1×ILS+TWR: ein Flughafen je Paar hat beide Features (gleicher Flughafen)');
  el('rfILS').checked = false; el('rfTWR').checked = false; T.rfSave(); T.routeUpdate();
  assert(info() === n0, 'S38 Filter raus: alle validen Kombinationen wieder da');
  // Ab-Start-Modus: AI-Start → nur hochwertige Ziele; blauer Start → nur grüne Ziele
  el('ctry').value = ''; el('rwyMin').value = ''; el('surf').value = '-1'; T.update();
  const eddf = T.byIcao.get('EDDF');   // ohne Import = AI (rot)
  assert(T.catOf(eddf) === 0, 'S38 EDDF Start = AI (rot)');
  el('routeMode').value = 'from'; el('rOrig').value = 'EDDF'; el('rDur').value = '1.5'; el('rTol').value = '15'; T.routeUpdate();
  assert((T.routePairs || []).length > 0, 'S38 Ab Start EDDF: Ziele vorhanden');
  el('rfHQ').checked = true; T.routeUpdate();
  assert((T.routePairs || []).length > 0 && (T.routePairs || []).every(p => [2, 3].includes(T.catOf(p.j))), 'S38 AI-Start + HQ: nur blaue/grüne Ziele (kein AI zu AI)');
  el('flagIcao').value = 'EDDF'; el('flagCat').value = '2'; el('flagGo').onclick(); T.routeUpdate();   // EDDF blau (Asobo)
  assert((T.routePairs || []).length > 0 && (T.routePairs || []).every(p => T.catOf(p.j) === 3), 'S38 blauer Start + HQ: alle Ziele grün (3rd-Party)');
  el('flagCat').value = '-1'; el('flagGo').onclick(); el('rfHQ').checked = false; T.rfSave();
  T.importData(JSON.stringify({ pkg: {} }));   // Aufräumen
  el('routeMode').value = 'off'; el('rOrig').value = ''; T.routeUpdate(); T.update();
  const rtf = JSON.parse(store['asc_rt_v1'] || '{}').rf;
  assert(rtf && rtf.hq === false && rtf.ils === false, 'S38 Route-Filter-Zustand persistiert (asc_rt_v1.rf)');
}

// Szenario 39: Wind — ab Zoom 18 feste 2×2-Verfeinerung (4 Pfeile je Gitterzelle, konstant unabhängig vom Zoom)
console.log('--- S39 Wind 2×2 ab Zoom 18 ---');
{
  global.window.windSet([{ la: 30, lo: -10, sp: 100, dir: 250 }, { la: 30, lo: 30, sp: 60, dir: 260 }, { la: 60, lo: -10, sp: 90, dir: 240 }, { la: 60, lo: 30, sp: 120, dir: 250 }]);
  global.window.setCam(640, 320, 1);   // Weltansicht
  segs.length = 0; T.drawMap();
  const raw = segs.filter(s => ['#7f8b96', '#4aa3ff', '#ffd23b', '#ff3b3b'].includes(s.col)).length;
  assert(raw === 24, 'S39 Weltansicht: 4 Roh-Pfeile × 3 Striche × 2 Kopien = 24 (' + raw + ')');
  const WCOLS = ['#7f8b96', '#4aa3ff', '#ffd23b', '#ff3b3b'];
  const arrowsAt = z => Math.round(segs.filter(s => WCOLS.includes(s.col) && Math.abs(s.lw - 1.5 / z) < 1e-9).length / 6);   // Wind-Pfeile: lineWidth 1,5/zoom — Pisten-Symbole (lw 3) und Routen (andere Farbe) raus
  const cx = (10 + 180) / 360 * 1280, cy = (90 - 45) / 180 * 640;   // Zellzentrum (45°N, 10°E)
  global.window.setCam(cx, cy, 17); segs.length = 0; T.drawMap();
  const n17 = arrowsAt(17);
  global.window.setCam(cx, cy, 18); segs.length = 0; T.drawMap();
  const n18 = arrowsAt(18);
  assert(n18 > n17 && n18 >= 4 && n18 <= 40, 'S39 ab Zoom 18: 2×2-Verfeinerung aktiv (' + n18 + ' statt ' + n17 + ' Pfeile im Ausschnitt)');
  global.window.setCam(cx, cy, 60); segs.length = 0; T.drawMap();
  const n60 = arrowsAt(60);
  assert(n60 >= 1 && n60 <= n18, 'S39 Zoom 60: nur das feste Gitter, keine Verdichtung (' + n60 + ' statt ' + n18 + ')');
  global.window.setCam(cx, cy, 200); segs.length = 0; T.drawMap();
  const n200 = arrowsAt(200);
  assert(n200 >= 1 && n200 <= n60, 'S39 maximaler Zoom: Pfeilzahl steigt nie mehr (' + n200 + ')');
  global.window.windClear();
}

// Szenario 40: Grenzen — durchgehend hochauflösend (NE 10m), bildschirm-konstant feine Linie in jeder Zoomstufe
console.log('--- S40 Grenzen hochauflösend ---');
{
  assert(T.BORDERS_HI.length > T.BORDERS.length * 5, 'S40 10m-Grenzen eingebettet (' + T.BORDERS_HI.length + ' Linien vs ' + T.BORDERS.length + ' in 110m)');
  const deBB = l => l[0][0] < 15.1 && l[0][2] > 5.8 && l[0][1] < 55.2 && l[0][3] > 47.2;
  assert(T.BORDERS_HI.filter(deBB).length > 100, 'S40 Deutschlands Grenzen komplett in 10m (' + T.BORDERS_HI.filter(deBB).length + ' Linien in DE-BBox)');
  global.window.setCam(675, 150, 8);   // Deutschland-Ansicht
  segs.length = 0; T.drawMap();
  const bd = segs.filter(s => s.col === '#000');
  assert(bd.length > 500, 'S40 10m-Grenzen gezeichnet (Zoom 8) (' + bd.length + ' Segmente)');
  assert(bd.every(s => Math.abs(s.lw * 8 - 1.1) < 0.01), 'S40 Grenzen bildschirm-konstant 1,1 px bei Zoom 8 (kein Aufdicken)');
  global.window.setCam(640, 320, 1);
  segs.length = 0; T.drawMap();
  const bd1 = segs.filter(s => s.col === '#000');
  assert(bd1.length > 500, 'S40 Weltansicht: 10m-Grenzen in jeder Zoomstufe');
  assert(bd1.every(s => Math.abs(s.lw - 1.1) < 0.01), 'S40 Weltansicht: dieselbe Bildschirm-Breite wie bei Zoom 8');
  global.window.setCam(675, 150, 60);   // Bodensee — Grenzen im tiefen Zoom
  segs.length = 0; T.drawMap();
  const bd60 = segs.filter(s => s.col === '#000');
  assert(bd60.length > 0 && bd60.every(s => Math.abs(s.lw * 60 - 1.1) < 0.01), 'S40 Zoom 60: weiterhin ~1,1 px auf dem Bildschirm (vorher zoom-Pixel breit)');
}

// Szenario 41: Mtn-Spalte konsistent zur Karte gefärbt (0/1 weiß, 2 gelb, 3 rot)
console.log('--- S41 Mtn-Farben in der Ergebnisliste ---');
{
  el('q').value = ''; el('fMtnMin').value = '2'; T.update();
  const tb = el('tbody').innerHTML;
  assert(tb.includes('color:#ffd23b">▲2<'), 'S41 Berg (2) gelb in der Mtn-Spalte');
  assert(tb.includes('color:#ff3b3b">▲3<'), 'S41 Hochgebirge (3) rot in der Mtn-Spalte');
  assert(!tb.includes('class="tri"'), 'S41 alter Orange-Tri-Klassen-Farbcode raus');
  el('fMtnMin').value = '0';
  const hill = T.AP.find(r => r[21] === 1 && (r[9] || r[11]));   // Hügel mit Verfahren — sonst greift der Procedures-Standardfilter
  el('q').value = hill[0]; T.update();
  assert(el('tbody').innerHTML.includes('color:#c9d4de">▲<'), 'S41 Hügel (1) weißes ▲ ohne Zahl (' + hill[0] + ')');
  el('q').value = ''; T.update();
}

// Szenario 42: Berg-Dreieck über dem Airport-Symbol ab Zoom 30 (gelb/rot wie in der Liste)
console.log('--- S42 Berg-Symbol auf der Karte ab Zoom 30 ---');
{
  T.update();
  const lowi = T.byIcao.get('LOWI');
  assert(T.AP[lowi][21] === 3, 'S42 LOWI ist Hochgebirge');
  global.window.setCam((11.35 + 180) / 360 * 1280, (90 - 47.26) / 180 * 640, 32);   // Alpen-Ansicht
  fills.length = 0; segs.length = 0; T.drawMap();
  const tris = fills.filter(f => f.pts.length === 3 && (f.col === '#ff3b3b' || f.col === '#ffd23b'));
  assert(tris.length >= 2, 'S42 Berg-Dreiecke über den Airport-Symbolen (' + tris.length + ' Stück, LOWI-Umfeld)');
  assert(fills.some(f => f.pts.length === 3 && f.col === '#ff3b3b'), 'S42 Hochgebirge rot als Dreieck');
  global.window.setCam(640, 320, 1);
  fills.length = 0; T.drawMap();
  assert(fills.filter(f => f.pts.length === 3 && (f.col === '#ff3b3b' || f.col === '#ffd23b')).length === 0, 'S42 unter Zoom 30 keine Berg-Dreiecke');
}

// Szenario 43: Detail-Zeile 1 neu — alles in einer Zeile, Zeile 2 aufgelöst
console.log('--- S43 Detail-Zeile-1-Redesign ---');
{
  T.selectAirport(T.byIcao.get('EDDF'), { noMapFocus: true });
  const det = el('detail').innerHTML;
  assert(det.includes('EDDF/FRA'), 'S43 ICAO/IATA kombiniert (EDDF/FRA)');
  assert(det.includes('DE 🇩🇪'), 'S43 Land mit Flagge, Leerzeichen dazwischen');
  assert(det.includes('<b>13123 ft</b>') && !det.includes('▬'), 'S43 Pistenlänge fett ohne Symbol');
  assert(det.includes('Asphalt') && !det.includes('▦'), 'S43 Surface als Wort dahinter (kein Symbol)');
  assert(!det.includes('MagVar'), 'S43 MagVar entfernt (Details kompakt)');
  assert(!det.includes('✈'), 'S43 kein ✈-Symbol mehr');
  assert(!det.includes('RWY max'), 'S43 Zeile 2 aufgelöst (kein separates RWY-max mehr)');
  assert(!det.replace(/title="[^"]*"/g, '').includes('Package-Daten:'), 'S43 Package-Daten als Symbolik statt Worte (Worte nur im Tooltip)');
  assert(det.includes('▣'), 'S43 Package-Symbol ▣ (Scan) rechts außen');
  assert(det.includes('● AI Generated'), 'S43 Kategorie farbcodiert rechts außen');
  assert(det.includes('ILS') && det.includes('PAPI'), 'S43 Flag-Zeile bleibt');
  assert(!det.includes('Funk:'), 'S43 Funk-Zeile bleibt raus');
  // Route-Filter-UI: im aus-Modus verborgen
  el('routeMode').value = 'off'; T.routeUpdate();
  assert(el('rtFilterWrap').style.display === 'none', 'S43 Route-Filter im aus-Modus verborgen');
}

// Szenario 44: Grenzen ohne Stufen (volle Koordinatenpräzision) + kompakte 1-zeilige Routen-Info
console.log('--- S44 Grenz-Präzision · Infozeile 1-zeilig ---');
{
  // BORDERS_HI: Koordinaten dürfen nicht mehr auf 0,01° gerundet sein (Zigzag/Treppen ab Zoom 18+)
  let dec3 = 0, tot = 0;
  for (const bd of T.BORDERS_HI) { const p = bd[1];
    for (let k = 0; k < p.length; k += 2) { tot++;
      const s = String(p[k]);
      if (s.includes('.') && s.split('.')[1].length >= 3) dec3++; } }
  assert(dec3 > 20000, 'S44 Grenzkoordinaten hochpräzise (>=3 Dezimalstellen: ' + dec3 + ' von ' + tot + ')');
  assert(T.BORDERS_HI.length > 5000, 'S44 10m-Grenzen weiterhin vollständig (' + T.BORDERS_HI.length + ' Linien)');

  // Infozeile kompakt: Paare + Basis, keine Floskeln — SimBrief-Button passt davor
  el('rfHQ').checked = false; el('rfILS').checked = false; el('rfProc').checked = false;
  el('rfTWR').checked = false; el('rfATIS').checked = false; el('rfPAPI').checked = false;
  el('routeMode').value = 'pairs'; T.routeUpdate();
  const txt = el('routeInfo').textContent;
  assert(/Paare/.test(txt) && /Basis \d+/.test(txt), 'S44 Infozeile kompakt (Paare + Basis)');
  assert(!txt.includes('Grundmenge:') && !txt.includes('Anzeige:'), 'S44 lange Floskeln raus');
  // Span trägt nowrap — Zeile bricht nie intern um
  assert(/id="routeInfo"[^>]*white-space:nowrap/.test(html), 'S44 Infozeile nowrap im Markup (1 Zeile garantiert)');
  // Filter-Tags weiter kompakt getrennt
  el('rfHQ').checked = true; el('rfILS').checked = true; T.routeUpdate();
  const txt2 = el('routeInfo').textContent;
  assert(txt2.includes('HQ-Route') && txt2.includes('1× ILS') && !txt2.includes('Filter:'), 'S44 Filter-Tags ohne "Filter:"-Präfix');
}

// Szenario 45: Airport-Liste 2 Zeilen kürzer — Summary-Zeile der Route ohne Scrollen sichtbar
console.log('--- S45 Layout: Liste 2 Zeilen kürzer ---');
{
  el('filterPanel').offsetHeight = 100; global.window.innerHeight = 800;
  T.layoutHeight();
  const expect = Math.max(220, Math.round((800 - 100 - 28) * 0.6) - 50) + 'px';
  assert(el('listWrap').style.height === expect, 'S45 Listenhöhe um 2 Zeilen (50 px) gekürzt (' + el('listWrap').style.height + ')');
}

// Szenario 46: Mobil-Adaption — Touch-Tap-Auswahl, Klappen, Status-Spiegel, Viewport
console.log('--- S46 Mobil: Tap/Klappen/Status ---');
{
  assert(/name="viewport" content="width=device-width/.test(html), 'S46 Viewport-Meta für iPhone vorhanden');
  assert(/touch-action:none/.test(html) && /#map\{[^}]*touch-action/.test(html), 'S46 Canvas blockt Seiten-Scroll (touch-action:none)');
  assert(html.includes('id="frows"') && html.includes('id="rctl"'), 'S46 Filter/Routen-Steuerung in Klapp-Container');
  // Klappen: Toggle verbergen/zeigen
  el('fToggle').onclick();
  assert(el('frows').style.display === 'none', 'S46 ☰ Filter klappt Filter zu');
  el('fToggle').onclick();
  assert(el('frows').style.display !== 'none', 'S46 ☰ Filter klappt Filter wieder auf');
  // Route-Modus: Auswahl über die vier Buttons direkt unter der Karte (Klappe entfallen)
  assert(el('rmWrap') && el('rmOff') && el('rmFrom') && el('rmPairs') && el('rmWorld'), 'S46 Route-Modus-Buttons (Aus/Ab Start/Paare/Welt) vorhanden');
  el('rOrig').value = 'EDDF';
  el('rmFrom').onclick();
  assert(el('routeMode').value === 'from', 'S46 Modus-Button ➤ Ab Start stellt den Modus um');
  assert(el('rmFrom').classList.contains('act') === true && el('rmOff').classList.contains('act') === false, 'S46 aktiver Modus-Button farblich markiert');
  el('rmOff').onclick();
  assert(el('routeMode').value === 'off' && el('rmOff').classList.contains('act') === true, 'S46 zurück auf ✈ Aus — Markierung folgt');
  // Status-Spiegel: routeInfoM hängt mit routeInfo zusammen
  T.setRi('Test-Status 123');
  assert(el('routeInfo').textContent === 'Test-Status 123' && el('routeInfoM').textContent === 'Test-Status 123', 'S46 setRi spiegelt Status in die mobile Statuszeile');
  // Tap auf der Karte wählt den Airport (wie Finger-Tap, größerer Radius) — sauberer Filterzustand
  el('q').value='';el('ctry').value='';el('rwyMin').value='';el('rwyMax').value='';el('gatesMin').value='';el('cont').value='';
  el('surf').value='-1';el('fMtnMin').value='0';el('fProc').value='any';
  el('fTwr').checked=false;el('fAtis').checked=false;el('fPapi').checked=false;el('fSched').checked=false;
  catBoxes.forEach(b=>b.checked=true);T.update();global.window.mapVisible=null;   // Cache der letzten drawMap umgehen — tapSelect nutzt jetztlastFiltered
  const iEDDF = T.byIcao.get('EDDF');const r = T.AP[iEDDF];
  const mx = (r[4] + 180) / 360 * 1280, my = (90 - r[3]) / 180 * 640;
  global.window.setCam(640, 320, 1);   // Weltansicht — Tap-Koordinaten sind Basis-Pixel
  T.tapSelect(mx, my, 2500);   // ~50 px Radius (finger-gerecht)
  assert(el('detail').innerHTML.includes('EDDF'), 'S46 Tap auf Kartenposition wählt EDDF (Details erscheinen)');
  const d2 = el('detail').innerHTML;global.window.setCam(640, 320, 1);   // erster Tap hat Kamera auf EDDF/zoom30 gezogen — zurück in Weltansicht
  const iLOWI = T.byIcao.get('LOWI');const r2 = T.AP[iLOWI];
  T.tapSelect((r2[4] + 180) / 360 * 1280, (90 - r2[3]) / 180 * 640, 2500);   // exakt auf LOWI (bei Zoom 1 liegen Nachbarn dicht)
  assert(el('detail').innerHTML.includes('LOWI') && el('detail').innerHTML !== d2, 'S46 zweiter Tap wechselt auf LOWI');
  const before = el('detail').innerHTML;
  T.tapSelect(30, 30, 25);   // Ozean — kein Airport in Reichweite
  assert(el('detail').innerHTML === before, 'S46 Tap ins Leere ändert nichts');
}

// Szenario 47: Kartenhöhe mobil (Welt/Viewport-Trennung), kompakte Details, Kategorie-Hinweis
console.log('--- S47 Höhe/Kompakt/Hinweis ---');
{
  assert(T.WBASE === 1280 && T.HBASE === 640, 'S47 Weltprojektion bleibt 1280×640 (Karte höher, ohne Verzerrung)');
  assert(T.W === 1280 && T.H === 640 && T.MAPSC === 1, 'S47 Desktop-/Test-Pfad: Viewport = Weltformat, MAPSC 1');
  T.sizeMap();
  assert(T.W === 1280 && T.H === 640, 'S47 sizeMap ohne Medienquery/Layout bleibt beim Weltformat (Headless-Guard)');
  T.update();
  assert(el('catHint').textContent.includes('ohne 📦 Packages-Import') && el('catHint').textContent.includes('Asobo-Werksplätze im Scan selten'), 'S47 Kategorie-Hinweis: Navigraph zählt als AI + Asobo selten');
  T.selectAirport(T.byIcao.get('EDDF'), { noMapFocus: true });
  const det = el('detail').innerHTML;
  assert(det.includes('<th>REIL</th>') && det.includes('<th>Surface</th>'), 'S47 Desktop-Pistentabelle bleibt vollständig');
  assert(!det.includes('MagVar') && !det.includes('Funk:'), 'S47 Details ohne MagVar und ohne Funk-Zeile');
}

// Szenario 48: Mobile Struktur — kein horizontales Scrollen, Ergebnisbereich, Panels, Kernspalten
console.log('--- S48 Mobile Struktur ---');
{
  assert(T.COLS_AP_M && T.COLS_AP_M.length === 6, 'S48 Airport-Liste mobil: 6 Kernspalten (ICAO/Name/RWY/Mtn/ILS/RNAV)');
  assert(T.RT_COLS_M && T.RT_COLS_M.length === 6, 'S48 Routenliste mobil: 6 Kernspalten (Marker/Von/Marker/Nach/nm/Zeit)');
  assert(html.includes('#routePanel{order:-1}'), 'S48 Route-Bereich mobil zwischen Karte und Ergebnisliste');
  assert(html.includes('#listWrap{height:55vh}'), 'S48 Ergebnisliste mobil 55vh — großer eigener Scrollbereich');
  assert(html.includes('#tab td{white-space:normal}'), 'S48 Listenzellen mobil umbrechbar — nichts läuft nach rechts');
  assert(html.includes('id="rmWrap"') && !html.includes('id="rToggle"'), 'S48 Modus-Buttons ersetzen die alte Routen-Klappe');
  assert(/#rmWrap\{display:flex/.test(html) && /\.rmBtn\{padding:12px/.test(html), 'S48 Modus-Buttons groß (finger-gerecht, 2×2-Raster)');
  T.update();
  assert(el('thead').innerHTML.split('<th').length - 1 === 15, 'S48 Desktop-Liste bleibt 15-spaltig (unverändert)');
  T.routeUpdate();
  assert(el('rThead').innerHTML.split('<th').length - 1 === 14, 'S48 Desktop-Routenliste bleibt 14-spaltig (unverändert)');
}

console.log('Headless-Test: alle Szenarien durchlaufen');