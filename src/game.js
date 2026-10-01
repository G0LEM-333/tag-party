/* =====================================================================
 * TAG PARTY - Phaser 3 platformer, 2-12 players, rooms over a WebSocket relay.
 * Everyone moves their OWN player locally (so your controls never wait on the network)
 * and just shares where they are. The host only referees the rules: who is IT, tags,
 * the timer, power-up orbs / powers, and relays everyone's positions.
 * ===================================================================== */
const W = 1280, H = 720;
const COLORS = [0xe53935, 0x1e88e5, 0x43a047, 0xfdd835, 0x8e24aa, 0xfb8c00,
                0x00acc1, 0xec407a, 0x8d6e63, 0xc0ca33, 0xffffff, 0x5c6bc0];
const NAMES = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE',
               'CYAN', 'PINK', 'BROWN', 'LIME', 'WHITE', 'INDIGO'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const FONT = '"Lilita One", "Arial Black", sans-serif';       // UI font (loaded from Google Fonts in index.html)
const CRATE = 38;                                             // crate size (meadow); the stack sits on the platform at y=585
const PINK = 0xff4081, GREEN = 0x3fae72, LEAF = 0x35b58a, TRUNK = 0xc2185b;   // meadow palette
const rampY = (R, x) => R.y1 + (x - R.x1) * (R.y2 - R.y1) / (R.x2 - R.x1);   // ramp surface height at x

/* ---------------- Maps ----------------
 * plats: [x, y, width]; the last one is the floor.   pads: x of the jump pads on the floor.
 * ramps: walkable diagonal slopes.   crates: [x, y] top-left.   ledge: [platform x, orb x] when a platform is mostly blocked.
 * floorSpots: [from x, to x] ranges where orbs may hover over the floor.   block: scenery keep-out ranges (per platform index).
 * pal: scenery colours + the small filler pieces.   To add a map: add an entry here plus its art functions in the level section.
 * Optional: makeScenery(g, pal) returns { kind: draw(px, y, k, leafColour, trunkColour) } and sizes = { kind: [height, halfWidth] } to replace the
 * default trees; scenery(g) draws hand-placed props. */
const MAPS = {
  meadow: {
    name: 'MEADOW', seed: 11, bg: bgMeadow, drawPlats: platsMeadow, drawRamp: rampMeadow, drawExtras: extrasMeadow,
    plats: [[0,130,150],[215,215,115],[55,295,115],[375,295,235],[680,295,410],
      [0,390,430],[605,390,530],[935,445,220],[365,490,250],[120,580,200],[1165,585,115],
      [640,185,235],[1070,190,210],[855,100,235],[400,70,150],[520,595,90],[900,560,80],[0,690,W]],
    pads: [330, 960],
    ramps: [{ x1: 615, y1: 490, x2: 846, y2: 628 },    // down-right from the end of platform 8
            { x1: 1000, y1: 690, x2: 1165, y2: 585 }],  // floor up to the right platform
    crates: [],
    ledge: null, floorSpots: [[40, 270], [390, 900]],
    block: { floor: [[985, 1180]], 8: [[570, 620]] },   // ramp foot / ramp head
    pal: { leafs: [LEAF, 0x2f9c78, 0x4cc79c, 0x63c174], trunks: [TRUNK, 0xa8144f], shade: 0x0d5c46, hi: 0x8fe8c4,
      bush: (g, px, y) => g.fillStyle(0x2f9c78).fillEllipse(px, y, 60, 50).fillStyle(0x8fe8c4, .45).fillEllipse(px - 12, y - 14, 16, 9),
      grass: (g, px, y) => g.fillStyle(0x2f9c78).fillTriangle(px - 12, y, px - 7, y - 18, px - 2, y)
        .fillTriangle(px - 6, y, px, y - 26, px + 6, y).fillTriangle(px + 2, y, px + 8, y - 16, px + 13, y) }
  },
  snow: {
    name: 'WINTER', seed: 23, bg: bgSnow, drawPlats: platsSnow, drawRamp: rampSnow, drawExtras: extrasSnow, scenery: sceneSnow,
    // Rows are 105px apart, so every platform is reachable with a single jump.
    plats: [[130,165,300],[560,165,250],[940,165,300],
      [0,270,230],[560,270,280],[990,270,290],
      [470,375,270],[860,375,250],
      [40,480,300],[420,480,280],[800,480,250],[1160,480,120],
      [120,585,260],[500,585,220],[850,585,250],[0,690,W]],
    pads: [260, 1030],
    ramps: [{ x1: 230, y1: 270, x2: 470, y2: 375 },     // down-right from the left ledge to the middle platform
            { x1: 1110, y1: 375, x2: 1250, y2: 480 }],  // down-right to the right ledge
    crates: [], ledge: null, floorSpots: [[50, 190], [340, 960], [1110, 1230]],
    block: { floor: [[395, 470]], 1: [[715, 800]], 2: [[1150, 1215]], 13: [[620, 690]] },   // snowmen and candy canes
    pal: { leafs: [0xbec0ff, 0xb3b7fb, 0xc9cbff, 0xaeb3fa], trunks: [0x6372c8, 0x5a68be], shade: 0x4a52b0, hi: 0xffffff,
      bush: (g, px, y) => g.fillStyle(0xe7e7ff).fillEllipse(px, y + 2, 64, 34).fillStyle(0xb9bcf5, .5).fillEllipse(px + 10, y + 8, 40, 14)
        .fillStyle(0xffffff, .65).fillEllipse(px - 12, y - 8, 20, 8),
      grass: (g, px, y) => g.fillStyle(0xd0d3ff).fillTriangle(px - 10, y, px - 6, y - 14, px - 1, y)
        .fillTriangle(px - 4, y, px + 1, y - 20, px + 6, y).fillTriangle(px + 2, y, px + 7, y - 12, px + 12, y) }
  },
  desert: {
    name: 'DESERT', seed: 37, bg: bgDesert, drawPlats: platsDesert, drawRamp: rampDesert, drawExtras: extrasDesert, scenery: sceneDesert,
    makeScenery: makeCacti, sizes: { saguaro: [124, 44], barrel: [50, 30], paddle: [92, 46], twin: [100, 24], sapling: [52, 18], palm: [196, 70] },
    // Same one-jump rows as the winter map, but built around a valley: one ramp runs down into the centre pit, another climbs back out.
    plats: [[40,165,210],[470,165,340],[1030,165,210],
      [0,270,150],[300,270,130],[850,270,130],[1130,270,150],
      [150,375,210],[560,375,160],[930,375,240],
      [30,480,170],[520,480,260],[1090,480,190],
      [200,585,240],[540,585,200],[900,585,200],[0,690,W]],
    pads: [50, 1150],
    ramps: [{ x1: 360, y1: 375, x2: 520, y2: 480 },     // down-right from the left ledge into the valley
            { x1: 780, y1: 480, x2: 930, y2: 375 }],    // up-right out of the valley onto the right ledge
    crates: [], ledge: null, floorSpots: [[190, 1080]],
    block: { floor: [[600, 690], [1190, 1280]], 1: [[715, 815]] },   // signpost, floor palm, top-row palm
    pal: { leafs: [0x2fbf71, 0x27a863, 0x3fcf84, 0x35b26a], trunks: [0x8d5a3b, 0x7a4c30], shade: 0x146b3c, hi: 0xbdf5d5,
      bush: (g, px, y) => g.fillStyle(0xb9692f).fillEllipse(px, y + 2, 46, 28).fillStyle(0xd48440).fillEllipse(px - 6, y - 1, 30, 18)
        .fillStyle(0xf6c48a, .8).fillEllipse(px - 10, y - 7, 12, 5),
      grass: (g, px, y) => g.fillStyle(0xc98a3c).fillTriangle(px - 12, y, px - 7, y - 16, px - 2, y)
        .fillTriangle(px - 6, y, px, y - 24, px + 6, y).fillTriangle(px + 2, y, px + 8, y - 14, px + 13, y) }
  },
  underwater: {
    name: 'UNDERWATER', seed: 53, bg: bgUnderwater, drawPlats: platsUnderwater, drawRamp: rampUnderwater, drawExtras: extrasUnderwater, scenery: sceneUnderwater,
    makeScenery: makeReef, sizes: { kelp: [150, 26], staghorn: [84, 46], fan: [100, 44], tube: [78, 26], brain: [26, 34], weed: [64, 24] },
    // Same one-jump rows as winter and desert, but a reef: staggered ramps.
    plats: [[30,165,200],[470,165,340],[1050,165,200],
      [0,270,110],[250,270,160],[870,270,160],[1170,270,110],
      [100,375,200],[520,375,240],[900,375,170],[1160,375,120],
      [0,480,150],[450,480,200],[850,480,200],[1130,480,150],
      [130,585,230],[500,585,200],[940,585,220],[0,690,W]],
    pads: [380, 1090],
    ramps: [{ x1: 300, y1: 375, x2: 450, y2: 480 },     // down-right from the left shelf onto the reef ledge
            { x1: 700, y1: 585, x2: 850, y2: 480 }],    // up-right from the low shelf onto the right reef
    crates: [], ledge: null, floorSpots: [[40, 330], [440, 1040], [1140, 1240]],
    block: { floor: [] },
    pal: { leafs: [0x2bc48a, 0x1fae7a, 0x4fd9a0, 0x36c3a8], trunks: [0xff6fa5, 0xffa04d, 0xb77bff, 0xff7f6a, 0xf5d04c], shade: 0x0c5a63, hi: 0xc8fff0,
      bush: (g, px, y) => g.fillStyle(0x9b7fd6).fillEllipse(px, y + 2, 50, 28).fillStyle(0xb99cf0).fillEllipse(px - 8, y - 1, 30, 16)
        .fillStyle(0xffffff, .4).fillEllipse(px - 12, y - 6, 12, 5),
      grass: (g, px, y) => g.fillStyle(0x2bc48a).fillTriangle(px - 12, y, px - 7, y - 16, px - 2, y)
        .fillTriangle(px - 6, y, px, y - 26, px + 6, y).fillTriangle(px + 2, y, px + 8, y - 15, px + 13, y) }
  }
};

// ---- Power-ups (power id = index + 1; 0 = none) ----
const POWERS = [
  { name: 'SPEED BOOST',  color: 0xffb300 },
  { name: 'FREEZE',       color: 0x4fc3f7 },
  { name: 'DASH',         color: 0xe040fb },
  { name: 'SHIELD',       color: 0x43d17a },
  { name: 'INVISIBILITY', color: 0x9575cd }];
const EFFECT_MS = 5000, FREEZE_MS = 2500, FREEZE_R = 360, DASH_MS = 200;   // speed / shield / invisibility all last EFFECT_MS
const FX = { SPEED: 1, SHIELD: 2, INVIS: 4, FROZEN: 8, DASH: 16, CAST: 32 };   // status bit-flags carried in snapshots
// Power-up spawn rates (setting "POWER-UPS"). cap = orbs on the map at once, first = delay before the first orb, gap = time between spawns.
const POWER_RATES = [
  { cap: () => 0, first: 0, gap: 0 },                                             // OFF
  { cap: () => 1, first: 15000, gap: 25000 },                                     // RARE
  { cap: n => clamp(Math.ceil(n / 4), 1, 3), first: 8000, gap: 14000 },           // NORMAL (default)
  { cap: n => clamp(Math.ceil(n / 2) + 1, 2, 5), first: 500, gap: 4500 }];        // OFTEN (about half the old rate)

// Shared game state (survives scene changes). power = index into POWER_RATES, map = key of MAPS.
const G = { peer: null, isHost: false, slot: 0, maxP: 4, cap: 4, round: 60, power: 2, map: 'meadow',
            conns: {}, inputs: {}, wins: Array(12).fill(0), snap: null, hostConn: null };

// The active map's data lives in these globals (set by setMap) so physics, art and networking all read the same thing.
let PLATS, PADS, RAMPS, CRATES, SPOTS;
function setMap(id) {
  const m = MAPS[id] || MAPS.meadow; G.map = MAPS[id] ? id : 'meadow';
  PLATS = m.plats; PADS = m.pads; RAMPS = m.ramps; CRATES = m.crates; SPOTS = [];
  // Orb spawn points (orb centre, hovering just above a platform top). Skips the top HUD row.
  PLATS.slice(0, -1).forEach(([x, y, w]) => {
    if (y < 90) return;
    if (m.ledge && x === m.ledge[0]) return SPOTS.push([m.ledge[1], y - 22]);
    for (let px = x + 24; px <= x + w - 24; px += 34) SPOTS.push([px, y - 22]); });
  m.floorSpots.forEach(([a, b]) => { for (let px = a; px <= b; px += 40) SPOTS.push([px, 668]); });   // clear of crates, pads and ramps
}
setMap('meadow');

/* ---------------- Networking helpers ---------------- */
const send = (conn, m) => { try { conn && conn.open && conn.send(m); } catch (e) {} };
const broadcast = m => Object.values(G.conns).forEach(c => send(c, m));
const activeScene = () => game.scene.getScenes(true)[0] || game.scene.getScenes(false).find(s => game.scene.isPaused(s.scene.key));   // a paused scene counts too

/** Messages a guest receives from the host. */
function onHostMsg(m) {
  if (m.t === 'welcome') G.slot = m.slot;
  else if (m.t === 'start') { setMap(m.map); G.maxP = m.maxP; G.round = m.round; G.wins = m.wins;
    document.getElementById('menu').classList.add('gone'); activeScene().scene.start('Play'); }
  else if (m.t === 's') G.snap = m;
  else if (m.t === 'over') { G.wins = m.wins; activeScene().scene.start('GameOver', { loser: m.loser }); }
}

/* ---------------- Shared drawing ---------------- */
/** Static art is drawn ONCE into canvas textures (a live Graphics object with ~1400 commands would be
 *  re-rendered every single frame, which is what made the game lag), then shown as plain images.
 *  Textures are keyed per map ('bgTex_<map>', 'levelTex_<map>'). */
