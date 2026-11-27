/* =========================================================================
   field.js  —  the background: the floating blocks, with depth
   =========================================================================
   Settled on the test page (lab.html) and adopted as the site's background.
   The old flat background (setupBlocks in js/main.js) is the fallback when
   this one cannot run (no WebGL, or reduced motion asked for): js/look.js
   switches back to it then.

   Same idea as the original: grey blocks and long bars on a paper field,
   switching on and off, redrawn 12 times a second on purpose. As in the
   original, every block wanders slowly in its own direction and the bars
   creep across; nothing follows the scroll.

   DEPTH    The sharp blocks are the FRONT. Everything else sits behind
            them in layers: each layer further back is smaller, paler,
            slower and more out of focus (the bokeh), and is drawn
            underneath the layers in front of it. Nothing blurry ever
            covers anything sharp.

   HOW A BLOCK IS MADE
            Each block is ONE grey (different blocks get different greys).
            A block is 2-5 PIECES of different lengths AND depths joined
            together, never the same strip repeated. Pieces come in four
            kinds, and no two in a row are the same kind:

              beam   long and thin          slab   broad
              post   short and stout        tab    a small nub

            Each new piece grows outward from the edge of what is already
            there. About a third of blocks then get a few bites cut out
            (notches, the odd hole); one in ten is a single scrap.

            Anything that comes out close to a filled square is thrown away
            and made again, so the field is angles and steps, not lumps.

   Every knob is in window.DepthField; the values below are the ones picked.
   Drawn with plain WebGL (no library): a block's cells are a tiny texture
   (one byte per cell), and the shader softens it by its layer's blur — so
   a blurred block is still one seamless shape.
   ========================================================================= */

