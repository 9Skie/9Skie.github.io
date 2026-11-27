/* =========================================================================
   objects.js  —  the low-poly objects on the stream tiles
   =========================================================================
   The models come from assets/models/grayworld.glb (built in Blender by
   tools/build_models.py): one named object per tile, see MODEL in main.js.

   One hidden WebGL canvas renders whichever object needs a new pose, then
   the picture is copied into that tile's own small canvas — so the tiles
   scroll with the page like any image, and there is only one 3D context.

   The look: flat facets, each a single grey taken between --paper and
   --ink (read from the CSS, so night mode flips them for free), stepped
   into a few levels, with a hard ink outline.

   Movement: an unselected object rests still. When its tile is selected it
   does one fast full turn, then keeps turning slowly. Poses change at 12
   steps a second on purpose.

   Loaded by js/main.js after the page is up. If this file, three.js or
   WebGL fails, the tiles simply keep their flat pixel icons.
   ========================================================================= */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---- knobs ---------------------------------------------------------------- */
const FPS    = 12;        // pose steps per second (stop-motion on purpose)
const LEVELS = 9;         // how many flat greys between paper and ink
const SIZE   = 320;       // render size of one object, device px
const REST   = -0.5;      // an unselected object's resting three-quarter view, radians
const TURN   = 0.45;      // how fast the selected object turns, radians per second (a full turn in ~14s)
const MODELS = 'assets/models/grayworld.glb?v=3';

const root = document.documentElement;
const CALM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =========================================================================
   the look: one flat shader
   A face's painted grey is its TONE: 0 = paper, 1 = ink (the models are
   painted in day-mode greys by tools/build_models.py).
   ========================================================================= */
const VERT = /* glsl */`
  attribute vec3 color;        // the face's painted grey (linear), same on its 3 corners
  varying vec3 vView;
  varying vec3 vPaint;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = mv.xyz;
    vPaint = color;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  uniform vec3 uPaper;         // the page colour (sRGB)
  uniform vec3 uInk;           // the text colour (sRGB)
  uniform float uLumDir;       // -1 when ink is darker than paper (day), +1 at night
  uniform vec3 uLight;         // light direction, in view space
  uniform float uLevels;
  uniform float uContrast;     // how much the light moves the grey
  varying vec3 vView;
  varying vec3 vPaint;

  void main() {
    // one normal per triangle = flat shading, whatever the model's own normals say
    vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
    float lit = 0.5 + 0.5 * dot(n, uLight);

    vec3 srgb = mix(vPaint * 12.92, 1.055 * pow(max(vPaint, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, vPaint));
    float tone = clamp((0.914 - dot(srgb, vec3(0.299, 0.587, 0.114))) / 0.808, 0.0, 1.0);

    // lit faces get brighter in both themes: toward paper by day, toward ink by night
    float k = clamp(tone + uLumDir * (lit - 0.5) * uContrast, 0.0, 1.0);
    k = floor(k * uLevels + 0.5) / uLevels;                 // snap to a few flat greys

    gl_FragColor = vec4(mix(uPaper, uInk, k), 1.0);
  }
`;

/* theme: re-read whenever day/night flips */
const theme = {
  uPaper:  { value: new THREE.Vector3(0.914, 0.914, 0.914) },
  uInk:    { value: new THREE.Vector3(0.106, 0.106, 0.106) },
  uLumDir: { value: -1 },
};
let inkCss = '#1b1b1b';