// Colours of each map's sky (top to bottom). The page behind the canvas uses them, so the side/top bars of a non-16:9 window blend into the sky instead of showing a flat strip.
const SKIES = { meadow: ['#1b1f5c', '#4a3f95', '#a5679f'], snow: ['#a6aefd', '#b7bdff'], desert: ['#ffb487', '#ffd9a8', '#ffeccb'], underwater: ['#59d6e6', '#2aa0cf', '#1b6fb0'] };
function drawBg(s) {
  MAPS[G.map].bg(s);
  document.body.style.background = 'linear-gradient(rgba(14,16,48,.8),rgba(14,16,48,.8)), linear-gradient(' + (SKIES[G.map] || ['#3e9abb', '#3e9abb']).join(',') + ')';   // the bezel (bars around the 16:9 map): a dark tint of the map's sky
}

/** Night meadow: purple sky, moon glow, stars and hills. */
function bgMeadow(s) {
  if (!s.textures.exists('bgTex_meadow')) {
    const tex = s.textures.createCanvas('bgTex_meadow', W, H), c = tex.getContext();      // smooth canvas gradient (no banding lines)
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1b1f5c'); sky.addColorStop(.55, '#4a3f95'); sky.addColorStop(1, '#a5679f');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    const sun = c.createRadialGradient(1080, 170, 0, 1080, 170, 240);
    sun.addColorStop(0, 'rgba(255,240,220,.9)'); sun.addColorStop(.12, 'rgba(255,228,196,.5)'); sun.addColorStop(1, 'rgba(255,228,196,0)');
    c.fillStyle = sun; c.fillRect(840, 0, 480, 420);
    let sd2 = 7; const r2 = () => (sd2 = (sd2 * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 140; i++) {                                                // stars
      const x = r2() * W, y = r2() * H * .75, big = r2() < .15, rad = big ? 1.8 : .6 + r2() * .9;
      c.fillStyle = `rgba(255,255,255,${.35 + r2() * .55})`; c.beginPath(); c.arc(x, y, rad, 0, 6.283); c.fill();
      if (big) { c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1; c.beginPath();
        c.moveTo(x - 5, y); c.lineTo(x + 5, y); c.moveTo(x, y - 5); c.lineTo(x, y + 5); c.stroke(); }
    }
    c.fillStyle = '#5b4a8f'; c.beginPath(); c.ellipse(260, 700, 650, 210, 0, 0, 6.283); c.ellipse(1100, 720, 750, 230, 0, 0, 6.283); c.fill();   // far hills
    c.fillStyle = '#453a78'; c.beginPath(); c.ellipse(700, 730, 850, 200, 0, 0, 6.283); c.fill();                                              // near hills
    tex.refresh();
  }
  s.add.image(0, 0, 'bgTex_meadow').setOrigin(0).setDepth(-10);
  [[180,90,1],[520,55,.8],[860,120,1.2],[1180,70,.9],[700,30,.6]].forEach(([cx, cy, k], n) => {              // clouds
    const c = s.add.image(cx, cy, 'cloud').setScale(k).setAlpha(.16).setDepth(-9);
    s.tweens.add({ targets: c, x: cx + 70, duration: 9000 + n * 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); });
  for (let k = 0; k < 28; k++) {                                                                             // twinkling stars
    const m = s.add.image((k * 173) % W + 20, 20 + (k * 89) % 420, 'mote').setScale(.25 + (k % 3) * .15).setAlpha(.9).setDepth(-8);
    s.tweens.add({ targets: m, alpha: .15, duration: 900 + (k % 5) * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: k * 90 }); }
}

/** Winter: lavender sky, soft mountains, big low clouds, drifting clouds and falling snow. */
function bgSnow(s) {
  if (!s.textures.exists('bgTex_snow')) {
    const tex = s.textures.createCanvas('bgTex_snow', W, H), c = tex.getContext();
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#a6aefd'); sky.addColorStop(1, '#b7bdff');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    const hill = (px, top, hw, col) => {                                             // rounded mountain: peak at y=top
      const base = H + 60, ph = base - top; c.fillStyle = col; c.beginPath(); c.moveTo(px - hw, base);
      c.bezierCurveTo(px - hw * .5, base, px - hw * .32, base - ph, px, base - ph);
      c.bezierCurveTo(px + hw * .32, base - ph, px + hw * .5, base, px + hw, base); c.closePath(); c.fill(); };
    hill(170, 330, 440, '#959ff3'); hill(640, 400, 400, '#8f98e7'); hill(1100, 320, 470, '#959ff3');      // far range
    hill(-20, 470, 380, '#c8cdfe'); hill(430, 500, 360, '#bcc2fd'); hill(880, 450, 400, '#c8cdfe'); hill(1290, 480, 360, '#bcc2fd');   // lit range
    const puff = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.283); c.fill(); };
    const cloud = (cx, cy, k, col) => { puff(cx, cy, 120 * k, 30 * k, col); puff(cx - 60 * k, cy - 16 * k, 46 * k, 34 * k, col);
      puff(cx + 22 * k, cy - 30 * k, 58 * k, 42 * k, col); puff(cx + 76 * k, cy - 12 * k, 40 * k, 28 * k, col); };
    [[160, 700, 1.4, '#d7d6ff'], [600, 722, 1.2, '#e2e2ff'], [1030, 706, 1.5, '#d7d6ff'], [1290, 724, 1.1, '#e7e7ff']].forEach(a => cloud(...a));   // low clouds
    [[250, 330, .7], [930, 110, .6], [1170, 400, .8]].forEach(([x, y, k]) => cloud(x, y, k, 'rgba(231,231,255,.6)'));                                // high clouds
    tex.refresh();
  }
  s.add.image(0, 0, 'bgTex_snow').setOrigin(0).setDepth(-10);
  [[180, 110, 1], [700, 70, .8], [1100, 230, 1.1]].forEach(([cx, cy, k], n) => {                              // drifting clouds
    const c = s.add.image(cx, cy, 'cloud').setScale(k).setTint(0xf0f0ff).setAlpha(.5).setDepth(-9);
    s.tweens.add({ targets: c, x: cx + 90, duration: 11000 + n * 2300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); });
  for (let k = 0; k < 30; k++) {                                                                             // snowfall
    const f = s.add.image((k * 173) % W + 10, -20, 'mote').setScale(.22 + (k % 4) * .09).setAlpha(.85).setDepth(-8);
    s.tweens.add({ targets: f, y: H + 20, x: f.x + (k % 2 ? 50 : -50), duration: 7000 + (k % 7) * 1200, repeat: -1, delay: k * 260 }); }
}

/** Free height above (px, y) before hitting a platform or ramp underside (sizes the scenery). */
function room(px, y) {
  let h = y - 8;
  PLATS.forEach(([x, py, w]) => { if (py < y && px + 34 > x && px - 34 < x + w) h = Math.min(h, y - py - 16); });
  RAMPS.forEach(R => { if (px + 34 > R.x1 && px - 34 < R.x2) {
    const c = v => clamp(v, R.x1, R.x2);
    const ly = Math.max(rampY(R, c(px - 34)), rampY(R, c(px + 34))) + 14;
    if (ly < y) h = Math.min(h, y - ly); } });
  return h;
}
/** Free height below a platform underside (for hanging vines and icicles). */
function drop(px, y) { let d = 70; PLATS.forEach(([x, py, w]) => { if (py > y && px + 6 > x && px - 6 < x + w) d = Math.min(d, py - y - 16); }); return d; }

/** Tree designs; every map shares them and only the palette P changes. */
function makeTrees(g, P) {
  /** Rounded canopy block with a soft shaded underside and a small highlight. */
  const canopy = (x, y, w, h, r, lc, k) => {
    g.fillStyle(lc).fillRoundedRect(x, y, w, h, r);
    g.fillStyle(P.shade, .22).fillRoundedRect(x + 2 * k, y + h * .68, w - 4 * k, h * .32, { tl: 0, tr: 0, bl: r, br: r });
    g.fillStyle(P.hi, .45).fillRoundedRect(x + w * .16, y + 7 * k, Math.min(16 * k, w * .3), 8 * k, 4 * k);
  };
  const blob = (cx, cy, r, lc, k) => {                     // round leaf cluster
    g.fillStyle(lc).fillCircle(cx, cy, r);
    g.fillStyle(P.shade, .2).fillEllipse(cx, cy + r * .62, r * 1.5, r * .55);
    g.fillStyle(P.hi, .4).fillCircle(cx - r * .38, cy - r * .42, r * .2);
  };
  const S = {
    // classic: straight trunk, big top canopy, two side branches with leaf clumps
    classic: (px, y, k, lc, tc) => { const th = 100 * k, tw = 20 * k;
      g.lineStyle(5 * k, tc).lineBetween(px, y - th * .5, px - 36 * k, y - th * .74).lineBetween(px, y - th * .62, px + 38 * k, y - th * .86);
      g.fillStyle(tc).fillRect(px - tw / 2, y - th, tw, th);
      canopy(px - 68 * k, y - th * .74 - 20 * k, 38 * k, 26 * k, 10 * k, lc, k);
      canopy(px + 32 * k, y - th * .86 - 20 * k, 46 * k, 30 * k, 10 * k, lc, k);
      canopy(px - 42 * k, y - th - 64 * k, 84 * k, 76 * k, 14 * k, lc, k); },
    // pine: slim trunk with three stacked tiers that get narrower toward the top
    pine: (px, y, k, lc, tc) => { const th = 64 * k, tw = 16 * k;
      g.fillStyle(tc).fillRect(px - tw / 2, y - th, tw, th);
      [[108, 38, 48], [80, 36, 74], [54, 34, 100]].forEach(([w, h, b]) =>
        canopy(px - w / 2 * k, y - (b + h) * k, w * k, h * k, 12 * k, lc, k)); },
    // round: bubbly cloud-like crown made of overlapping circles
    round: (px, y, k, lc, tc) => { const th = 84 * k, tw = 18 * k;
      g.lineStyle(5 * k, tc).lineBetween(px, y - th * .6, px + 30 * k, y - th * .92);
      g.fillStyle(tc).fillRect(px - tw / 2, y - th, tw, th);
      blob(px - 36 * k, y - th - 6 * k, 28 * k, lc, k);
      blob(px + 36 * k, y - th - 10 * k, 30 * k, lc, k);
      blob(px, y - th - 32 * k, 42 * k, lc, k);
      blob(px + 6 * k, y - th - 58 * k, 24 * k, lc, k); },
    // fork: the trunk splits in two, each arm carrying its own canopy
    fork: (px, y, k, lc, tc) => { const tw = 22 * k;
      g.lineStyle(9 * k, tc).lineBetween(px, y - 52 * k, px - 32 * k, y - 92 * k).lineBetween(px, y - 52 * k, px + 34 * k, y - 84 * k);
      g.fillStyle(tc).fillRect(px - tw / 2, y - 56 * k, tw, 56 * k);
      canopy(px + 4 * k, y - 122 * k, 60 * k, 52 * k, 14 * k, lc, k);
      canopy(px - 62 * k, y - 134 * k, 60 * k, 54 * k, 14 * k, lc, k); },
    // lean: a trunk that tips to one side under a wide canopy
    lean: (px, y, k, lc, tc) => {
      g.lineStyle(20 * k, tc).lineBetween(px, y, px + 26 * k, y - 104 * k);
      g.lineStyle(8 * k, tc).lineBetween(px + 8 * k, y - 44 * k, px - 30 * k, y - 74 * k);
      canopy(px - 52 * k, y - 98 * k, 44 * k, 30 * k, 10 * k, lc, k);
      canopy(px - 20 * k, y - 148 * k, 92 * k, 66 * k, 16 * k, lc, k); },
    // tall: slender trunk with a tall narrow canopy and two little leaf tufts
    tall: (px, y, k, lc, tc) => { const th = 70 * k, tw = 14 * k;
      g.lineStyle(4 * k, tc).lineBetween(px, y - th * .5, px - 30 * k, y - th * .62).lineBetween(px, y - th * .72, px + 26 * k, y - th * .86);
      g.fillStyle(tc).fillRect(px - tw / 2, y - th, tw, th);
      canopy(px - 44 * k, y - th * .62 - 12 * k, 28 * k, 22 * k, 8 * k, lc, k);
      canopy(px + 18 * k, y - th * .86 - 12 * k, 30 * k, 22 * k, 8 * k, lc, k);
      canopy(px - 24 * k, y - th - 80 * k, 48 * k, 90 * k, 20 * k, lc, k); },
    // wide: short flared trunk under a broad canopy with dripping edges
    wide: (px, y, k, lc, tc) => { const th = 52 * k, tw = 30 * k;
      g.fillStyle(tc).fillRect(px - tw / 2, y - th, tw, th)
        .fillTriangle(px - tw / 2 - 10 * k, y, px - tw / 2, y - 16 * k, px - tw / 2, y)
        .fillTriangle(px + tw / 2 + 10 * k, y, px + tw / 2, y - 16 * k, px + tw / 2, y);
      canopy(px - 58 * k, y - th + 4 * k, 22 * k, 20 * k, 9 * k, lc, k);
      canopy(px + 36 * k, y - th + 4 * k, 20 * k, 14 * k, 7 * k, lc, k);
      canopy(px - 60 * k, y - th - 46 * k, 120 * k, 56 * k, 18 * k, lc, k); },
    // sapling: small tree for low spots
    sapling: (px, y, k, lc, tc) => { const th = 36 * k, tw = 10 * k;
      g.fillStyle(tc).fillRect(px - tw / 2, y - th, tw, th);
      canopy(px - 24 * k, y - th - 30 * k, 48 * k, 40 * k, 12 * k, lc, k); },
  };
  return S;
}
// [height, half-width] of each tree at scale 1, used to pick only designs that fit the free space
const TREES = { classic: [168, 78], pine: [136, 54], round: [168, 66], fork: [136, 64],
                lean: [150, 74], tall: [152, 46], wide: [100, 62], sapling: [68, 26] };