(function () {
  'use strict';

  /* ---- knobs (the values picked on the test page) ------------------------ */
  const P = (window.DepthField = {
    on: true,
    bokeh: 15,        // px of blur on the back layer (0 = everything sharp)
    depth: 0.75,      // 0 = every layer the same size ... 1 = back layer much smaller
    density: 40,      // blocks alive on a 1280x800 screen (scales with screen area)
    size: 100,         // block size, px at the front: one cell of a shape is a quarter of this
    speed: 1.5,         // how fast blocks wander (1 = as on the site now, 0 = still)
    twinkle: true,    // back layers switch on and off faster than the front
    softBars: true,   // two of the bars sit in the back layer (off = every bar sharp, in front)
    reset() {},       // throw everything away and start over (set below)
    alive: 0,
    failed: false,
  });

  const FPS = 12, FRAME = 1000 / FPS;   // deliberate frame-skip
  const POP_MS = 160;                   // staccato blend when a block switches
  const REACH = 1.8;                    // the back layer is this much further away than the front
  const SHIFT = 70;                     // cursor parallax, px at the front
  const WANDER = 0.03;                  // px per ms, spread over both directions — the original's number

  /* front (z 0, sharp) to back (z 1, softest). share = part of the blocks that
     live there; hold = how long one stays lit; tones = which greys it may be
     (0 lightest .. 3 darkest, 4 = ink) */
  const LAYERS = [
    { z: 0.00, share: 0.16, hold: [7000, 14000], tones: [1, 2, 2, 2, 3, 3, 3, 4] },
    { z: 0.22, share: 0.18, hold: [6000, 11000], tones: [1, 1, 2, 2, 3] },
    { z: 0.45, share: 0.22, hold: [4000, 8000],  tones: [0, 1, 1, 2, 2] },
    { z: 0.70, share: 0.22, hold: [2500, 6000],  tones: [0, 0, 1, 1, 2] },
    { z: 1.00, share: 0.22, hold: [1500, 4500],  tones: [0, 0, 1, 1] },
  ];

  const root = document.documentElement;
  const field = document.getElementById('depth-field');
  if (!field || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { P.failed = true; return; }
  const gl = field.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) { P.failed = true; return; }

  /* ---- shaders ---------------------------------------------------------- */
  const HEAD = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif`;
  const VERT = `
    attribute vec2 aCorner;
    uniform vec4 uQuad;      // left, top, width, height of the drawn quad (css px)
    uniform vec2 uView;      // canvas size (css px)
    uniform float uShift;    // sideways shove, used by the glitch
    varying vec2 vAt;
    void main() {
      vAt = uQuad.xy + aCorner * uQuad.zw;
      gl_Position = vec4((vAt.x + uShift) / uView.x * 2.0 - 1.0, 1.0 - vAt.y / uView.y * 2.0, 0.0, 1.0);
    }`;
  // a block: one byte per cell, softened by its layer's blur
  const FRAG_SHAPE = HEAD + `
    uniform sampler2D uGrid;
    uniform vec2 uCells;     // texture size, in cells (the shape plus an empty rim)
    uniform vec2 uOrigin;    // where the texture's corner is on screen (css px)
    uniform float uCell;     // one cell (css px)
    uniform float uBlur;     // defocus radius (css px)
    uniform vec3 uColor;
    varying vec2 vAt;
    float cell(vec2 c) { return texture2D(uGrid, (floor(c) + 0.5) / uCells).r; }   // exactly one cell
    float soft(vec2 p) { return texture2D(uGrid, p / uCells).r; }                  // blended with its neighbours
    void main() {
      vec2 p = (vAt - uOrigin) / uCell;                // position, in cells
      float r = max(uBlur / uCell, 0.0001);            // blur radius, in cells
      float a;
      if (r <= 0.5) {
        // exact average over a square of that radius: it can only reach 2 cells each way.
        // at r ~ 0 this is just the cell itself, so in-focus blocks keep square corners
        vec2 c0 = floor(p - r), c1 = floor(p + r);
        vec2 f = (p + r - c1) / (2.0 * r) * step(0.5, c1 - c0);
        a = mix(mix(cell(c0), cell(vec2(c1.x, c0.y)), f.x), mix(cell(vec2(c0.x, c1.y)), cell(c1), f.x), f.y);
      } else {
        float sum = 0.0;                               // wider than a cell: average a 5x5 spread
        for (int i = -2; i <= 2; i++) {
          for (int j = -2; j <= 2; j++) sum += soft(p + vec2(float(i), float(j)) * r * 0.5);
        }
        a = sum / 25.0;
      }
      gl_FragColor = vec4(uColor * a, a);
    }`;
  // one rectangle with a soft edge (the bars)
  const FRAG_RECT = HEAD + `
    uniform vec4 uBox;       // centre x, y, half width, half height (css px)
    uniform float uBlur;
    uniform vec3 uColor;
    varying vec2 vAt;
    void main() {
      vec2 q = abs(vAt - uBox.xy) - uBox.zw;
      float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      float a = 1.0 - smoothstep(-uBlur, uBlur, sd);
      gl_FragColor = vec4(uColor * a, a);
    }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(frag, names) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'aCorner');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (const n of ['uQuad', 'uView', 'uShift'].concat(names)) u[n] = gl.getUniformLocation(p, n);
    return { p, u };
  }
  const SHAPE = program(FRAG_SHAPE, ['uGrid', 'uCells', 'uOrigin', 'uCell', 'uBlur', 'uColor']);
  const RECT = program(FRAG_RECT, ['uBox', 'uBlur', 'uColor']);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);     // premultiplied "over"
  gl.clearColor(0, 0, 0, 0);                         // see-through: the page's paper shows
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.activeTexture(gl.TEXTURE0);

  /* ---- size ------------------------------------------------------------ */
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = field.clientWidth || window.innerWidth;
    H = field.clientHeight || window.innerHeight;
    field.width = Math.round(W * dpr);
    field.height = Math.round(H * dpr);
    gl.viewport(0, 0, field.width, field.height);
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---- palette: follows the CSS vars, so night mode flips it ------------ */
  let PAPER = [0.914, 0.914, 0.914], GREYS = [], BAR = [0.55, 0.55, 0.55];
  function readPalette() {
    const cs = getComputedStyle(root);
    const v = (name) => {
      const n = parseInt(cs.getPropertyValue(name).trim().slice(1), 16);
      return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    };
    PAPER = v('--paper');
    GREYS = [v('--block'), v('--line'), v('--line-2'), v('--line-3'), v('--ink')];
    BAR = v('--grey');
  }
  readPalette();
  let wasNight = root.classList.contains('night');
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  /* ---- cursor: eased, 0..1, 0.5 = centred ------------------------------- */
  let tmx = 0.5, tmy = 0.5, smx = 0.5, smy = 0.5;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    tmx = e.clientX / W;
    tmy = e.clientY / H;
  }, { passive: true });

  /* ---- depth ----------------------------------------------------------- */
  const rand = Math.random;
  const int = (n) => (rand() * n) | 0;                         // 0 .. n-1
  const pick = (list) => list[int(list.length)];
  const scale = (z) => 1 / (1 + z * REACH * P.depth);          // further back = smaller, slower, leans less
  const blurOf = (z) => P.bokeh * Math.pow(z, 1.1);            // front = 0 = razor sharp
  const strength = (z) => 1 - 0.45 * z;                        // further back = paler
  const snap = (v) => Math.round(v * dpr) / dpr;

  /* ---- a block's shape -------------------------------------------------- */
  const ROOM = 48;                                   // working grid, in cells; shapes grow out from its middle
  const cellOf = () => P.size / 4;                   // one cell, px at the front: finer than a block, so pieces can differ in depth

  // returns { cols, rows, cells } — cells is a Uint8Array (255 = filled),
  // trimmed to the shape and with one empty cell all round
  function shape() {
    for (let attempt = 0; attempt < 12; attempt++) {
      const g = new Uint8Array(ROOM * ROOM);
      const put = (x, y, w, h, v) => {
        for (let j = Math.max(0, y); j < Math.min(ROOM, y + h); j++) {
          for (let i = Math.max(0, x); i < Math.min(ROOM, x + w); i++) g[j * ROOM + i] = v;
        }
      };
      const bar = (x, y, across, len, thick) => put(x, y, across ? len : thick, across ? thick : len, 1);
      const filled = () => { const on = []; for (let i = 0; i < g.length; i++) if (g[i]) on.push(i); return on; };
      const mid = ROOM >> 1;
      const empty = (x, y) => x < 0 || y < 0 || x >= ROOM || y >= ROOM || !g[y * ROOM + x];

      if (rand() < 0.1) {
        // scrap: one small piece on its own
        bar(mid, mid, rand() < 0.6, 2 + int(5), 1 + int(2));
      } else {
        // 2-5 pieces, each a different KIND from the one before, so one block mixes
        // long thin runs, broad slabs, stout posts and small tabs — never the same
        // strip repeated. [length, depth] in cells:
        const KINDS = {
          beam: () => [7 + int(11), 1 + int(2)],     // long and thin
          slab: () => [5 + int(7), 3 + int(4)],      // broad
          post: () => [3 + int(4), 2 + int(3)],      // short and stout
          tab:  () => [1 + int(3), 1 + int(3)],      // a small tab or nub
        };
        let last = '';
        for (let n = 0, count = pick([2, 2, 3, 3, 3, 4, 4, 5]); n < count; n++) {
          let kind;
          do { kind = pick(n === 0 ? ['beam', 'beam', 'slab', 'slab', 'post'] : ['beam', 'beam', 'slab', 'post', 'tab', 'tab']); } while (kind === last);
          last = kind;
          const [len, deep] = KINDS[kind]();
          const across = rand() < 0.5;                 // which way its long side runs
          const w = across ? len : deep, h = across ? deep : len;
          if (n === 0) { put(mid - (w >> 1), mid - (h >> 1), w, h, 1); continue; }

          // grow it OUT of the shape: find a filled cell on the edge, and the open side next to it
          for (let tries = 0; tries < 20; tries++) {
            const from = pick(filled()), fx = from % ROOM, fy = (from / ROOM) | 0;
            const way = int(4);
            if (way === 0 && empty(fx + 1, fy)) put(fx, fy - int(h), w, h, 1);                  // out to the right
            else if (way === 1 && empty(fx - 1, fy)) put(fx - w + 1, fy - int(h), w, h, 1);     // out to the left
            else if (way === 2 && empty(fx, fy + 1)) put(fx - int(w), fy, w, h, 1);             // down
            else if (way === 3 && empty(fx, fy - 1)) put(fx - int(w), fy - h + 1, w, h, 1);     // up
            else continue;
            break;
          }
        }
        // sometimes a few bites out of it (notches, the odd hole)
        if (rand() < 0.35) {
          for (let bites = 1 + int(3); bites > 0; bites--) {
            const from = pick(filled()), bw = 1 + int(3), bh = 1 + int(2);
            put((from % ROOM) - int(bw), ((from / ROOM) | 0) - int(bh), bw, bh, 0);
          }
        }
      }

      // keep only the biggest connected piece
      const label = new Int16Array(g.length);
      let best = 0, bestSize = 0;
      for (let start = 0, id = 0; start < g.length; start++) {
        if (!g[start] || label[start]) continue;
        id++;
        let size = 0;
        const todo = [start];
        label[start] = id;
        while (todo.length) {
          const at = todo.pop(), x = at % ROOM, y = (at / ROOM) | 0;
          size++;
          if (x > 0 && g[at - 1] && !label[at - 1]) { label[at - 1] = id; todo.push(at - 1); }
          if (x < ROOM - 1 && g[at + 1] && !label[at + 1]) { label[at + 1] = id; todo.push(at + 1); }
          if (y > 0 && g[at - ROOM] && !label[at - ROOM]) { label[at - ROOM] = id; todo.push(at - ROOM); }
          if (y < ROOM - 1 && g[at + ROOM] && !label[at + ROOM]) { label[at + ROOM] = id; todo.push(at + ROOM); }
        }
        if (size > bestSize) { bestSize = size; best = id; }
      }
      if (!best) continue;

      // trim to what is left
      let x0 = ROOM, y0 = ROOM, x1 = -1, y1 = -1;
      for (let i = 0; i < g.length; i++) {
        if (label[i] !== best) continue;
        const x = i % ROOM, y = (i / ROOM) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const cols = x1 - x0 + 1, rows = y1 - y0 + 1;

      // no lumps: if it nearly fills a box that is nearly square, make another
      const lump = bestSize / (cols * rows) > 0.7 && cols / rows > 0.5 && cols / rows < 2 && bestSize > 2;
      if (lump && attempt < 11) continue;

      const cells = new Uint8Array((cols + 2) * (rows + 2));
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) cells[(j + 1) * (cols + 2) + i + 1] = label[(y0 + j) * ROOM + x0 + i] === best ? 255 : 0;
      }
      return { cols, rows, cells };
    }
    return { cols: 3, rows: 1, cells: new Uint8Array([0, 0, 0, 0, 0, 0, 255, 255, 255, 0, 0, 0, 0, 0, 0]) };   // (never reached in practice)
  }

  /* ---- the camera: only the cursor moves it ------------------------------- */
  const cam = { x: 0, y: 0 };

  /* ---- making a block --------------------------------------------------- */
  let blocks = [];
  // where a block's corner is on screen: its start, plus how far it has wandered since
  function corner(b, k, now) {
    const age = (now - b.born) * P.speed;
    return [W / 2 + (b.X + b.vx * age - cam.x) * k, H / 2 + (b.Y + b.vy * age - cam.y) * k];
  }

  function spawn(now, li, stagger) {
    const L = LAYERS[li], k = scale(L.z), unit = cellOf();
    const s = shape();
    const range = P.twinkle ? L.hold : [5000, 10000];
    const life = range[0] + rand() * (range[1] - range[0]) + 2 * POP_MS;
    const b = {
      layer: li, X: 0, Y: 0, cols: s.cols, rows: s.rows, tex: null, grey: pick(L.tones), life,
      vx: (rand() - 0.5) * WANDER, vy: (rand() - 0.5) * WANDER,
      born: stagger ? now - rand() * life : now,
    };

    // start it somewhere clear of its neighbours in the same layer (they wander afterwards)
    for (let tries = 0; tries < 14; tries++) {
      b.X = cam.x + ((-0.08 + rand() * 1.16) * W - W / 2) / k - s.cols * unit / 2;
      b.Y = cam.y + ((-0.08 + rand() * 1.16) * H - H / 2) / k - s.rows * unit / 2;
      b.X = Math.round(b.X / unit) * unit; b.Y = Math.round(b.Y / unit) * unit;
      const u = unit * k, [sx, sy] = corner(b, k, now);
      const clear = blocks.every((o) => {
        if (o.layer !== li) return true;
        const [ox, oy] = corner(o, k, now);
        return sx + (s.cols + 1) * u <= ox || sx >= ox + (o.cols + 1) * u || sy + (s.rows + 1) * u <= oy || sy >= oy + (o.rows + 1) * u;
      });
      if (clear) break;
      if (tries === 13) return null;                 // no room in this layer right now; try again later
    }

    b.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, b.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, s.cols + 2, s.rows + 2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, s.cells);
    return b;
  }

  // long bars crossing the field, creeping and wrapping round like the original:
  // two sharp ones in front, two soft ones behind
  function makeBars() {
    return [0, 1, 2, 3].map((i) => ({
      across: rand() < 0.6,
      pos: rand(),                                   // where it crosses, as a fraction of the screen
      thick: 6 + rand() * 14,
      speed: (rand() - 0.5) * 0.00002,               // fraction per ms — the original's number
      back: i > 1,
      ink: i === 0,
    }));
  }

  let bars = makeBars(), seeded = false;
  P.reset = () => {
    for (const b of blocks) gl.deleteTexture(b.tex);
    blocks = [];
    bars = makeBars();
    seeded = false;
  };

  // keep every layer at its share of the total
  function tend(now) {
    const want = P.density * Math.min(1.8, Math.max(0.4, (W * H) / 1024000));
    const quota = LAYERS.map((L) => Math.max(1, Math.round(want * L.share)));
    const have = LAYERS.map(() => 0);
    for (const b of blocks) have[b.layer]++;
    if (!seeded) {
      seeded = true;
      LAYERS.forEach((L, li) => {
        for (let i = have[li], misses = 0; i < quota[li] && misses < 20;) {
          const b = spawn(now, li, true);
          if (b) { blocks.push(b); i++; } else misses++;
        }
      });
      return;
    }
    const short = LAYERS.map((L, li) => li).filter((li) => have[li] < quota[li]);
    if (short.length && rand() < 0.55) {             // not every frame: arrivals stay a little uneven
      const b = spawn(now, pick(short), false);
      if (b) blocks.push(b);
    }
  }

  /* ---- drawing: back layer first, the sharp front last -------------------- */
  function drawBlocks(now, shift) {
    gl.useProgram(SHAPE.p);
    gl.uniform2f(SHAPE.u.uView, W, H);
    gl.uniform1f(SHAPE.u.uShift, shift);
    gl.uniform1i(SHAPE.u.uGrid, 0);
    for (const b of blocks) {
      const z = LAYERS[b.layer].z, k = scale(z), blur = blurOf(z), sharp = blur < 0.5;
      const age = now - b.born;
      const t = Math.min(age / POP_MS, (b.life - age) / POP_MS, 1);
      if (t <= 0) continue;
      const cell = sharp ? Math.max(1 / dpr, snap(cellOf() * k)) : cellOf() * k;       // in focus = on the pixel grid
      let [x, y] = corner(b, k, now);
      if (sharp) { x = snap(x); y = snap(y); }
      const pad = cell + blur + 1;
      const col = mix(PAPER, GREYS[b.grey], t * strength(z));          // fades by blending toward the paper, as before
      gl.bindTexture(gl.TEXTURE_2D, b.tex);
      gl.uniform4f(SHAPE.u.uQuad, x - pad, y - pad, b.cols * cell + pad * 2, b.rows * cell + pad * 2);
      gl.uniform2f(SHAPE.u.uCells, b.cols + 2, b.rows + 2);
      gl.uniform2f(SHAPE.u.uOrigin, x - cell, y - cell);               // the texture has one empty cell all round
      gl.uniform1f(SHAPE.u.uCell, cell);
      gl.uniform1f(SHAPE.u.uBlur, sharp ? 0 : blur);
      gl.uniform3f(SHAPE.u.uColor, col[0], col[1], col[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  function drawBars(back, shift) {
    const z = back && P.softBars ? 1 : 0, k = scale(z), blur = blurOf(z);
    gl.useProgram(RECT.p);
    gl.uniform2f(RECT.u.uView, W, H);
    gl.uniform1f(RECT.u.uShift, shift);
    for (const bar of bars) {
      if (bar.back !== back) continue;
      const r = Math.max(blur, 0.5 / dpr), pad = r + 1;
      const col = mix(PAPER, bar.ink ? GREYS[4] : BAR, strength(z));
      let thick = Math.max(2, bar.thick * k), x, y, w, h;
      if (bar.across) {
        y = bar.pos * H - cam.y * k; x = -40; w = W + 80;
        if (blur < 0.5) { y = snap(y); thick = snap(thick); }
        h = thick;
      } else {
        x = bar.pos * W - cam.x * k; y = -40; h = H + 80;
        if (blur < 0.5) { x = snap(x); thick = snap(thick); }
        w = thick;
      }
      gl.uniform4f(RECT.u.uQuad, x - pad, y - pad, w + pad * 2, h + pad * 2);
      gl.uniform4f(RECT.u.uBox, x + w / 2, y + h / 2, w / 2, h / 2);
      gl.uniform1f(RECT.u.uBlur, r);
      gl.uniform3f(RECT.u.uColor, col[0], col[1], col[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  function paint(now, shift) {
    if (P.softBars) drawBars(true, shift);           // the soft bars sit right at the back
    drawBlocks(now, shift);                          // blocks are kept sorted back-to-front
    if (!P.softBars) drawBars(true, shift);
    drawBars(false, shift);                          // the sharp bars go on top, as before
  }

  /* glitch: unchanged from the site — when the title glitches (js/main.js
     puts .is-glitch on .hero), a few thin strips are re-drawn shoved sideways */
  const hero = document.querySelector('.hero');
  function tear(now) {
    gl.enable(gl.SCISSOR_TEST);
    for (let i = 0; i < 3; i++) {
      const sh = 6 + rand() * 30, sy = rand() * (H - sh), dx = (rand() - 0.5) * 64;
      gl.scissor(0, Math.round((H - sy - sh) * dpr), field.width, Math.round(sh * dpr));
      gl.clear(gl.COLOR_BUFFER_BIT);
      paint(now, dx);
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  let last = 0, blank = false;
  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < FRAME) return;
    const dt = Math.min(now - last, 250);
    last = now;
    if (!P.on) {                                     // switched off in the panel: clear once, then idle
      if (!blank) { gl.clear(gl.COLOR_BUFFER_BIT); blank = true; }
      return;
    }
    blank = false;

    const isNight = root.classList.contains('night');
    if (isNight !== wasNight) { wasNight = isNight; readPalette(); }
    smx += (tmx - smx) * 0.15;
    smy += (tmy - smy) * 0.15;
    cam.x = -(smx - 0.5) * SHIFT;
    cam.y = -(smy - 0.5) * SHIFT;
    for (const bar of bars) bar.pos = (bar.pos + bar.speed * P.speed * dt + 1) % 1;

    for (const b of blocks) if (now - b.born >= b.life) gl.deleteTexture(b.tex);
    blocks = blocks.filter((b) => now - b.born < b.life);
    tend(now);
    blocks.sort((a, b) => b.layer - a.layer);        // back layers first (stable: same-layer order is kept)
    P.alive = blocks.length;

    gl.clear(gl.COLOR_BUFFER_BIT);
    paint(now, 0);
    if (hero && hero.classList.contains('is-glitch')) tear(now);
  }
  requestAnimationFrame(frame);
})();