function readTheme() {
  const css = getComputedStyle(root);
  const hex = (name, v) => {
    const n = parseInt(css.getPropertyValue(name).trim().slice(1), 16);
    if (!Number.isNaN(n)) v.set((n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  };
  hex('--paper', theme.uPaper.value);
  hex('--ink', theme.uInk.value);
  theme.uLumDir.value = theme.uInk.value.x > theme.uPaper.value.x ? 1 : -1;
  inkCss = css.getPropertyValue('--ink').trim() || inkCss;
}

/* make a loaded model shadeable: separate triangles, and a grey per face
   (plain paper if the model was exported without colours) */
function facet(source) {
  const geo = source.index ? source.toNonIndexed() : source;
  if (!geo.attributes.color) {
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
  }
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  return geo;
}

/* =========================================================================
   the tiles
   ========================================================================= */
function startTiles(models) {
  const canvases = [...document.querySelectorAll('canvas[data-model]')].filter((c) => models[c.dataset.model]);
  if (!canvases.length) return;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);        // see-through around the object
  const gl = renderer.domElement;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
  camera.position.set(0, 1.1, 5.8);
  camera.lookAt(0, 0, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...theme,
      uLight: { value: new THREE.Vector3(-0.5, 0.7, 0.5).normalize() },
      uLevels: { value: LEVELS },
      uContrast: { value: 0.5 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });

  // the object's outline: its own silhouette in ink, stamped around it
  const mask = document.createElement('canvas');
  mask.width = mask.height = SIZE;
  const maskCtx = mask.getContext('2d');
  const AROUND = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

  let clock = 0, stamp = 0;                   // stamp changes whenever every tile must redraw
  const tiles = canvases.map((canvas) => {
    const mesh = new THREE.Mesh(models[canvas.dataset.model], material);
    mesh.visible = false;
    scene.add(mesh);
    const button = canvas.closest('.tile');
    const tile = { canvas, ctx: canvas.getContext('2d'), mesh, button, hover: false, spunAt: -1e9, drawn: '' };
    if (button) {
      button.addEventListener('pointerenter', () => { tile.hover = true; stamp++; });
      button.addEventListener('pointerleave', () => { tile.hover = false; stamp++; });
    }
    return tile;
  });

  // only redraw while the tiles are actually on screen
  let onScreen = true;
  const list = canvases[0].closest('.select__list');
  if (list && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1].isIntersecting;
      if (onScreen) stamp++;
    }).observe(list);
  }

  document.addEventListener('gw:stream', (e) => {
    for (const tile of tiles) if (tile.button && tile.button.dataset.stream === e.detail) tile.spunAt = clock;
    stamp++;
  });
  document.addEventListener('gw:theme', () => { stamp++; });

  function pose(tile) {
    const active = !!tile.button && tile.button.classList.contains('is-active');
    let yaw = REST;
    if (active) {
      const since = Math.max(0, clock - Math.max(tile.spunAt, 0));   // seconds since it was selected
      yaw = REST + since * TURN;                            // selected: it just keeps turning slowly...
      if (since < 0.75) yaw += Math.pow(1 - since / 0.75, 2) * Math.PI * 2;   // ...after one snappy full turn
    } else if (tile.hover) {
      yaw = 0.15;
    }
    return { yaw, size: active || tile.hover ? 1.06 : 0.96 };
  }

  function draw() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    for (const tile of tiles) {
      const px = Math.round(tile.canvas.clientWidth * ratio);
      if (!px) continue;                                    // not laid out
      const { yaw, size } = pose(tile);
      const key = `${yaw.toFixed(3)}|${size}|${px}|${stamp}`;
      if (key === tile.drawn) continue;
      tile.drawn = key;
      if (tile.canvas.width !== px) { tile.canvas.width = px; tile.canvas.height = px; }

      tile.mesh.visible = true;
      tile.mesh.rotation.y = yaw;
      tile.mesh.scale.setScalar(size);
      renderer.render(scene, camera);
      tile.mesh.visible = false;

      maskCtx.globalCompositeOperation = 'copy';
      maskCtx.drawImage(gl, 0, 0);
      maskCtx.globalCompositeOperation = 'source-in';
      maskCtx.fillStyle = inkCss;
      maskCtx.fillRect(0, 0, SIZE, SIZE);

      const line = 1.5 * ratio;
      tile.ctx.clearRect(0, 0, px, px);
      for (const [dx, dy] of AROUND) tile.ctx.drawImage(mask, dx * line, dy * line, px, px);
      tile.ctx.drawImage(gl, 0, 0, px, px);
    }
  }

  let lastTick = -1, lastStamp = -1;
  (function frame(now) {
    requestAnimationFrame(frame);
    if (!onScreen) return;
    const tick = CALM ? 0 : Math.floor(now / (1000 / FPS));
    if (tick === lastTick && stamp === lastStamp) return;
    lastTick = tick; lastStamp = stamp;
    clock = tick / FPS;
    draw();
  })(performance.now());
}

/* =========================================================================
   go
   ========================================================================= */
readTheme();
document.addEventListener('gw:theme', readTheme);     // registered first, so it runs before the redraws

new GLTFLoader().loadAsync(MODELS).then((gltf) => {
  const models = {};
  gltf.scene.traverse((o) => { if (o.isMesh) models[o.name] = facet(o.geometry); });
  root.classList.add('has-models');           // swaps the flat icons for the canvases
  try {
    startTiles(models);
  } catch (err) {
    root.classList.remove('has-models');      // back to the flat icons
    throw err;
  }
}).catch((err) => console.warn('[gray world] 3D objects did not load:', err));