/** Platforms, ramps, scenery and props of the active map, baked into one texture. Scenery is deterministic
 *  (same on every client) and sized to the free headroom above each spot, so nothing pokes into platforms above. */
function bakeLevel(s) {
  const M = MAPS[G.map], P = M.pal, g = s.add.graphics();
  let sd = M.seed; const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
  const FLOOR = PLATS.length - 1, S = (M.makeScenery || makeTrees)(g, P), T = M.sizes || TREES;
  const blocked = (i, px) => (i === FLOOR ? [...PADS.map(p => [p - 50, p + 50]), ...M.block.floor] : M.block[i] || []).some(([a, b]) => px > a && px < b);

  // ---- Choose scenery that fits each spot ----
  const items = [];
  PLATS.forEach(([x, y, w], i) => {
    const fl = i === FLOOR;
    let extra = 0;
    for (let px = x + 30; px < x + w - 30; px += (fl ? 110 : 70) + rnd() * (fl ? 150 : 90) + extra) {
      extra = 0;
      if (blocked(i, px)) continue;
      const rm = room(px, y), ed = Math.min(px - x, x + w - px);
      const fits = [];                                             // tree designs that fit here, with their max scale
      Object.entries(T).forEach(([n, [h, hw]]) => { const kk = Math.min(1.1, (rm - 8) / h, ed / hw); if (kk >= .55) fits.push([n, kk]); });
      const lc = P.leafs[(rnd() * P.leafs.length) | 0], tc = P.trunks[(rnd() * P.trunks.length) | 0];
      if (fits.length && rnd() < .85) {
        const [kind, kk] = fits[(rnd() * fits.length) | 0], k = kk * (.75 + rnd() * .25);
        extra = T[kind][1] * k * .5;                           // keep bigger trees from crowding each other
        items.push([kind, px, y, k, lc, tc]);
      } else items.push([rnd() < .5 ? 'bush' : 'grass', px, y, 1, lc, tc]);
    }
  });
  items.forEach(([kind, px, y, k, lc, tc]) => S[kind] ? S[kind](px, y, k, lc, tc) : P[kind](g, px, y));   // scenery first, so platforms overlap their feet
  if (M.scenery) M.scenery(g);                                     // hand-placed props (snowmen, candy canes)

  M.drawPlats(g, rnd);
  RAMPS.forEach(R => M.drawRamp(g, R));
  M.drawExtras(g, rnd);
  g.generateTexture('levelTex_' + G.map, W, H); g.destroy();       // bake: rendered once, then reused as one image
}

function drawLevel(s) {
  const key = 'levelTex_' + G.map;
  if (!s.textures.exists(key)) bakeLevel(s);
  s.add.image(0, 0, key).setOrigin(0).setDepth(-5);
}

/** Jump pads on the floor (orange unless the map passes its own colours). */
function drawPads(g, base = 0xffa000, top = 0xffcc4d) {
  PADS.forEach(x => {
    g.fillStyle(base).fillRoundedRect(x - 34, 682, 68, 8, 3).fillStyle(top).fillRoundedRect(x - 30, 676, 60, 8, 4)
      .fillStyle(0xffffff, .9).fillTriangle(x - 9, 674, x + 9, 674, x, 664); });
}

/* ---- Meadow art: pink ground, wavy grass, hanging vines, crates ---- */
function platsMeadow(g, rnd) {
  const FLOOR = PLATS.length - 1;
  // ---- Platforms (with soft shadow, dark underside, pebbles, wavy grass, hanging vines) ----
  PLATS.forEach(([x, y, w], i) => {
    const fl = i === FLOOR, th = fl ? H - y : 16;
    if (!fl) g.fillStyle(0x1a4fa0, .12).fillRoundedRect(x + 6, y + 14, w - 12, 10, 5);
    if (fl) g.fillStyle(PINK).fillRect(x, y, w, th);
    else g.fillStyle(PINK).fillRoundedRect(x, y, w, th, { tl: 0, tr: 0, bl: 7, br: 7 })
           .fillStyle(0xe6306f).fillRoundedRect(x, y + th - 5, w, 5, { tl: 0, tr: 0, bl: 7, br: 7 });
    g.fillStyle(0xe6306f);
    for (let px = x + 14; px < x + w - 8; px += 26 + rnd() * 14) g.fillCircle(px, y + (fl ? 14 + rnd() * 10 : 10), 2.2);
    g.fillStyle(GREEN).fillRect(x, y, w, 3);
    g.fillStyle(0x2ea44f);
    for (let gx = x; gx < x + w; gx += 10) g.fillTriangle(gx, y + 5, Math.min(gx + 10, x + w), y + 5, gx + 5, y + 8);
    if (!fl && w > 120 && rnd() < .3) {                              // vines hanging below
      for (let n = 1 + ((rnd() * 3) | 0); n > 0; n--) {
        const vx = x + 20 + rnd() * (w - 40), len = Math.min(18 + rnd() * 30, drop(vx, y) - 12);
        if (len > 10) { g.fillStyle(0x2f9c78).fillRoundedRect(vx - 2.5, y + 12, 5, len, 2.5);
          g.fillStyle(rnd() < .4 ? PINK : 0x2f9c78).fillCircle(vx, y + 12 + len, 5); } }
    }
  });
}
function rampMeadow(g, R) {
  const ang = Math.atan2(R.y2 - R.y1, R.x2 - R.x1), len = Math.hypot(R.x2 - R.x1, R.y2 - R.y1);
  g.save(); g.translateCanvas(R.x1, R.y1); g.rotateCanvas(ang);
  g.fillStyle(PINK).fillRect(0, 0, len, 14).fillStyle(0xe6306f).fillRect(0, 10, len, 4).fillStyle(GREEN).fillRect(0, 0, len, 5);
  g.restore();
}
function extrasMeadow(g) {
  // ---- Crates: wooden boxes with planks, a framed X-brace, bevelled edges and nails ----
  CRATES.forEach(([cx, cy]) => {
    const C = CRATE, e = cx + C, b = cy + C;
    g.fillStyle(0xffb04a).fillRoundedRect(cx, cy, C, C, 3);                                   // body
    g.lineStyle(1.5, 0xe08a2e, .9).lineBetween(cx + 4, cy + 13, e - 4, cy + 13).lineBetween(cx + 4, cy + 25, e - 4, cy + 25);   // plank seams
    g.lineStyle(1, 0xf2a03c, .8).lineBetween(cx + 6, cy + 9, cx + 15, cy + 9).lineBetween(cx + 20, cy + 30, cx + 31, cy + 30);  // wood grain
    g.lineStyle(4, 0xc46a1a).strokeRect(cx + 3, cy + 3, C - 6, C - 6);                        // inner frame
    g.lineBetween(cx + 4, cy + 4, e - 4, b - 4).lineBetween(e - 4, cy + 4, cx + 4, b - 4);    // X brace
    g.lineStyle(1.5, 0xffd08a, .85).lineBetween(cx + 4, cy + 2.5, e - 4, b - 5.5).lineBetween(e - 4, cy + 2.5, cx + 4, b - 5.5)   // brace highlight
      .lineBetween(cx + 4, cy + 1.5, e - 4, cy + 1.5);                                        // top edge light
    g.fillStyle(0x000000, .13).fillRect(cx + 2, b - 3, C - 4, 2);                              // bottom shade
    g.lineStyle(2, 0x8a4a12).strokeRoundedRect(cx + 1, cy + 1, C - 2, C - 2, 3);              // outline
    g.fillStyle(0x6b3608);                                                                    // nails in the corners
    [[7, 7], [C - 7, 7], [7, C - 7], [C - 7, C - 7]].forEach(([dx, dy]) => g.fillCircle(cx + dx, cy + dy, 2));
    g.fillStyle(0xffe0b0, .8);
    [[7, 7], [C - 7, 7], [7, C - 7], [C - 7, C - 7]].forEach(([dx, dy]) => g.fillCircle(cx + dx - .6, cy + dy - .6, .8));
  });
  drawPads(g);
  g.fillStyle(0xe6306f);                                            // floor foliage silhouettes
  [90, 260, 520, 800, 1120].forEach(x => g.fillTriangle(x, H, x + 18, H - 34, x + 36, H).fillTriangle(x + 22, H, x + 44, H - 26, x + 66, H));
}

/* ---- Winter art: thin icy platforms, icicles, string lights, snowmen and candy canes ---- */
const ICE = { top: 0xe9f0ff, frost: 0xb8d0ff, body: 0xa3a9ff, under: 0x878de8, wire: 0x7c82c8 };

function platsSnow(g, rnd) {
  const FLOOR = PLATS.length - 1, rb = { tl: 0, tr: 0, bl: 7, br: 7 };
  PLATS.forEach(([x, y, w], i) => {
    const fl = i === FLOOR, th = fl ? H - y : 16;
    if (!fl) g.fillStyle(0x6f78d8, .1).fillRoundedRect(x + 6, y + 16, w - 12, 9, 4);                 // soft shadow
    g.fillStyle(ICE.body).fillRoundedRect(x, y, w, th, fl ? 0 : rb);
    g.fillStyle(ICE.under).fillRoundedRect(x, y + th - (fl ? 10 : 5), w, fl ? 10 : 5, fl ? 0 : rb);   // darker underside
    g.fillStyle(ICE.frost).fillRect(x, y, w, 5).fillStyle(ICE.top).fillRect(x, y, w, 2);              // frosted top edge
    g.fillStyle(0xc9daff);                                                                             // ice ticks
    for (let px = x + 12; px < x + w - 14; px += 20 + rnd() * 16) g.fillRoundedRect(px, y + 8, 9, 2.5, 1.2);
    if (!fl) for (let px = x + 10; px < x + w - 10; px += 22 + rnd() * 40) {                          // icicles
      const len = Math.min(6 + rnd() * 12, drop(px, y) - 30);
      if (len > 5) g.fillStyle(ICE.frost).fillTriangle(px - 3, y + th - 2, px + 3, y + th - 2, px, y + th + len); }
  });
}
function rampSnow(g, R) {
  const ang = Math.atan2(R.y2 - R.y1, R.x2 - R.x1), len = Math.hypot(R.x2 - R.x1, R.y2 - R.y1);
  g.save(); g.translateCanvas(R.x1, R.y1); g.rotateCanvas(ang);
  g.fillStyle(ICE.body).fillRect(0, 0, len, 16).fillStyle(ICE.under).fillRect(0, 11, len, 5)
    .fillStyle(ICE.frost).fillRect(0, 0, len, 5).fillStyle(ICE.top).fillRect(0, 0, len, 2);
  g.restore();
}

