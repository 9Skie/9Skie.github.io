/* =========================================================================
   main.js  —  menu screen + stream panel
   =========================================================================
   Renders the menu (identity, roots feed, stream tiles) and the selected
   stream's aggregate number + cards (+ dimmed archive past the OFF LIMITS
   line). Clicking a tile switches streams. Stream data lives in cards/*,
   CS star counts are fetched live from GitHub.
   ========================================================================= */

(function () {
  'use strict';

  const METRIC = {
    stars:     { glyph: '<svg width="18" height="18" viewBox="0 0 9 9" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M4 0h1v1H4zM3 1h3v1H3zM3 2h3v1H3zM0 3h9v1H0zM1 4h7v1H1zM2 5h5v1H2zM2 6h2v1H2zM5 6h2v1H5zM1 7h2v1H1zM6 7h2v1H6zM1 8h1v1H1zM7 8h1v1H7z"/></svg>', label: 'stars' },
    likes:     { glyph: '<svg width="21" height="18" viewBox="0 0 7 6" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M1 0h2v1H1zM4 0h2v1H4zM0 1h7v1H0zM0 2h7v1H0zM1 3h5v1H1zM2 4h3v1H2zM3 5h1v1H3z"/></svg>', label: 'likes' },
    views:     { glyph: '<svg width="26" height="18" viewBox="0 0 13 9" shape-rendering="crispEdges" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M4 0h5v1h2v1h1v1h1v3h-1v1h-1v1h-2v1H4V8H2V7H1V6H0V3h1V2h1V1h2V0zm2 2h1v1h1v3H7v1H6V6H5V3h1V2z"/></svg>', label: 'views' },
  };
  const ICON = {
    cs:    '<svg width="40" height="28" viewBox="0 0 16 11" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M0 0h16v1H0zM0 10h16v1H0zM0 1h1v9H0zM15 1h1v9h-1zM2 2h2v1H2zM3 3h2v1H3zM4 4h2v1H4zM3 5h2v1H3zM2 6h2v1H2zM2 8h5v1H2z"/></svg>',
    art:   '<svg width="32" height="36" viewBox="0 0 8 9" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M2 0h4v1H2zM1 1h1v1H1zM6 1h1v1H6zM1 2h1v1H1zM3 2h2v1H3zM6 2h1v1H6zM1 3h1v1H1zM3 3h2v1H3zM6 3h1v1H6zM0 4h8v1H0zM2 5h1v1H2zM5 5h1v1H5zM2 6h1v1H2zM5 6h1v1H5zM1 7h1v1H1zM6 7h1v1H6zM0 8h1v1H0zM7 8h1v1H7z"/></svg>',
    video: '<svg width="28" height="28" viewBox="0 0 7 7" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M0 0h2v1H0zM0 1h4v1H0zM0 2h6v1H0zM0 3h7v1H0zM0 4h6v1H0zM0 5h4v1H0zM0 6h2v1H0z"/></svg>',
  };

  const $  = (s, r = document) => r.querySelector(s);
  const fmt = (n) => (n || 0).toLocaleString('en-US');
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ---- card count hydration -------------------------------------------
     Counts are auto-hooked from each card's url by js/hydrate.js (live
     GitHub/YouTube fetch + baked counts from tools/sync_counts.py).
     Runs once per stream, then re-renders if that stream is still shown. */
  let currentStream = null;
  const hydrated = new Set();

  function hydrateStream(key) {
    const s = STREAMS[key];
    if (!s || !window.Hydrate) return;
    Hydrate.stream(s, () => {
      if (currentStream === key) {
        const m = METRIC[s.kind] || METRIC.stars;
        renderDeck(s.items || [], s.archive || [], m, false);
        countUp($('#agg-num'), aggregate(s));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    fillIdentity();
    renderFeed();
    renderStreams();
    setupSelector();
    setupSearch();
    selectStream('cs');          // CS active + content shown by default
    setupBlocks();
    startClock();
  }

  /* ---- boot overlay: fake terminal POST, once per session --------------- */
  function bootSequence() {
    const boot = $('#boot');
    if (!boot) return;
    if (sessionStorage.getItem('gw-booted')) { boot.remove(); return; }
    const log = $('#boot-log');
    const lines = [
      'SYS://GRAY-WORLD',
      '> LINK ............ OK',
      '> MEMORY .......... OK',
      '> RENDER .......... OK',
      '',
      'READY_',
    ];
    let i = 0;
    (function next() {
      if (i < lines.length) {
        log.textContent += lines[i++] + '\n';
        setTimeout(next, i === 1 ? 350 : 150);
      } else {
        setTimeout(() => {
          boot.remove();
          sessionStorage.setItem('gw-booted', '1');
        }, 500);
      }
    })();
  }

  /* ---- identity ---- */
  function fillIdentity() {
    document.querySelectorAll('[data-fill]').forEach((el) => {
      el.textContent = IDENTITY[el.dataset.fill] || '';
    });
  }

  /* ---- roots feed ---- */
  function renderFeed() {
    const feed = $('#feed');
    if (!feed) return;
    feed.innerHTML = ROOTS
      .map(([cat, val]) => `<dt>${esc(cat)}</dt><dd>${esc(val)}</dd>`)
      .join('');
  }

  function aggregate(stream) {
    const sum = (arr) => (arr || []).reduce((s, it) => s + (it.count || 0), 0);
    return sum(stream.items) + sum(stream.archive);
  }

  /* ---- stream tiles ---- */
  function renderStreams() {
    const list = $('#stream-list');
    if (!list) return;
    const keys = Object.keys(STREAMS);
    list.innerHTML = keys.map((key, i) => {
      const s = STREAMS[key];
      const active = i === 0 ? ' is-active' : '';
      return `
        <button class="tile${active}" data-stream="${esc(key)}" type="button">
          <span class="tile__ico">${ICON[key] || '·'}</span>
          <span class="tile__lbl">${esc(s.label)}</span>
          <span class="tile__sub">${esc(s.sub || '')}</span>
        </button>`;
    }).join('');
  }

  function setupSelector() {
    document.querySelectorAll('.tile').forEach((t) => {
      t.addEventListener('click', () => selectStream(t.dataset.stream));
    });
  }

  function setupSearch() {
    const input = $('#search');
    if (input) {
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        document.querySelectorAll('#cards .entry').forEach((entry) => {
          const titleEl = entry.querySelector('.entry__title');
          const title = titleEl ? titleEl.textContent : '';
          const tags = Array.from(entry.querySelectorAll('.card__tag'))
            .map((t) => t.textContent).join(' ');
          const hay = (title + ' ' + tags).toLowerCase();
          entry.classList.toggle('is-hidden', q !== '' && !hay.includes(q));
        });
      });
    }
    const top = $('#deck-top');
    if (top) {
      top.addEventListener('click', () => {
        const deck = $('#cards');
        if (deck) deck.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  /* ---- switch the active stream: aggregate + cards + archive ---- */
  function selectStream(key) {
    const s = STREAMS[key];
    if (!s) return;
    const changed = key !== currentStream;
    currentStream = key;
    const m = METRIC[s.kind] || METRIC.stars;

    document.querySelectorAll('.tile').forEach((t) =>
      t.classList.toggle('is-active', t.dataset.stream === key));

    const dotsEl = $('#hud-dots');
    if (dotsEl) {
      const keys = Object.keys(STREAMS);
      const idx = keys.indexOf(key);
      dotsEl.textContent = keys.map((_, i) => i === idx ? '●' : '○').join(' ');
    }

    const searchInput = $('#search');
    if (searchInput) searchInput.value = '';

    $('#agg-glyph').innerHTML = m.glyph;
    $('#agg-label').textContent = s.aggregateLabel;
    countUp($('#agg-num'), aggregate(s));

    renderDeck(s.items || [], s.archive || [], m);

    // reset the deck to the top when the stream actually changes
    if (changed) {
      const deck = $('#cards');
      if (deck) deck.scrollTop = 0;
    }

    // auto-hook counts from card urls (once per stream)
    if (!hydrated.has(key)) {
      hydrated.add(key);
      hydrateStream(key);
    }
  }

  function renderDeck(items, archiveItems, m, animate) {
    const timeline = $('#timeline');
    const archive = $('#archive');
    if (timeline) timeline.innerHTML = items.map((it) => entryHTML(it, m)).join('');
    if (archive) archive.innerHTML = archiveItems.map((it) => entryHTML(it, m)).join('');
    const hasArchive = archiveItems.length > 0;
    document.querySelectorAll('#cards > .offlimits, #cards > .archive-wrap').forEach((el) => {
      el.style.display = hasArchive ? '' : 'none';
    });

    /* staccato entrance: entries snap in one-by-one (skipped when this is
       just a background re-render after live counts arrive) */
    if (animate !== false) {
      document.querySelectorAll('#timeline .entry, #archive .entry').forEach((el, i) => {
        el.classList.add('is-entering');
        el.style.animationDelay = Math.min(i * 70, 700) + 'ms';
      });
    }
  }

  function entryHTML(it, m) {
    return `
      <div class="entry">
        <span class="rail-dot"></span>
        <div class="entry__head"><span class="entry__date">${esc(it.date)}</span> <span class="entry__dash">-</span> <span class="entry__title">${esc(it.title)}</span></div>
        ${cardHTML(it, m)}
      </div>`;
  }

  function cardHTML(it, m) {
    const tags = (it.tags || []).map((t) => `<span class="card__tag">${esc(t)}</span>`).join('');
    return `
      <article class="card">
        <div class="card__top">
          <div class="card__front"${it.cover ? ` style="background-image:url('${esc(it.cover)}')"` : ''}></div>
          <div class="card__count">
            <span class="card__count-glyph">${m.glyph}</span>
            <span class="card__count-num">${it.count == null ? '—' : fmt(it.count)}</span>
            <span class="card__count-label">${m.label}</span>
          </div>
        </div>
        <div class="card__meta">
          <div class="card__tags">${tags}</div>
          <a class="card__src" href="${esc(it.url || '#')}" target="_blank" rel="noopener">view \u2197</a>
        </div>
        <p class="card__desc">${esc(it.desc || '')}</p>
      </article>`;
  }

  /* ---- animated count-up (no library) ---- */
  function countUp(el, to) {
    if (!el) return;
    const dur = 900;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(Math.round(to * eased));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---- flat grey block field + drifting bars (background) --------------
     wowaka-style: hard-edged neutral-grey blocks and long dark bars on a
     paper field, redrawn at ~12fps on purpose (frame-skip = retro). Blocks
     pop in/out staccato (solid color blended toward the paper, never alpha);
     bars drift slowly and wrap. Every few seconds a
     short glitch burst shifts horizontal slices of the canvas sideways and
     snap-shifts the hero geometry (via .is-glitch on .title-wrap). */
  function setupBlocks() {
    const field = document.getElementById('bg-blocks');
    if (!field || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = field.getContext('2d');
    let W = 0, H = 0, dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = field.clientWidth || window.innerWidth;
      H = field.clientHeight || window.innerHeight;
      field.width = Math.round(W * dpr);
      field.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    /* parallax: every block/bar has a depth; cursor position shifts the
       layers at different rates (near = more, far = less). eased, so it
       glides. normalized 0..1, 0.5 = centered */
    let tmx = 0.5, tmy = 0.5;    // target (raw cursor)
    let smx = 0.5, smy = 0.5;    // smoothed (what we draw with)
    const SHIFT = 160;           // max px offset at depth 1
    window.addEventListener('pointermove', (e) => {
      tmx = e.clientX / W;
      tmy = e.clientY / H;
    });

    const COUNT = 14;
    const FRAME_MS = 1000 / 12;          // deliberate frame-skip
    const POP_MS = 160;                  // staccato blend at birth/death

    /* palette follows the CSS vars, so night mode flips it automatically */
    let PAPER = [233, 233, 233];
    let GREYS = ['#d4d4d4', '#c6c6c6', '#b2b2b2', '#9d9d9d'];
    let BAR_DARK = '#2e2e2e', BAR_LIGHT = '#8c8c8c';
    function readPalette() {
      const cs = getComputedStyle(document.body);
      const v = (n) => cs.getPropertyValue(n).trim();
      const n = parseInt(v('--paper').slice(1), 16);
      PAPER = [n >> 16, (n >> 8) & 255, n & 255];
      GREYS = [v('--block'), v('--line'), v('--line-2'), v('--line-3')];
      BAR_DARK = v('--ink');
      BAR_LIGHT = v('--grey');
    }
    readPalette();
    let wasNight = document.body.classList.contains('night');

    // fade = blend the solid grey toward the paper color (opaque, no alpha):
    // paper -> grey at birth, grey -> paper at death, same timing as before
    function mixGrey(hex, t) {
      const n = parseInt(hex.slice(1), 16);
      const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
      return `rgb(${Math.round(PAPER[0] + (r - PAPER[0]) * t)},`
           + `${Math.round(PAPER[1] + (g - PAPER[1]) * t)},`
           + `${Math.round(PAPER[2] + (b - PAPER[2]) * t)})`;
    }

    // a connected cluster of 1-5 rectangles -> composite shapes
    function makeParts(s) {
      const cells = [{ x: 0, y: 0 }];
      const n = 1 + ((Math.random() * 4) | 0);
      for (let i = 1; i < n; i++) {
        const b = cells[(Math.random() * cells.length) | 0];
        const c = { x: b.x, y: b.y };
        const d = (Math.random() * 4) | 0;
        c.x += d === 0 ? 1 : d === 1 ? -1 : 0;
        c.y += d === 2 ? 1 : d === 3 ? -1 : 0;
        if (!cells.some((p) => p.x === c.x && p.y === c.y)) cells.push(c);
      }
      return cells.map((c) => ({
        x: c.x * s, y: c.y * s,
        w: s * (0.7 + Math.random() * 0.6),
        h: s * (0.7 + Math.random() * 0.6),
      }));
    }

    function spawnBlock(stagger) {
      const s = 40 + Math.random() * 110;
      const dur = 4000 + Math.random() * 5000;
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        size: s,
        parts: makeParts(s),
        grey: GREYS[(Math.random() * GREYS.length) | 0],
        depth: 0.25 + Math.random() * 0.75,
        vx: (Math.random() - 0.5) * 0.03,   // px per ms
        vy: (Math.random() - 0.5) * 0.03,
        born: stagger ? performance.now() - Math.random() * dur : performance.now(),
        dur,
      };
    }

    // long bars crossing the field, like the reference composition
    const bars = [];
    for (let i = 0; i < 4; i++) {
      bars.push({
        horiz: Math.random() < 0.6,
        pos: Math.random(),                          // fraction along cross axis
        thick: 6 + Math.random() * 14,
        depth: 0.3 + Math.random() * 0.7,
        speed: (Math.random() - 0.5) * 0.00002,      // fraction per ms
        dark: Math.random() < 0.5,
      });
    }

    const blocks = [];
    for (let i = 0; i < COUNT; i++) blocks.push(spawnBlock(true));

    /* glitch bursts: rare + short (tasteful) */
    const titleWrap = document.querySelector('.title-wrap');
    let glitchUntil = 0;
    let nextGlitch = performance.now() + 3000 + Math.random() * 4000;

    function triggerGlitch(now) {
      const ms = 120 + Math.random() * 120;
      glitchUntil = now + ms;
      nextGlitch = now + 4000 + Math.random() * 6000;
      if (titleWrap) {
        titleWrap.classList.add('is-glitch');
        setTimeout(() => titleWrap.classList.remove('is-glitch'), ms);
      }
    }

    function sliceGlitch() {
      for (let i = 0; i < 3; i++) {
        const sy = Math.random() * H;
        const sh = 6 + Math.random() * 30;
        const dx = (Math.random() - 0.5) * 64;
        ctx.drawImage(field,
          0, sy * dpr, field.width, sh * dpr,   // source (device px)
          dx, sy, W, sh);                        // dest (css px, transformed)
      }
    }

    let last = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      const dt = now - last;
      last = now;

      const isNight = document.body.classList.contains('night');
      if (isNight !== wasNight) { wasNight = isNight; readPalette(); }

      if (now >= nextGlitch) triggerGlitch(now);

      // ease the parallax offsets toward the cursor
      smx += (tmx - smx) * 0.15;
      smy += (tmy - smy) * 0.15;

      ctx.clearRect(0, 0, W, H);

      // blocks (solid grey, blended toward the paper at birth/death)
      for (let i = 0; i < blocks.length; i++) {
        let b = blocks[i];
        const age = now - b.born;
        if (age >= b.dur) { blocks[i] = b = spawnBlock(false); continue; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        const t = Math.min(age / POP_MS, (b.dur - age) / POP_MS, 1);
        if (t <= 0) continue;
        const ox = (smx - 0.5) * SHIFT * b.depth;
        const oy = (smy - 0.5) * SHIFT * b.depth;
        ctx.fillStyle = mixGrey(b.grey, t);
        for (let j = 0; j < b.parts.length; j++) {
          const p = b.parts[j];
          ctx.fillRect(b.x + p.x + ox, b.y + p.y + oy, p.w, p.h);
        }
      }

      // bars (over blocks, like the reference)
      for (const bar of bars) {
        bar.pos = (bar.pos + bar.speed * dt + 1) % 1;
        ctx.fillStyle = bar.dark ? BAR_DARK : BAR_LIGHT;
        if (bar.horiz) ctx.fillRect(-20, bar.pos * H + (smy - 0.5) * SHIFT * bar.depth, W + 40, bar.thick);
        else ctx.fillRect(bar.pos * W + (smx - 0.5) * SHIFT * bar.depth, -20, bar.thick, H + 40);
      }

      if (now < glitchUntil) sliceGlitch();
    }
    requestAnimationFrame(frame);
  }

  const ICON_SUN = '<svg width="14" height="14" viewBox="0 0 7 7" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M3 0h1v1H3zM1 1h1v1H1zM3 1h1v1H3zM5 1h1v1H5zM2 2h3v1H2zM0 3h7v1H0zM2 4h3v1H2zM1 5h1v1H1zM3 5h1v1H3zM5 5h1v1H5zM3 6h1v1H3z"/></svg>';
  const ICON_MOON = '<svg width="12" height="12" viewBox="0 0 6 6" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M2 0h3v1H2zM1 1h2v1H1zM0 2h2v1H0zM0 3h2v1H0zM1 4h2v1H1zM2 5h3v1H2z"/></svg>';

  function startClock() {
    /* night mode: manual toggle (saved) wins; otherwise auto 20:00–07:00 */
    const btn = $('#night-toggle');
    const applyNight = () => {
      const saved = localStorage.getItem('gw-theme');
      const h = new Date().getHours();
      const night = saved ? saved === 'night' : h >= 20 || h < 7;
      document.body.classList.toggle('night', night);
      if (btn) btn.innerHTML = night ? ICON_SUN : ICON_MOON;
    };
    if (btn) btn.addEventListener('click', () => {
      localStorage.setItem('gw-theme', document.body.classList.contains('night') ? 'day' : 'night');
      applyNight();
    });
    applyNight();

    const el = $('#hud-clock');
    if (!el) return;
    const tick = () => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      el.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
      applyNight();
    };
    tick();
    setInterval(tick, 1000);
  }
})();