/** Sagging wire from A to B with hanging bulbs. */
function garland(g, ax, ay, bx, by, sag) {
  const cx = (ax + bx) / 2, cy = (ay + by) / 2 + sag * 2, len = Math.hypot(bx - ax, by - ay);
  const pt = t => [(1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx, (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by];
  g.lineStyle(2, ICE.wire);
  for (let i = 0; i < 28; i++) { const [x0, y0] = pt(i / 28), [x1, y1] = pt((i + 1) / 28); g.lineBetween(x0, y0, x1, y1); }
  const n = Math.max(3, Math.round(len / 26)), BULB = [0xe03741, 0x21a366, 0xffd23f, 0xff9f43];
  for (let i = 1; i < n; i++) { const [x, y] = pt(i / n);
    g.fillStyle(ICE.wire).fillRect(x - 1.5, y, 3, 3);
    g.fillStyle(BULB[i % 4]).fillEllipse(x, y + 8, 7, 10);
    g.fillStyle(0xffffff, .7).fillCircle(x - 1, y + 6, 1.1); }
}
/** Candy cane standing at (x, y); the hook curls toward dir (+1 right, -1 left). */
function candyCane(g, x, y, h, dir) {
  const r = 13, pts = [];
  for (let yy = 0; yy <= h - r; yy += 2) pts.push([x, y - yy]);
  for (let a = 0; a <= 3.4; a += .04) pts.push([x + dir * r * (1 - Math.cos(a)), y - (h - r) - r * Math.sin(a)]);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  g.lineStyle(9, 0xf7f4f6); for (let i = 1; i < pts.length; i++) g.lineBetween(...pts[i - 1], ...pts[i]);
  g.lineStyle(9, 0xe03741); for (let i = 1; i < pts.length; i++) if (Math.floor(cum[i] / 9) % 2) g.lineBetween(...pts[i - 1], ...pts[i]);
}
/** Snowman with a top hat and scarf, feet at (x, y). */
function snowman(g, x, y, k) {
  const ball = (cy, r) => g.fillStyle(0xdedee3).fillCircle(x, y - cy * k, r * k).fillStyle(0xf7f4f6).fillCircle(x - 1.5 * k, y - (cy + 1.5) * k, (r - 1.5) * k);
  g.lineStyle(3 * k, 0x6a5a55).lineBetween(x - 10 * k, y - 38 * k, x - 27 * k, y - 50 * k).lineBetween(x + 10 * k, y - 38 * k, x + 27 * k, y - 46 * k);
  ball(15, 17); ball(38, 13); ball(58, 10);
  g.fillStyle(0xe03741).fillRect(x - 12 * k, y - 50 * k, 24 * k, 6 * k).fillRect(x + 4 * k, y - 46 * k, 7 * k, 16 * k);                                   // scarf
  g.fillStyle(0x606a72).fillRect(x - 12 * k, y - 66 * k, 24 * k, 4 * k).fillRect(x - 7.5 * k, y - 80 * k, 15 * k, 15 * k)
    .fillStyle(0xe03741).fillRect(x - 7.5 * k, y - 70 * k, 15 * k, 4 * k);                                                                                  // hat
  g.fillStyle(0x3a3f5c).fillCircle(x - 3.5 * k, y - 61 * k, 1.5 * k).fillCircle(x + 3.5 * k, y - 61 * k, 1.5 * k)
    .fillCircle(x, y - 36 * k, 1.6 * k).fillCircle(x, y - 30 * k, 1.6 * k).fillCircle(x, y - 12 * k, 1.8 * k).fillCircle(x, y - 20 * k, 1.8 * k);            // eyes + buttons
  g.fillStyle(0xff8a3d).fillTriangle(x, y - 59 * k, x + 10 * k, y - 57 * k, x, y - 55 * k);                                                                // carrot nose
}
function sceneSnow(g) {
  candyCane(g, 1180, 165, 92, -1); snowman(g, 755, 165, 1);      // top row
  snowman(g, 432, 690, 1.15); candyCane(g, 655, 585, 66, 1);      // floor + low row
}
function extrasSnow(g) {
  drawPads(g);
  [[150, 181, 410, 181, 22], [578, 181, 792, 181, 20], [960, 181, 1220, 181, 22],   // eave lights under the top row
   [580, 286, 820, 286, 20], [440, 496, 680, 496, 18],
   [740, 375, 838, 286, 8], [1110, 375, 1230, 286, 10]                             // diagonals between levels
  ].forEach(a => garland(g, ...a));
}

/* ---- Desert art: terracotta ledges on sand, cacti and palms, pennant strings, pyramids and a low sun ---- */
const SAND = { hi: 0xfff0c4, top: 0xf9d58f, body: 0xe08a4a, strata: 0xc96a33, under: 0xa84a24, rope: 0x8a4a2a };

function bgDesert(s) {
  if (!s.textures.exists('bgTex_desert')) {
    const tex = s.textures.createCanvas('bgTex_desert', W, H), c = tex.getContext();
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#ffb487'); sky.addColorStop(.55, '#ffd9a8'); sky.addColorStop(1, '#ffeccb');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    const sun = c.createRadialGradient(1060, 150, 0, 1060, 150, 250);                       // halo, then the disc
    sun.addColorStop(0, 'rgba(255,248,222,.95)'); sun.addColorStop(.25, 'rgba(255,240,205,.55)'); sun.addColorStop(1, 'rgba(255,240,205,0)');
    c.fillStyle = sun; c.fillRect(810, 0, 470, 400);
    c.fillStyle = '#fff6da'; c.beginPath(); c.arc(1060, 150, 58, 0, 6.283); c.fill();
    const pyr = (cx, base, w, h, lit, dark) => {                                            // pyramid: lit left face, darker right face
      c.fillStyle = lit; c.beginPath(); c.moveTo(cx - w / 2, base); c.lineTo(cx, base - h); c.lineTo(cx + w / 2, base); c.closePath(); c.fill();
      c.fillStyle = dark; c.beginPath(); c.moveTo(cx, base - h); c.lineTo(cx + w / 2, base); c.lineTo(cx + w * .08, base); c.closePath(); c.fill(); };
    pyr(300, 640, 330, 210, '#f5bf86', '#e8a266'); pyr(560, 650, 200, 125, '#f7c68f', '#eaa86d'); pyr(930, 640, 260, 165, '#f5bf86', '#e8a266');
    const dune = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.283); c.fill(); };
    dune(200, 735, 600, 160, '#f9c88f'); dune(1010, 745, 680, 175, '#f3b678'); dune(640, 770, 950, 150, '#efae70');
    tex.refresh();
  }
  s.add.image(0, 0, 'bgTex_desert').setOrigin(0).setDepth(-10);
  [[220, 100, 1], [700, 60, .8], [1000, 300, 1.1]].forEach(([cx, cy, k], n) => {            // thin drifting clouds
    const c = s.add.image(cx, cy, 'cloud').setScale(k).setTint(0xfff6e6).setAlpha(.55).setDepth(-9);
    s.tweens.add({ targets: c, x: cx + 90, duration: 12000 + n * 2300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); });
  for (let k = 0; k < 16; k++) {                                                             // dust blowing across
    const d = s.add.image(-20, 120 + (k * 53) % 520, 'mote').setScale(.2 + (k % 3) * .08).setAlpha(.6).setDepth(-8);
    s.tweens.add({ targets: d, x: W + 20, duration: 15000 + (k % 5) * 2500, repeat: -1, delay: k * 900 }); }
}

/** Cactus + palm set for the desert (same call shape as the default trees). */
function makeCacti(g, P) {
  const body = (x, y, w, h, lc) => g.fillStyle(lc).fillRoundedRect(x, y, w, h, Math.min(w, h) / 2);
  const ribs = (x, y, w, h, k) => {                                      // darker right side + light rib on an upright piece
    g.fillStyle(P.shade, .26).fillRoundedRect(x + w * .6, y + 3 * k, w * .32, h - 6 * k, w * .16);
    g.fillStyle(P.hi, .45).fillRoundedRect(x + w * .18, y + 5 * k, Math.max(2, w * .13), Math.max(4, h * .4), w * .07); };
  return {
    saguaro: (px, y, k, lc) => { const tw = 24 * k, th = 120 * k, a = 13 * k;
      body(px - tw / 2, y - th, tw, th, lc);
      body(px - 40 * k, y - 54 * k, 40 * k, a, lc); body(px - 40 * k, y - 86 * k, a, 45 * k, lc);        // left arm
      body(px, y - 74 * k, 38 * k, a, lc); body(px + 25 * k, y - 102 * k, a, 41 * k, lc);                // right arm
      ribs(px - tw / 2, y - th, tw, th, k); ribs(px - 40 * k, y - 86 * k, a, 45 * k, k); ribs(px + 25 * k, y - 102 * k, a, 41 * k, k); },
    barrel: (px, y, k, lc) => { const w = 50 * k, h = 38 * k;
      body(px - w / 2, y - h, w, h, lc);
      g.lineStyle(2 * k, P.shade, .3); [-1, 0, 1].forEach(i => g.lineBetween(px + i * 13 * k, y - h + 6 * k, px + i * 11 * k, y - 3 * k));
      g.fillStyle(P.hi, .45).fillRoundedRect(px - w * .36, y - h + 5 * k, 7 * k, 12 * k, 3 * k);
      g.fillStyle(0xff4081).fillCircle(px, y - h, 6 * k).fillStyle(0xffd23f).fillCircle(px, y - h, 2.4 * k); },
    paddle: (px, y, k, lc) => {
      const pad = (cx, cy, w, h) => { g.fillStyle(lc).fillEllipse(cx, cy, w, h); g.fillStyle(P.shade, .22).fillEllipse(cx + w * .12, cy + h * .1, w * .6, h * .7);
        g.fillStyle(P.hi, .4).fillEllipse(cx - w * .2, cy - h * .22, w * .22, h * .12); };
      pad(px, y - 22 * k, 44 * k, 44 * k); pad(px - 24 * k, y - 56 * k, 32 * k, 40 * k); pad(px + 22 * k, y - 62 * k, 34 * k, 42 * k);
      g.fillStyle(0xff4081).fillCircle(px - 24 * k, y - 78 * k, 4 * k).fillCircle(px + 22 * k, y - 85 * k, 4 * k); },
    twin: (px, y, k, lc) => { body(px - 20 * k, y - 100 * k, 17 * k, 100 * k, lc); body(px + 3 * k, y - 66 * k, 17 * k, 66 * k, lc);
      ribs(px - 20 * k, y - 100 * k, 17 * k, 100 * k, k); ribs(px + 3 * k, y - 66 * k, 17 * k, 66 * k, k); },
    sapling: (px, y, k, lc) => { body(px - 8 * k, y - 44 * k, 16 * k, 44 * k, lc); body(px - 18 * k, y - 28 * k, 12 * k, 8 * k, lc); body(px - 18 * k, y - 38 * k, 8 * k, 18 * k, lc);
      ribs(px - 8 * k, y - 44 * k, 16 * k, 44 * k, k); },
    palm: (px, y, k, lc, tc) => { const th = 150 * k, bend = 16 * k, tx = px + bend * .4, ty = y - th, jx = px + bend, jy = y - th * .55;
      g.lineStyle(11 * k, tc).lineBetween(px, y, jx, jy).lineBetween(jx, jy, tx, ty); g.fillStyle(tc).fillCircle(jx, jy, 5.5 * k);   // slightly bent trunk
      g.lineStyle(2 * k, 0x000000, .16); for (let i = 1; i < 7; i++) { const t = i / 7; g.lineBetween(px + bend * t * .9 - 5 * k, y - th * t, px + bend * t * .9 + 5 * k, y - th * t); }
      [[-74, 24, 1], [-54, -4, 0], [-28, -34, 1], [28, -34, 0], [54, -4, 1], [74, 24, 0]].forEach(([dx, dy, dark]) => {     // arched leaves that droop at the tip
        const cx = tx, cy = ty + 3 * k, ex = tx + dx * k, ey = ty + dy * k, L = Math.hypot(ex - cx, ey - cy);
        const mx = (cx + ex) / 2, my = (cy + ey) / 2 - 12 * k, nx = -(ey - cy) / L * 11 * k, ny = (ex - cx) / L * 11 * k;
        g.fillStyle(dark ? 0x1e8f56 : lc);
        g.fillTriangle(cx, cy, mx + nx, my + ny, ex, ey).fillTriangle(cx, cy, mx - nx, my - ny, ex, ey); });
      g.fillStyle(lc).fillCircle(tx, ty + 2 * k, 7 * k);
      g.fillStyle(0x5a3a22).fillCircle(tx - 4 * k, ty + 9 * k, 4.5 * k).fillCircle(tx + 5 * k, ty + 10 * k, 4.5 * k); }
  };
}

function platsDesert(g, rnd) {
  const FLOOR = PLATS.length - 1, rb = { tl: 0, tr: 0, bl: 7, br: 7 };
  PLATS.forEach(([x, y, w], i) => {
    const fl = i === FLOOR, th = fl ? H - y : 16;
    if (!fl) g.fillStyle(0x9a4a22, .12).fillRoundedRect(x + 6, y + 16, w - 12, 9, 4);                  // soft shadow
    g.fillStyle(SAND.body).fillRoundedRect(x, y, w, th, fl ? 0 : rb);
    g.fillStyle(SAND.under).fillRoundedRect(x, y + th - (fl ? 10 : 5), w, fl ? 10 : 5, fl ? 0 : rb);   // darker underside
    g.fillStyle(SAND.top).fillRect(x, y, w, 5).fillStyle(SAND.hi).fillRect(x, y, w, 2);                // sunlit sand on top
    g.fillStyle(SAND.strata);                                                                           // sandstone layers
    (fl ? [10, 18] : [8]).forEach(dy => { for (let px = x + 10; px < x + w - 14; px += 22 + rnd() * 30) g.fillRoundedRect(px, y + dy, 10 + rnd() * 10, 2.5, 1.2); });
    if (!fl) for (let px = x + 10; px < x + w - 10; px += 24 + rnd() * 40) {                           // hanging rock chips
      const len = Math.min(5 + rnd() * 9, drop(px, y) - 30);
      if (len > 4) g.fillStyle(SAND.under).fillTriangle(px - 3, y + th - 2, px + 3, y + th - 2, px, y + th + len); }
  });
}
function rampDesert(g, R) {
  const ang = Math.atan2(R.y2 - R.y1, R.x2 - R.x1), len = Math.hypot(R.x2 - R.x1, R.y2 - R.y1);
  g.save(); g.translateCanvas(R.x1, R.y1); g.rotateCanvas(ang);
  g.fillStyle(SAND.body).fillRect(0, 0, len, 16).fillStyle(SAND.under).fillRect(0, 11, len, 5)
    .fillStyle(SAND.top).fillRect(0, 0, len, 5).fillStyle(SAND.hi).fillRect(0, 0, len, 2);
  g.restore();
}

/** Sagging rope from A to B with hanging pennants. */
function bunting(g, ax, ay, bx, by, sag) {
  const cx = (ax + bx) / 2, cy = (ay + by) / 2 + sag * 2, len = Math.hypot(bx - ax, by - ay);
  const pt = t => [(1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx, (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by];
  g.lineStyle(2, SAND.rope);
  for (let i = 0; i < 28; i++) { const [x0, y0] = pt(i / 28), [x1, y1] = pt((i + 1) / 28); g.lineBetween(x0, y0, x1, y1); }
  const n = Math.max(3, Math.round(len / 28)), FLAG = [0x00a8a0, 0xff4081, 0xffd23f, 0xff7a3d];
  for (let i = 1; i < n; i++) { const [x, y] = pt(i / n); g.fillStyle(FLAG[i % 4]).fillTriangle(x - 7, y, x + 7, y, x, y + 17); }
}
function sceneDesert(g) {                                                    // two palms (top row, right floor) + a wooden signpost
  const palm = makeCacti(g, MAPS.desert.pal).palm;
  palm(765, 165, .7, 0x2fbf71, 0x8d5a3b); palm(1238, 690, .85, 0x27a863, 0x7a4c30);
  const x = 640, y = 690;
  g.fillStyle(0x8d5a3b).fillRect(x - 3, y - 54, 6, 54);
  g.fillStyle(0xf9d58f).fillRect(x - 32, y - 56, 52, 20).fillTriangle(x + 20, y - 56, x + 20, y - 36, x + 36, y - 46);
  g.fillStyle(0xc96a33).fillRect(x - 24, y - 50, 34, 3).fillRect(x - 24, y - 43, 24, 3);
}
function extrasDesert(g) {
  drawPads(g, 0x0f8f86, 0x2fd0bf);                                           // teal pads stand out on sand
  [[50, 181, 240, 181, 16], [480, 181, 800, 181, 22], [1040, 181, 1230, 181, 18],
   [570, 391, 710, 391, 14], [940, 391, 1160, 391, 20],
   [210, 601, 430, 601, 16], [910, 601, 1090, 601, 14], [530, 496, 770, 496, 16]
  ].forEach(a => bunting(g, ...a));
}

/* ---- Underwater art: coral-rock ledges, kelp and corals, light shafts, bubbles, fish, ---- */
const CORAL = { hi: 0xffe3d6, top: 0xffb7a1, body: 0xf4766a, pit: 0xd9574f, under: 0xc2454f };
const FISH = [0xffb74d, 0xff6f91, 0xfff176, 0xb388ff, 0x80deea, 0xffffff];

/** Shared textures: 'fish' (white, tinted per use) and 'sea_bubble'. Called from MenuScene with the other textures. */
function makeSeaTextures(s) {
  const f = s.add.graphics();
  f.fillStyle(0xffffff).fillEllipse(32, 16, 40, 24).fillTriangle(14, 16, 0, 4, 0, 28).fillTriangle(24, 5, 36, 5, 30, 0)
    .fillStyle(0xd5e2ec).fillEllipse(32, 22, 32, 9).fillStyle(0x1c2b38).fillCircle(44, 13, 3);
  f.generateTexture('fish', 56, 32); f.destroy();
  const b = s.add.graphics();
  b.fillStyle(0xffffff, .18).fillCircle(12, 12, 9).lineStyle(2, 0xffffff, .9).strokeCircle(12, 12, 9).fillStyle(0xffffff, .9).fillCircle(8, 8, 2);
  b.generateTexture('sea_bubble', 24, 24); b.destroy();
}

function bgUnderwater(s) {
  if (!s.textures.exists('bgTex_underwater')) {
    const tex = s.textures.createCanvas('bgTex_underwater', W, H), c = tex.getContext();
    const sea = c.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#59d6e6'); sea.addColorStop(.55, '#2aa0cf'); sea.addColorStop(1, '#1b6fb0');
    c.fillStyle = sea; c.fillRect(0, 0, W, H);
    const ray = (x, w, a) => {                                                              // slanted shaft of sunlight that fades with depth
      const g = c.createLinearGradient(0, 0, 0, H * .85); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + w, 0); c.lineTo(x + w * 1.5 - 250, H); c.lineTo(x - w * .3 - 250, H); c.closePath(); c.fill(); };
    ray(150, 90, .22); ray(420, 60, .16); ray(700, 110, .2); ray(980, 70, .15); ray(1210, 90, .2);
    const dune = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.283); c.fill(); };
    dune(220, 730, 520, 150, '#2685b8'); dune(1030, 740, 600, 160, '#2279ad');             // far seabed
    c.strokeStyle = 'rgba(16,110,150,.5)'; c.lineWidth = 9; c.lineCap = 'round';           // distant kelp
    [90, 330, 560, 810, 1060, 1230].forEach((x, n) => { c.beginPath(); c.moveTo(x, 700);
      for (let t = 1; t <= 12; t++) c.lineTo(x + Math.sin(t * .7 + n) * 14, 700 - t * (22 + n % 3 * 5)); c.stroke(); });
    dune(640, 775, 900, 140, '#1d6ca3');                                                    // near seabed
    tex.refresh();
  }
  s.add.image(0, 0, 'bgTex_underwater').setOrigin(0).setDepth(-10);
  for (let k = 0; k < 7; k++) {                                                             // fish cruising across, both ways
    const dir = k % 2 ? -1 : 1, y0 = 90 + (k * 83) % 520;
    const f = s.add.image(dir > 0 ? -70 : W + 70, y0, 'fish').setScale(.7 + (k % 3) * .25).setFlipX(dir < 0).setTint(FISH[k % FISH.length]).setAlpha(.9).setDepth(-8);
    s.tweens.add({ targets: f, x: dir > 0 ? W + 70 : -70, duration: 14000 + (k % 4) * 3500, repeat: -1, delay: k * 1700 });
    s.tweens.add({ targets: f, y: y0 + 24, duration: 1700 + k * 230, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); }
  for (let k = 0; k < 26; k++) {                                                            // bubbles rising and wobbling
    const bx = (k * 211) % W + 14, b = s.add.image(bx, H + 20, 'sea_bubble').setScale(.35 + (k % 4) * .18).setAlpha(.55).setDepth(-8);
    s.tweens.add({ targets: b, y: -30, duration: 7000 + (k % 6) * 1300, repeat: -1, delay: k * 400 });
    s.tweens.add({ targets: b, x: bx + (k % 2 ? 22 : -22), duration: 1400 + (k % 5) * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); }
}

/** Reef plants and corals (same call shape as the default trees). Kelp and weed use the green leaf colour; corals use the trunk colour. */
function makeReef(g, P) {
  const stem = (px, y, h, w, amp, col, ph) => { g.fillStyle(col); for (let t = 0; t <= 1; t += .03) g.fillCircle(px + Math.sin(t * 5 + ph) * amp * t, y - h * t, w * (1 - t * .35) / 2); };
  return {
    kelp: (px, y, k, lc) => { const h = 146 * k;
      stem(px, y, h, 9 * k, 9 * k, lc, px);
      [[.3, 1], [.5, -1], [.7, 1], [.88, -1]].forEach(([t, d]) => { const sx = px + Math.sin(t * 5 + px) * 9 * k * t, sy = y - h * t;
        g.fillStyle(lc).fillTriangle(sx, sy + 5 * k, sx + d * 28 * k, sy - 8 * k, sx, sy - 16 * k);
        g.fillStyle(P.hi, .35).fillTriangle(sx, sy - 2 * k, sx + d * 18 * k, sy - 8 * k, sx, sy - 10 * k); }); },
    staghorn: (px, y, k, lc, tc) => {                                                      // branching coral
      const limb = (x, yy, a, len, w, d) => { const ex = x + Math.cos(a) * len, ey = yy - Math.sin(a) * len;
        g.lineStyle(w, tc).lineBetween(x, yy, ex, ey); g.fillStyle(tc).fillCircle(ex, ey, w / 2);
        if (d) { limb(ex, ey, a + .55, len * .74, w * .8, d - 1); limb(ex, ey, a - .55, len * .74, w * .8, d - 1); } };
      limb(px, y, Math.PI / 2, 38 * k, 11 * k, 2); limb(px - 12 * k, y, 2.2, 28 * k, 8 * k, 1); limb(px + 12 * k, y, .94, 28 * k, 8 * k, 1); },
    fan: (px, y, k, lc, tc) => {                                                           // sea fan with ribs
      g.fillStyle(tc).fillRect(px - 3 * k, y - 28 * k, 6 * k, 28 * k).fillEllipse(px, y - 64 * k, 84 * k, 72 * k);
      g.lineStyle(2 * k, P.shade, .3); [-3, -2, -1, 0, 1, 2, 3].forEach(i => g.lineBetween(px, y - 30 * k, px + i * 13 * k, y - 94 * k + Math.abs(i) * 6 * k));
      g.fillStyle(P.hi, .4).fillEllipse(px - 16 * k, y - 78 * k, 22 * k, 10 * k); },
    tube: (px, y, k, lc, tc) => [[-15, 52], [0, 74], [15, 40]].forEach(([dx, h]) => {      // tube coral cluster
      g.fillStyle(tc).fillRoundedRect(px + (dx - 7) * k, y - h * k, 14 * k, h * k, 6 * k);
      g.fillStyle(P.hi, .4).fillRoundedRect(px + (dx - 4) * k, y - (h - 8) * k, 3 * k, h * .5 * k, 1.5 * k);
      g.fillStyle(P.shade, .5).fillEllipse(px + dx * k, y - (h - 3) * k, 12 * k, 6 * k); }),
    brain: (px, y, k, lc, tc) => {                                                         // low brain-coral dome
      g.fillStyle(tc).fillEllipse(px, y - 8 * k, 68 * k, 32 * k).fillStyle(P.shade, .22).fillEllipse(px + 6 * k, y - 2 * k, 52 * k, 16 * k);
      g.lineStyle(2 * k, P.shade, .3); [-18, -6, 6, 18].forEach(d => g.lineBetween(px + d * k, y - 20 * k, px + (d + 4) * k, y - 4 * k)); },
    weed: (px, y, k, lc) => [[-9, 46, -6], [-3, 64, 2], [4, 54, 9], [10, 38, 14]].forEach(([dx, h, lean]) =>   // seagrass tuft
      g.fillStyle(lc).fillTriangle(px + (dx - 5) * k, y, px + (dx + 5) * k, y, px + (dx + lean) * k, y - h * k))
  };
}

function platsUnderwater(g, rnd) {
  const FLOOR = PLATS.length - 1, rb = { tl: 0, tr: 0, bl: 7, br: 7 };
  PLATS.forEach(([x, y, w], i) => {
    const fl = i === FLOOR, th = fl ? H - y : 16;
    if (!fl) g.fillStyle(0x0d4a85, .13).fillRoundedRect(x + 6, y + 16, w - 12, 9, 4);                 // soft shadow
    g.fillStyle(CORAL.body).fillRoundedRect(x, y, w, th, fl ? 0 : rb);
    g.fillStyle(CORAL.under).fillRoundedRect(x, y + th - (fl ? 10 : 5), w, fl ? 10 : 5, fl ? 0 : rb);   // darker underside
    g.fillStyle(CORAL.top).fillRect(x, y, w, 5).fillStyle(CORAL.hi).fillRect(x, y, w, 2);              // pale top edge
    g.fillStyle(CORAL.pit);                                                                             // coral pits
    for (let px = x + 12; px < x + w - 14; px += 18 + rnd() * 24) g.fillCircle(px, y + (fl ? 12 + rnd() * 12 : 9), 1.8 + rnd() * 1.4);
    if (!fl) for (let px = x + 10; px < x + w - 10; px += 24 + rnd() * 40) {                          // hanging coral chips
      const len = Math.min(5 + rnd() * 9, drop(px, y) - 30);
      if (len > 4) g.fillStyle(CORAL.under).fillTriangle(px - 3, y + th - 2, px + 3, y + th - 2, px, y + th + len); }
  });
}
function rampUnderwater(g, R) {
  const ang = Math.atan2(R.y2 - R.y1, R.x2 - R.x1), len = Math.hypot(R.x2 - R.x1, R.y2 - R.y1);
  g.save(); g.translateCanvas(R.x1, R.y1); g.rotateCanvas(ang);
  g.fillStyle(CORAL.body).fillRect(0, 0, len, 16).fillStyle(CORAL.under).fillRect(0, 11, len, 5)
    .fillStyle(CORAL.top).fillRect(0, 0, len, 5).fillStyle(CORAL.hi).fillRect(0, 0, len, 2);
  g.restore();
}

function starfish(g, x, y, r, col) {
  for (let i = 0; i < 5; i++) { const a = i * 1.2566 - 1.5708, b = .52;
    g.fillStyle(col).fillTriangle(x + Math.cos(a - b) * r * .4, y + Math.sin(a - b) * r * .4, x + Math.cos(a + b) * r * .4, y + Math.sin(a + b) * r * .4,
      x + Math.cos(a) * r, y + Math.sin(a) * r); }
  g.fillStyle(col).fillCircle(x, y, r * .42);
}
function sceneUnderwater(g) { }                                        // nothing extra: no ship, no chest
function extrasUnderwater(g) {
  drawPads(g, 0x6a35c0, 0xa77bff);                                           // purple pads stand out on coral
  [[210, 704, 10, 0xffd23f], [940, 706, 9, 0xff7ab8], [40, 706, 8, 0xb77bff]].forEach(a => starfish(g, ...a));
}

/** Power-up art, drawn once: badges 'pw0'..'pw4', shield 'bubble', ice block 'ice', shockwave 'ring'. */
function makePowerTextures(s) {
  const mk = (key, w, h, draw) => { const t = s.textures.createCanvas(key, w, h), c = t.getContext(); draw(c); t.refresh(); };
  const INK = '#1c2b38';
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const badge = (c, base) => {                                                   // flat rounded tile like the crates and cat bodies: dark outline, shaded underside, small highlight
    c.fillStyle = INK; rr(c, 4, 4, 120, 120, 32); c.fill();
    c.fillStyle = base; rr(c, 11, 11, 106, 106, 26); c.fill();
    c.save(); rr(c, 11, 11, 106, 106, 26); c.clip(); c.fillStyle = 'rgba(12,20,40,.22)'; c.fillRect(0, 88, 128, 40); c.restore();
    c.fillStyle = 'rgba(255,255,255,.5)'; rr(c, 22, 20, 30, 12, 6); c.fill();
    c.lineJoin = c.lineCap = 'round'; };
  const gl = (c, f) => { c.save(); c.translate(64, 64); c.scale(.74, .74); c.translate(-64, -64); f(); c.restore(); };
  const solid = (c, p) => { c.lineWidth = 8; c.strokeStyle = INK; c.stroke(p); c.fillStyle = '#fff'; c.fill(p); };            // white shape, dark outline
  const lines = (c, p, w) => { c.lineWidth = w + 8; c.strokeStyle = INK; c.stroke(p); c.lineWidth = w; c.strokeStyle = '#fff'; c.stroke(p); };

  mk('pw0', 128, 128, c => { badge(c, '#ffb300'); gl(c, () => {          // SPEED BOOST: lightning bolt
    const p = new Path2D(); p.moveTo(76, 14); p.lineTo(34, 70); p.lineTo(58, 70); p.lineTo(46, 116); p.lineTo(96, 54); p.lineTo(70, 54); p.lineTo(88, 14); p.closePath();
    solid(c, p); }); });

  mk('pw1', 128, 128, c => { badge(c, '#4fc3f7'); gl(c, () => {          // FREEZE: snowflake
    const p = new Path2D();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, ux = Math.cos(a), uy = Math.sin(a), bx = 64 + ux * 28, by = 64 + uy * 28;
      p.moveTo(64, 64); p.lineTo(64 + ux * 44, 64 + uy * 44);
      [-1, 1].forEach(d => { p.moveTo(bx, by); p.lineTo(bx + Math.cos(a + d * .95) * 15, by + Math.sin(a + d * .95) * 15); }); }
    lines(c, p, 7); }); });

  mk('pw2', 128, 128, c => { badge(c, '#e040fb'); gl(c, () => {          // DASH: triple chevron
    const p = new Path2D(); [22, 50, 78].forEach(x => { p.moveTo(x, 32); p.lineTo(x + 28, 64); p.lineTo(x, 96); });
    lines(c, p, 10); }); });

  mk('pw3', 128, 128, c => { badge(c, '#43d17a'); gl(c, () => {          // SHIELD: heater shield, two-tone inner
    const S = new Path2D(); S.moveTo(64, 14); S.lineTo(106, 28); S.lineTo(106, 64); S.bezierCurveTo(106, 92, 86, 110, 64, 118);
    S.bezierCurveTo(42, 110, 22, 92, 22, 64); S.lineTo(22, 28); S.closePath(); solid(c, S);
    const I = new Path2D(); I.moveTo(64, 28); I.lineTo(93, 38); I.lineTo(93, 64); I.bezierCurveTo(93, 84, 79, 97, 64, 104);
    I.bezierCurveTo(49, 97, 35, 84, 35, 64); I.lineTo(35, 38); I.closePath();
    c.fillStyle = '#166b3c'; c.fill(I);
    c.save(); c.beginPath(); c.rect(0, 0, 64, 128); c.clip(); c.fillStyle = '#2fa862'; c.fill(I); c.restore(); }); });

  mk('pw4', 128, 128, c => { badge(c, '#9575cd'); gl(c, () => {          // INVISIBILITY: crossed-out eye
    const E = new Path2D(); E.moveTo(10, 64); E.quadraticCurveTo(64, 10, 118, 64); E.quadraticCurveTo(64, 118, 10, 64); E.closePath(); solid(c, E);
    c.fillStyle = '#5b3fd0'; c.beginPath(); c.arc(64, 64, 20, 0, 7); c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(64, 64, 9, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(58, 58, 4, 0, 7); c.fill();
    const L = new Path2D(); L.moveTo(24, 20); L.lineTo(104, 108); lines(c, L, 8); }); });

  mk('bubble', 68, 68, c => {                                                    // shield bubble worn by a player: flat tint, light rim, highlight blob
    c.fillStyle = 'rgba(67,209,122,.28)'; c.beginPath(); c.arc(34, 34, 32, 0, 7); c.fill();
    c.strokeStyle = 'rgba(230,255,240,.95)'; c.lineWidth = 4; c.beginPath(); c.arc(34, 34, 30, 0, 7); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(21, 19, 8, 4.5, -.7, 0, 7); c.fill(); });

  mk('ice', 48, 52, c => {                                                       // ice block around a frozen player: chunky rounded block with shaded underside
    c.fillStyle = 'rgba(79,195,247,.6)'; rr(c, 2, 2, 44, 48, 12); c.fill();
    c.save(); rr(c, 2, 2, 44, 48, 12); c.clip(); c.fillStyle = 'rgba(20,70,140,.25)'; c.fillRect(0, 34, 48, 18); c.restore();
    c.strokeStyle = 'rgba(235,250,255,.95)'; c.lineWidth = 3; rr(c, 2, 2, 44, 48, 12); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.65)'; rr(c, 9, 9, 14, 7, 3.5); c.fill(); });

  mk('ring', 128, 128, c => {                                                    // expanding shockwave (tinted per use)
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.7, 'rgba(255,255,255,.12)');
    g.addColorStop(.93, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
}

/* =====================================================================
 * MenuScene: only builds the shared textures. The menu itself is HTML (see "Menu UI" below).
 * ===================================================================== */
class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() { if (!this.textures.exists('tri')) this.makeTextures(); }   // textures survive a return to the main menu

  /** Draws a cat-like character for each of the 12 colours into textures 'p0'..'p11'. */
  makeTextures() {
    COLORS.forEach((c, i) => {
      const g = this.add.graphics();
      g.fillStyle(0x1c2b38).fillTriangle(4, 12, 6, 0, 14, 10).fillTriangle(32, 12, 30, 0, 22, 10)
        .fillRoundedRect(2, 8, 32, 28, 9);
      g.fillStyle(c).fillRect(2, 13, 32, 6).fillRect(-4, 14, 8, 4);       // headband + tail
      g.fillStyle(0xffffff).fillCircle(12, 25, 4.5).fillCircle(24, 25, 4.5);
      g.fillStyle(0x000000).fillCircle(13, 25, 2).fillCircle(25, 25, 2);
      g.generateTexture('p' + i, 36, 36); g.destroy();
    });
    const t = this.add.graphics(); t.fillStyle(0x1c2b38).fillTriangle(0, 0, 26, 0, 13, 15).fillStyle(0xffffff).fillTriangle(4, 3, 22, 3, 13, 11);   // IT marker: white arrow, dark rim
    t.generateTexture('tri', 26, 15); t.destroy();
    const e = this.add.graphics(); e.fillStyle(0xffe082).fillTriangle(0, 12, 10, 0, 20, 12);      // jump-pad arrow
    e.generateTexture('arrow', 20, 12); e.destroy();
    const c = this.add.graphics(); c.fillStyle(0xffffff)                                          // cloud
      .fillEllipse(100, 50, 120, 34).fillEllipse(72, 38, 60, 36).fillEllipse(124, 34, 70, 42);
    c.generateTexture('cloud', 200, 80); c.destroy();
    const m = this.add.graphics(); m.fillStyle(0xffffff).fillCircle(4, 4, 4);                     // mote
    m.generateTexture('mote', 8, 8); m.destroy();
    makePowerTextures(this); makeSeaTextures(this);
  }
}

/** Host: tell everyone (and ourselves) to begin a round. */
function startRound() {
  const slots = Object.keys(G.conns).map(Number).sort((a, b) => a - b);
  if (!slots.length) return;                                   // no bots: need at least one other player
  const old = G.conns, oldIn = G.inputs; G.conns = {}; G.inputs = {};
  slots.forEach((o, k) => { G.conns[k + 1] = old[o]; G.inputs[k + 1] = oldIn[o]; old[o].slot = k + 1; send(old[o], { t: 'welcome', slot: k + 1 }); });   // close any gap left by someone who left the lobby
  G.maxP = slots.length + 1;
  broadcast({ t: 'start', map: G.map, maxP: G.maxP, round: G.round, wins: G.wins });
  document.getElementById('menu').classList.add('gone');
  activeScene().scene.start('Play');
}

/* =====================================================================
 * Menu UI: HTML screens (home, map, settings, join, lobby) + host / join logic
 * ===================================================================== */
const $ = id => document.getElementById(id);
const TIMES = [10, 20, 30, 45, 60, 90, 120, 180, 240, 300];       // selectable round lengths (s)
const POWER_NAMES = ['OFF', 'RARE', 'NORMAL', 'OFTEN'];

function show(id) {
  document.querySelectorAll('#menu .screen').forEach(s => { s.hidden = s.id !== id; });
  const f = $(id).querySelector('[data-focus]'); if (f && !f.hidden) f.focus();
}

function paintSettings() {
  $('vPlayers').textContent = G.cap; $('vTime').textContent = G.round + 's'; $('vPower').textContent = POWER_NAMES[G.power];
  const at = { players: [G.cap, 2, 12], time: [TIMES.indexOf(G.round), 0, TIMES.length - 1], power: [G.power, 0, POWER_NAMES.length - 1] };
  document.querySelectorAll('.step').forEach(b => { const [v, lo, hi] = at[b.dataset.set]; b.disabled = +b.dataset.d < 0 ? v <= lo : v >= hi; });
}
function stepSetting(k, d) {
  if (k === 'players') G.cap = clamp(G.cap + d, 2, 12);
  else if (k === 'time') G.round = TIMES[clamp(TIMES.indexOf(G.round) + d, 0, TIMES.length - 1)];
  else G.power = clamp(G.power + d, 0, POWER_NAMES.length - 1);
  paintSettings();
}

const paintLobby = () => {
  const n = Object.keys(G.conns).length + 1;
  $('lobCount').textContent = n + ' / ' + (G.isHost ? G.cap : G.maxP);
  if (G.isHost) { $('startBtn').disabled = n < 2; if (!$('startBtn').hidden) $('lobNote').textContent = n < 2 ? 'Share the code. Waiting for at least one more player...' : 'Share the code. Press START when everyone is in.'; }
};
const say = msg => { ($('scrJoin').hidden ? $('lobNote') : $('joinMsg')).textContent = msg; };   // status line of the visible screen

function leaveRoom() {
  G.leaving = true;
  try { G.peer && G.peer.destroy(); } catch (e) {}
  G.peer = G.hostConn = null; G.conns = {}; G.inputs = {}; G.isHost = false;
  show('scrHome');
}

/** Host: open a room for the chosen map with the current settings. */
function hostRoom(mapId) {
  setMap(mapId); G.maxP = G.cap; G.isHost = true; G.slot = 0; G.conns = {}; G.inputs = {};
  const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join('');
  $('lobCode').textContent = code; $('lobPlayers').hidden = false; $('startBtn').hidden = true; paintLobby();
  $('lobInfo').textContent = `${MAPS[mapId].name} map, ${G.round}s rounds, power-ups ${POWER_NAMES[G.power].toLowerCase()}`;
  $('lobNote').textContent = 'Opening room...'; show('scrLobby');
  G.peer = new Peer('tagparty-' + code);
  G.peer.on('error', e => say('Could not open the room (' + e.type + '). Go back and try again.'));
  G.peer.on('open', () => { $('startBtn').hidden = false; paintLobby(); });
  G.peer.on('connection', conn => {                             // a guest joined
    const used = Object.keys(G.conns).length + 1;
    if (used >= G.cap) return conn.close();
    let slot = 1; while (G.conns[slot]) slot++;
    G.conns[slot] = conn; conn.slot = slot;                      // conn.slot can change when slots are compacted at the start
    conn.on('open', () => { send(conn, { t: 'welcome', slot: conn.slot }); paintLobby(); });
    conn.on('data', m => { if (m.t === 'me') G.inputs[conn.slot] = m; });      // a guest sharing where it is (+ E-press counter)
    conn.on('close', () => { if (G.conns[conn.slot] === conn) { delete G.conns[conn.slot]; delete G.inputs[conn.slot]; } paintLobby(); });
  });
}

/** Guest: connect to a room by its 4-letter code. */
function joinRoom(code) {
  G.isHost = false; G.leaving = false; $('joinMsg').textContent = 'Connecting...';
  try { G.peer && G.peer.destroy(); } catch (e) {}
  G.peer = new Peer();
  G.peer.on('open', () => {
    const c = G.hostConn = G.peer.connect('tagparty-' + code, { reliable: false });
    c.on('open', () => {
      $('lobCode').textContent = code; $('lobPlayers').hidden = true; $('startBtn').hidden = true; $('lobInfo').textContent = '';
      $('lobNote').textContent = 'Connected. Waiting for the host to start...'; show('scrLobby'); });
    c.on('data', onHostMsg);
    c.on('close', () => { if (!G.leaving) location.reload(); });
  });
  G.peer.on('error', e => say(e.type === 'peer-unavailable' ? 'No room with that code.' : 'Could not join (' + e.type + ').'));
}

/** Esc menu in a game. Online (guests connected) the round keeps running behind it; alone it freezes. */
function setPause(on) {
  G.paused = on; $('pause').hidden = !on;
  const sc = activeScene(), solo = !Object.keys(G.conns).length && G.isHost && sc && sc.scene.key === 'Play';
  $('pauseNote').textContent = solo || !on ? '' : 'The game keeps running while you are in this menu.';
  if (sc && solo) on ? sc.scene.pause() : sc.scene.resume();
  if (on) $('resumeBtn').focus();
}
/** Leave the game for the title screen (guests are dropped back to theirs when the host leaves). */
function toMainMenu() {
  const sc = activeScene(); G.paused = false; $('pause').hidden = true;
  if (sc && game.scene.isPaused(sc.scene.key)) sc.scene.resume();
  G.wins = Array(12).fill(0);
  leaveRoom();
  $('menu').classList.remove('gone'); document.body.style.background = '';
  if (sc) sc.scene.start('Menu');
}

function initUI() {
  $('hostBtn').onclick = () => show('scrMap');
  $('joinBtn').onclick = () => { $('joinMsg').textContent = ''; show('scrJoin'); };
  document.querySelectorAll('.island').forEach(b => { b.onclick = () => hostRoom(b.dataset.map); });
  $('settingsBtn').onclick = () => { paintSettings(); show('scrSettings'); };
  document.querySelectorAll('.step').forEach(b => { b.onclick = () => stepSetting(b.dataset.set, +b.dataset.d); });
  document.querySelectorAll('.back').forEach(b => { b.onclick = () => (b.dataset.back === 'leave' ? leaveRoom() : show(b.dataset.back)); });
  $('startBtn').onclick = startRound;
  const code = $('codeIn'), go = () => code.value.length === 4 ? joinRoom(code.value) : ($('joinMsg').textContent = 'Enter the 4-letter room code.');
  code.oninput = () => { code.value = code.value.toUpperCase().replace(/[^A-Z]/g, ''); };
  code.onkeydown = e => { if (e.key === 'Enter') go(); };
  $('joinGo').onclick = go;
  window.addEventListener('keydown', e => {                       // Esc = back in the menus, pause menu in a game
    if (e.key !== 'Escape') return;
    if ($('menu').classList.contains('gone')) return setPause(!G.paused);
    const b = document.querySelector('.screen:not([hidden]) .back'); if (b) b.click(); });
  $('resumeBtn').onclick = () => setPause(false);
  $('quitBtn').onclick = toMainMenu;
  paintSettings();
}
initUI();

/* =====================================================================
 * PlayScene: gameplay. Every machine simulates its own player; remote players are mirrored from shared positions.
 * ===================================================================== */
class PlayScene extends Phaser.Scene {
  constructor() { super('Play'); }

  create() {
    drawBg(this); drawLevel(this);
    this.host = G.isHost; if (!this.host) G.snap = null; else G.inputs = {}; this.frame = 0; this.timeLeft = G.round;   // new round: host forgets last round's shared positions
    this.it = Phaser.Math.Between(0, G.maxP - 1); this.cdUntil = 0; this.over = false;
    this.pu = []; this.puId = 0; this.spawnAt = this.time.now + POWER_RATES[G.power].first; this.pus = {}; this.sp = []; this.su = [];   // orbs (host), orb sprites, per-player [power, fx]
    this.ec = 0; this.lastSendT = 0; this.lastMe = ''; this.effT = 0; this.hudShow = -1; this.pwLock = 0; this.pwSpent = false;
    this.physics.world.setBoundsCollision(false, false, true, true);   // wrap on X instead

    // Solid platform bodies (invisible zones under the drawn graphics)
    const plats = this.physics.add.staticGroup();
    PLATS.forEach(([x, y, w], i) => {
      const floor = i === PLATS.length - 1;
      const z = this.add.zone(x + w / 2, y + (floor ? 15 : 8), w, floor ? 30 : 16);
      z.floor = floor; plats.add(z);
    });
    CRATES.forEach(([cx, cy]) => {                       // crates are solid from every side
      const z = this.add.zone(cx + CRATE / 2, cy + CRATE / 2, CRATE, CRATE); z.solid = true; plats.add(z); });
    plats.refresh();

    // Jump pads: art is in drawLevel, here just pulsing arrows above each pad
    PADS.forEach(x => { for (let k = 0; k < 2; k++) {
      const a = this.add.image(x, 656, 'arrow').setDepth(-3);
      this.tweens.add({ targets: a, y: 622, alpha: { from: .9, to: 0 }, duration: 900, repeat: -1, delay: k * 450 }); } });

    // Players
    this.pl = []; this.group = this.physics.add.group();
    for (let i = 0; i < G.maxP; i++) {
      const x = 120 + i * (1040 / G.maxP);
      // Only MY player gets a physics body (I move myself). Everyone else is a plain sprite that mirrors shared positions.
      // NB: body settings are applied AFTER group.create, which would otherwise reset them.
      const mine = i === G.slot;
      const p = (mine ? this.group.create(x, 650, 'p' + i) : this.add.sprite(x, 650, 'p' + i)).setDepth(5);
      p.idx = i; p.pj = false; p.hold = 0;
      p.power = 0; p.ec = 0; p.pfx = 0; p.speedUntil = p.shieldUntil = p.invisUntil = p.frozenUntil = p.dashUntil = p.castUntil = p.busyUntil = 0;
      p.coyote = -1e9; p.buffer = -1e9; p.jumpT = -1e9; p.dropUntil = 0;
      if (mine) p.body.setSize(30, 32).setOffset(3, 4).setMaxVelocity(330, 1700).setCollideWorldBounds(true);
      this.pl.push(p);
    }
    // Shield bubble + ice block per player (toggled from snapshot flags)
    this.aura = this.pl.map(() => ({ sh: this.add.image(0, 0, 'bubble').setDepth(5.5).setVisible(false),
                                     ice: this.add.image(0, 0, 'ice').setDepth(5.5).setVisible(false) }));
    this.physics.world.gravity.y = 1800;
    // One-way platforms: land on top, pass through from below / while dropping (S / Down). Only my own body collides.
    this.physics.add.collider(this.group, plats, null, (p, z) => {
      if (z.floor || z.solid) return true;
      if (this.time.now < p.dropUntil) return false;
      return p.body.velocity.y >= 0 && p.body.prev.y + p.body.height <= z.body.top + 4;
    });

    // "IT" indicator: glow + white triangle + text
    this.glow = this.add.circle(0, 0, 30, 0xffffff, .35).setDepth(4);
    this.tri = this.add.image(0, 0, 'tri').setDepth(6);
    this.itTxt = this.add.text(0, 0, 'IT', this.font(18)).setOrigin(.5).setDepth(6);

    // HUD
    const hud = [];
    this.timerTxt = this.add.text(W / 2, 40, '', this.font(64)).setOrigin(.5).setDepth(10); hud.push(this.timerTxt);
    this.score = COLORS.slice(0, G.maxP).map((c, i) => {
      hud.push(this.add.circle(30 + i * 62, 30, 11, c).setStrokeStyle(3, 0x1c2b38).setDepth(10));
      const t = this.add.text(48 + i * 62, 30, '', this.font(20)).setOrigin(0, .5).setDepth(10); hud.push(t); return t; });

    // Power-up HUD (bottom-right): held power, its name, an E key-cap, and a timer bar while an effect runs
    const hx = W - 62, hy = H - 62;
    hud.push(this.add.graphics().setDepth(10).fillStyle(0x27246e, .35).fillRect(hx - 42, hy - 42, 84, 84)
      .lineStyle(4, 0xffffff).strokeRect(hx - 42, hy - 42, 84, 84));
    this.hudIcon = this.add.image(hx, hy - 6, 'pw0').setScale(.52).setDepth(11).setVisible(false);
    this.hudEmpty = this.add.text(hx, hy, '?', this.font(40)).setOrigin(.5).setDepth(11).setAlpha(.3);
    this.hudName = this.add.text(W - 16, hy - 56, '', this.font(16)).setOrigin(1, .5).setDepth(11);
    this.hudKey = this.add.container(hx - 40, hy + 40, [this.add.circle(0, 0, 14, 0xffffff).setStrokeStyle(3, 0x1c2b38),
      this.add.text(0, 0, 'E', { fontFamily: FONT, fontSize: '19px', color: '#1c2b38' }).setOrigin(.5)]).setDepth(12).setVisible(false);
    this.hudBar = this.add.graphics().setDepth(12);
    this.msg = this.add.text(W / 2, 130, '', this.font(46)).setOrigin(.5).setDepth(10);
    hud.push(this.hudIcon, this.hudEmpty, this.hudName, this.hudKey, this.hudBar, this.msg);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E');
    this.lastIn = '';
  }

  /** HUD text: white, chunky rounded font, dark indigo outline so it stays readable on both maps. */
  font(size) {
    return { fontFamily: FONT, fontSize: size + 'px', color: '#fff', stroke: '#2b2878', strokeThickness: Math.max(3, size / 9 | 0),
             shadow: { offsetY: Math.max(2, size / 14 | 0), color: 'rgba(38,34,120,.5)', blur: 0, fill: true } };
  }

  /** Read the local keyboard for this machine's player. */
  localInput() {
    const k = this.keys;
    if (G.paused) return { t: 'in', ec: this.ec, l: false, r: false, j: false, d: false };       // Esc menu open: no input
    if (Phaser.Input.Keyboard.JustDown(k.E)) this.ec++;           // counter, so a dropped packet can't lose a press
    return { t: 'in', ec: this.ec, l: k.A.isDown || k.LEFT.isDown, r: k.D.isDown || k.RIGHT.isDown,
             j: k.W.isDown || k.UP.isDown || k.SPACE.isDown, d: k.S.isDown || k.DOWN.isDown };
  }

  /** Host: a player who disconnected mid-round is parked off-screen; if they were IT, IT passes to someone still here. */
  dropOut(p, i) {
    if (!p.parked) { p.parked = true; p.setVisible(false); p.x = p.y = -500; p.power = 0; }
    if (this.it === i) { const here = this.pl.map((_, k) => k).filter(k => k === 0 || G.conns[k]); this.it = here[Math.random() * here.length | 0]; this.cdUntil = this.time.now + 1500; }
  }

  /** (Unused: there are no bots any more.) Very small chase / flee AI for unfilled slots. */
  botInput(i) {
    const me = this.pl[i], it = this.pl[this.it]; let dx = 0, dy = 0;
    if (i === this.it) {
      let best = 1e9; this.pl.forEach(o => { if (o !== me && this.time.now >= o.invisUntil) { const d = Phaser.Math.Distance.Between(me.x, me.y, o.x, o.y);
        if (d < best) { best = d; dx = o.x - me.x; dy = o.y - me.y; } } });
    } else if (this.time.now >= it.invisUntil || Math.abs(me.x - it.x) < 150) { dx = me.x - it.x; dy = me.y - it.y; }   // can't flee an unseen IT
    const flee = i !== this.it;
    if (me.hold <= 0 && (flee ? (Math.abs(dx) < 200 && Math.random() < .05)
                              : (dy < -30 && Math.random() < .06) || Math.random() < .004)) me.hold = 22;
    const j = me.hold > 0; me.hold--;                            // bots hold jump for a full-height hop
    return { l: dx < -15, r: dx > 15, j, d: false };
  }

  /** Host: transfer IT when the (non-cooling-down) IT player touches someone. */
  tryTag(a, b) {
    if (a === b || this.over || this.time.now < this.cdUntil) return;
    const [x, y] = a.idx === this.it ? [a, b] : b.idx === this.it ? [b, a] : [null, null];
    if (!x) return;
    if (this.time.now < x.frozenUntil || this.time.now < y.shieldUntil) return;   // a frozen IT can't tag; a shield blocks tags
    this.it = y.idx; this.cdUntil = this.time.now + 1500;
  }

  /** Host: IT touches someone? (Players are shared positions now, so this is a plain box check instead of physics overlap.) */
  tagCheck() {
    const it = this.pl[this.it]; if (!it || it.parked) return;
    for (const o of this.pl) if (o !== it && !o.parked && Math.abs(o.x - it.x) < 32 && Math.abs(o.y - it.y) < 34) this.tryTag(it, o);
  }

  /** Smoothly follow a shared position (snaps when far, e.g. after wrapping across the edge). */
  follow(p, x, y, dt) {
    if (Math.abs(p.x - x) > 250 || Math.abs(p.y - y) > 250) { p.x = x; p.y = y; return; }
    const k = 1 - Math.exp(-dt / 45);
    p.x += (x - p.x) * k; p.y += (y - p.y) * k;
  }

  /** Host: keep a player on a diagonal ramp (Arcade physics has no slopes, so it's done by hand). */
  rampCollide(p) {
    const b = p.body, was = p.onRamp; p.onRamp = false;
    if (this.time.now < p.dropUntil || b.velocity.y < 0) return;
    for (const R of RAMPS) {
      if (p.x < R.x1 || p.x > R.x2) continue;
      const line = rampY(R, p.x), pen = b.bottom - line;              // pen > 0: feet below the surface
      if (pen >= (was ? -10 : -2) && pen < 22 && b.prev.y + b.height <= line + 14) {
        p.y -= pen; b.velocity.y = 0; p.onRamp = true; return;        // snap feet onto the surface
      }
    }
  }

  /** Host: apply one player's input to its physics body. */
  drive(p, inp) {
    this.rampCollide(p);
    const b = p.body, now = this.time.now, frozen = now < p.frozenUntil || !!p.netFrozen, dashing = !frozen && now < p.dashUntil, speedy = now < p.speedUntil;
    if (frozen) inp = { ...inp, l: 0, r: 0, j: false, d: false };
    const dir = inp.r ? 1 : inp.l ? -1 : 0;
    const grounded = (b.blocked.down || b.touching.down || p.onRamp) && now - p.jumpT > 100;
    if (grounded) p.coyote = now;

    // Horizontal: snappy on the ground, looser in the air, extra braking when reversing
    const turning = dir !== 0 && Math.sign(b.velocity.x) === -dir;
    b.setDragX(grounded ? 2600 : 450);
    b.maxVelocity.x = dashing ? 1100 : speedy ? 520 : 330;
    b.setAccelerationX(dir * (grounded ? (turning ? 5500 : 3200) : 2100) * (speedy ? 1.5 : 1));
    if (dir) p.setFlipX(dir < 0);

    // Jump (single jump only): buffer (press just before landing) + coyote time (just after leaving a ledge)
    if (inp.j && !p.pj) p.buffer = now;
    if (now - p.buffer < 120 && now - p.coyote < 90) {
      b.setVelocityY(-720); p.jumpT = now; p.buffer = p.coyote = -1e9;
    }
    p.pj = inp.j;
    if (b.velocity.y > 950) b.setVelocityY(950);                 // fall-speed cap (max Y velocity is raised for jump pads)

    // Gravity shaping: heavier when falling, and cut short when jump is released (variable height)
    b.setGravityY(b.velocity.y > 0 ? 900 : (!inp.j && b.velocity.y < 0 ? 1700 : 0));

    if (inp.d && grounded) p.dropUntil = now + 250;             // drop through one-way platform

    if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0;            // X wrap

    // Jump pad (only when standing on the floor at a pad's x)
    if (!frozen && b.velocity.y >= 0 && b.bottom >= 682 && PADS.some(x => Math.abs(p.x - x) < 38)) {
      b.setVelocityY(-720 * 2.2);   // pad = 2.2x a normal jump
      p.jumpT = now; p.coyote = p.buffer = -1e9;
    }

    // Frozen: stuck in place. Dash: flat, gravity-free burst, then keep some momentum.
    if (frozen) b.setVelocityX(0);
    b.allowGravity = !dashing;
    if (dashing) { b.setAccelerationX(0); b.setVelocity(p.dashDir * 1000, 0); }
    else if (p.wasDash) b.setVelocityX(p.dashDir * 420);
    p.wasDash = dashing;
  }

  /** My own E press, applied instantly to MY movement (the host still decides the rules and echoes the effect back to everyone). */
  predictPower(p, inp) {
    const t = (this.sp[G.slot] || [0])[0], now = this.time.now;
    if (!t || p.netFrozen || (this.pwSpent && now < this.pwLock)) return;
    this.pwSpent = true; this.pwLock = now + 2000;                                  // don't predict again until the host confirms the power is gone
    if (t === 1) p.speedUntil = now + EFFECT_MS;
    else if (t === 3) { p.dashDir = inp.r ? 1 : inp.l ? -1 : p.flipX ? -1 : 1; p.dashUntil = now + DASH_MS; }
  }

  update(time, dt) {
    if (this.over) return;
    const now = this.time.now, me = this.pl[G.slot], inp = this.localInput();

    // 1) Move MYSELF, right now, with my own keyboard - no waiting on anyone.
    const pressedE = inp.ec > me.ec;
    if (this.host) {
      if (pressedE) { me.ec = inp.ec; this.activate(me, inp); }                       // host owns the rules, so it just activates directly
    } else if (pressedE) { me.ec = inp.ec; this.predictPower(me, inp); }
    this.drive(me, inp);

    if (this.host) {
      // 2) Host: take everyone else's shared position + E presses, then referee.
      this.pl.forEach((p, i) => {
        if (i === 0) return;
        if (!G.conns[i]) return this.dropOut(p, i);                                   // that player left: no bot takes over
        const s = G.inputs[i]; if (!s) return;
        this.follow(p, s.x, s.y, dt); p.setFlipX(!!s.f);
        if ((s.ec | 0) > p.ec) { p.ec = s.ec | 0; this.activate(p, {}); }              // their E press
      });
      this.tagCheck();
      this.pickups(now);
      this.sp = this.pl.map(p => [p.power, this.fx(p, now)]); this.su = this.pu.map(u => [u.id, u.type, u.x, u.y]);
      this.timeLeft -= dt / 1000;
      if (++this.frame % 3 === 0) broadcast({ t: 's', it: this.it, time: this.timeLeft,
        cd: time < this.cdUntil, u: this.su,
        p: this.pl.map((p, i) => [p.x | 0, p.y | 0, p.flipX ? 1 : 0, ...this.sp[i]]) });
      if (this.timeLeft <= 0) return this.endRound();
    } else {
      // 2) Guest: just share where I am (about 30 times a second), and take everyone else's positions from the host.
      const mine = { t: 'me', x: me.x | 0, y: me.y | 0, f: me.flipX ? 1 : 0, ec: this.ec }, str = mine.x + ',' + mine.y + ',' + mine.f + ',' + mine.ec;
      if (++this.frame % 2 === 0 && (str !== this.lastMe || time - this.lastSendT > 120) || pressedE) { this.lastMe = str; this.lastSendT = time; send(G.hostConn, mine); }
      const n = G.snap; if (n) { this.it = n.it; this.timeLeft = n.time; this.cd = n.cd;
        this.sp = n.p.map(q => [q[3], q[4]]); this.su = n.u || [];
        if (!this.sp[G.slot] || !this.sp[G.slot][0]) this.pwSpent = false;
        me.netFrozen = !!(n.p[G.slot] && (n.p[G.slot][4] & FX.FROZEN));               // the one thing the host can do TO me: freeze
        n.p.forEach((q, i) => { const p = this.pl[i]; if (!p || i === G.slot) return;   // never overwrite my own position
          this.follow(p, q[0], q[1], dt); p.setFlipX(!!q[2]); }); }
    }
    this.visuals(time);
  }

  /** Updates IT indicator, cooldown flashing, and HUD (both host and guests). */
  visuals(time) {
    const cd = this.host ? time < this.cdUntil : this.cd;
    this.fxVisuals(time, cd); this.syncOrbs(time);
    const t = this.pl[this.it]; if (!t) return;
    this.glow.setPosition(t.x, t.y + 4).setScale(1 + Math.sin(time / 120) * .12);
    this.tri.setPosition(t.x, t.y - 32 + Math.sin(time / 150) * 3);
    this.itTxt.setPosition(t.x, t.y - 50);
    const hid = ((this.sp[this.it] || [0, 0])[1] & FX.INVIS) && this.it !== G.slot;      // an invisible IT hides its marker too
    this.glow.setAlpha(hid ? .04 : .35); this.tri.setAlpha(hid ? .1 : 1); this.itTxt.setAlpha(hid ? .1 : 1);
    const tv = String(Math.max(0, Math.ceil(this.timeLeft)));       // strings + change check: Phaser Text
    if (this.timerTxt.text !== tv) this.timerTxt.setText(tv);        // re-rasterises every call otherwise
    this.score.forEach((s, i) => { const v = String(G.wins[i]); if (s.text !== v) s.setText(v); });
  }

  /** Status bit-flags for a player (sent to guests, and used for drawing on the host too). */
  fx(p, n) {
    return (n < p.speedUntil) * FX.SPEED + (n < p.shieldUntil) * FX.SHIELD + (n < p.invisUntil) * FX.INVIS
         + (n < p.frozenUntil) * FX.FROZEN + (n < p.dashUntil) * FX.DASH + (n < p.castUntil) * FX.CAST;
  }

  /** Host: keep a few orbs on the map; a player holds one power at a time (also busy while an effect runs). */
  pickups(now) {
    const R = POWER_RATES[G.power], cap = R.cap(G.maxP);
    if (this.pu.length < cap && now >= this.spawnAt) {
      for (let tries = 0; tries < 12; tries++) {
        const [x, y] = SPOTS[Math.random() * SPOTS.length | 0];
        if (this.pu.some(u => Math.abs(u.x - x) + Math.abs(u.y - y) < 120)) continue;
        this.pu.push({ id: ++this.puId, type: Phaser.Math.Between(1, POWERS.length), x, y }); break;
      }
      this.spawnAt = now + R.gap * (.75 + Math.random() * .5);
    }
    this.pl.forEach(p => {
      if (p.power || now < p.busyUntil) return;
      const k = this.pu.findIndex(u => Math.hypot(u.x - p.x, u.y - p.y) < 34);
      if (k >= 0) { p.power = this.pu[k].type; this.pu.splice(k, 1); this.spawnAt = Math.max(this.spawnAt, now + R.gap * .6); }
    });
  }

  /** Host: use the held power (E). */
  activate(p, inp) {
    const now = this.time.now, t = p.power; if (!t || now < p.frozenUntil) return;
    p.power = 0;
    if (t === 1) p.speedUntil = p.busyUntil = now + EFFECT_MS;
    else if (t === 4) p.shieldUntil = p.busyUntil = now + EFFECT_MS;
    else if (t === 5) p.invisUntil = p.busyUntil = now + EFFECT_MS;
    else if (t === 3) { p.dashDir = inp.r ? 1 : inp.l ? -1 : p.flipX ? -1 : 1; p.dashUntil = now + DASH_MS; p.busyUntil = now + DASH_MS + 150; }
    else { p.castUntil = p.busyUntil = now + 400;                                   // freeze everyone nearby who has no shield
      this.pl.forEach(o => { if (o !== p && now >= o.shieldUntil && Phaser.Math.Distance.Between(o.x, o.y, p.x, p.y) < FREEZE_R) o.frozenUntil = now + FREEZE_MS; }); }
  }

  /** Bots fire a held power when IT is near a target, or when a runner has IT close. */
  botPower(i) {
    const me = this.pl[i], near = (o, r) => Phaser.Math.Distance.Between(o.x, o.y, me.x, me.y) < r;
    return i === this.it ? this.pl.some(o => o !== me && near(o, me.power === 2 ? 300 : 420)) : near(this.pl[this.it], 300);
  }

  /** Expanding shockwave ring. */
  burst(x, y, color, r, ms) {
    const b = this.add.image(x, y, 'ring').setTint(color).setDepth(7).setScale(.15);
    this.tweens.add({ targets: b, scale: r * 2 / 128, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => b.destroy() });
  }

  afterimage(p, tint) {
    const g = this.add.image(p.x, p.y, p.texture.key).setFlipX(p.flipX).setTint(tint).setAlpha(.5).setDepth(4.5);
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  /** Orb sprites follow the snapshot list: new id = pop in, missing id = collected. */
  syncOrbs(time) {
    const seen = new Set();
    this.su.forEach(([id, t, x, y]) => {
      seen.add(id); let o = this.pus[id];
      if (!o) { o = this.pus[id] = { t, x, y, glow: this.add.circle(x, y, 27, POWERS[t - 1].color, .32).setDepth(3),
                                     icon: this.add.image(x, y, 'pw' + (t - 1)).setScale(.36).setDepth(4) };
        this.tweens.add({ targets: o.icon, scale: { from: 0, to: .36 }, duration: 260, ease: 'Back.easeOut' }); }
      const bob = Math.sin(time / 240 + id) * 5;
      o.icon.y = y + bob; o.glow.y = y + bob; o.glow.setScale(1 + Math.sin(time / 200 + id) * .13);
    });
    Object.keys(this.pus).forEach(id => { if (seen.has(+id)) return;
      const o = this.pus[id]; this.burst(o.x, o.y, POWERS[o.t - 1].color, 60, 350); o.glow.destroy(); o.icon.destroy(); delete this.pus[id]; });
  }

  /** Player effects + power HUD, driven only by snapshot flags so host and guests look identical. */
  fxVisuals(time, cd) {
    const me = G.slot;
    this.pl.forEach((p, i) => {
      const [, fx] = this.sp[i] || [0, 0], on = fx & ~p.pfx, au = this.aura[i]; p.pfx = fx;
      let al = i === this.it && cd ? (Math.sin(time / 50) > 0 ? .35 : .9) : 1;
      if (fx & FX.INVIS) al = i === me ? .4 : .07;                                    // others see a faint shimmer, you still see yourself
      p.setAlpha(al);
      if (fx & FX.FROZEN) p.setTint(0xa8e6ff); else p.clearTint();
      au.ice.setVisible(!!(fx & FX.FROZEN)).setPosition(p.x, p.y + 2);
      au.sh.setVisible(!!(fx & FX.SHIELD)).setPosition(p.x, p.y).setScale(1 + Math.sin(time / 160) * .07);
      if ((fx & (FX.SPEED | FX.DASH)) && time - (p.trailT || 0) > 30) { p.trailT = time; this.afterimage(p, fx & FX.DASH ? 0xe040fb : 0xffc107); }
      if (on & FX.CAST) this.burst(p.x, p.y, 0x8fe3ff, FREEZE_R, 550);
      if (on & (FX.SPEED | FX.SHIELD | FX.INVIS)) this.burst(p.x, p.y, POWERS[on & FX.SPEED ? 0 : on & FX.SHIELD ? 3 : 4].color, 70, 380);
    });

    // HUD: what I'm holding, or the effect that's currently running
    const [pw, fx] = this.sp[me] || [0, 0], act = fx & FX.SPEED ? 1 : fx & FX.SHIELD ? 4 : fx & FX.INVIS ? 5 : 0, show = pw || act;
    if (show !== this.hudShow) { this.hudShow = show; this.hudIcon.setVisible(!!show); this.hudEmpty.setVisible(!show);
      this.hudName.setText(show ? POWERS[show - 1].name : '');
      if (show) { this.hudIcon.setTexture('pw' + (show - 1));
        this.tweens.add({ targets: this.hudIcon, scale: { from: .8, to: .52 }, duration: 260, ease: 'Back.easeOut' }); } }
    this.hudIcon.setAlpha(pw ? 1 : .8);
    this.hudKey.setVisible(!!pw).setScale(1 + Math.sin(time / 180) * .08);
    this.hudBar.clear();
    if (act) { if (!this.effT) this.effT = time; const f = Math.max(0, 1 - (time - this.effT) / EFFECT_MS);
      this.hudBar.fillStyle(0x000000, .55).fillRoundedRect(W - 96, H - 30, 68, 6, 3).fillStyle(POWERS[act - 1].color).fillRoundedRect(W - 96, H - 30, 68 * f, 6, 3); }
    else this.effT = 0;
    const m = fx & FX.FROZEN ? 'FROZEN!' : ''; if (this.msg.text !== m) this.msg.setText(m);
  }

  /** Host: freeze, credit everyone but the loser, and move to GameOver. */
  endRound() {
    this.over = true; this.pl.forEach(p => { if (p.body) { p.body.setVelocity(0, 0); p.body.setAcceleration(0, 0); } });
    this.pl.forEach(p => { if (p.idx !== this.it) G.wins[p.idx]++; });
    broadcast({ t: 'over', loser: this.it, wins: G.wins });
    this.scene.start('GameOver', { loser: this.it });
  }
}

/* =====================================================================
 * GameOverScene: announce the loser, SPACE (host) restarts
 * ===================================================================== */
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }
  init(d) { this.loser = d.loser; }

  create() {
    drawBg(this); drawLevel(this);
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, .45);
    const hud = [];
    const f = (s, c, stroke = 0) => {                            // coloured title gets a dark rim; the rest is flat white with a soft shadow
      const o = { fontFamily: FONT, fontSize: s + 'px', color: c };
      if (stroke) { o.stroke = '#1a2b3a'; o.strokeThickness = stroke; } else o.shadow = { offsetY: 4, color: 'rgba(38,34,120,.5)', blur: 0, fill: true };
      return o; };
    hud.push(this.add.text(W / 2, 250, NAMES[this.loser] + ' LOSES!', f(120, '#' + COLORS[this.loser].toString(16).padStart(6, '0'), 10)).setOrigin(.5));
    for (let i = 0; i < G.maxP; i++) {                          // round-win scoreboard
      const x = W / 2 - (G.maxP - 1) * 45 + i * 90;
      hud.push(this.add.circle(x, 400, 20, COLORS[i]).setStrokeStyle(4, 0x1c2b38));
      hud.push(this.add.text(x, 450, G.wins[i], f(36, '#ffffff')).setOrigin(.5));
    }
    hud.push(this.add.text(W / 2, 580, G.isHost ? 'Press SPACE to play again' : 'Waiting for host to restart...', f(40, '#ffffff')).setOrigin(.5));
    if (G.isHost) this.input.keyboard.once('keydown-SPACE', () => { if (!G.paused) startRound(); });
  }
}

/* ---------------- Boot ---------------- */
if (document.fonts) document.fonts.load('32px "Lilita One"').catch(() => {});   // make sure canvas text can use the UI font
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: W, height: H, backgroundColor: '#3e9abb', render: { powerPreference: 'high-performance' },
  scale: { mode: Phaser.Scale.NONE },   // the canvas is stretched to the whole window by CSS (see style.css)
  physics: { default: 'arcade', arcade: { gravity: { y: 1500 }, debug: false } },
  scene: [MenuScene, PlayScene, GameOverScene]
});
