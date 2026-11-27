/* =========================================================================
   look.js  —  the small page changes the site's look needs
   =========================================================================
   The look was settled on the test page (lab.html, which stays on my
   computer) and lives in css/look.css, switched on by the classes on
   <html> in index.html. This file does the few things CSS cannot:

     - falls back to the flat background when the depth one cannot run
     - keeps the page in day mode (no night mode)
     - says which count icon the selected stream uses (star / heart / eye)
     - small markup changes: the CGI row, the bio's first sentence,
       pixel-drawn HUD marks, and which section's cursor blinks

   Loaded after js/main.js and js/field.js.
   ========================================================================= */

(function () {
  'use strict';

  const root = document.documentElement;

  /* ---- depth background (js/field.js), or the flat one if it cannot run ---- */
  const F = window.DepthField;
  if (!F || F.failed) root.classList.remove('bg-depth');

  /* ---- always day ----------------------------------------------------------
     js/main.js still puts a "night" class on <html> after 20:00 or when an
     old visit saved night mode. It is taken straight back off, before the
     page paints, and the tile objects are told to use the day colours. */
  function keepDay() {
    if (!root.classList.contains('night')) return;
    root.classList.remove('night');
    document.dispatchEvent(new CustomEvent('gw:theme', { detail: 'day' }));
  }
  new MutationObserver(keepDay).observe(root, { attributes: true, attributeFilter: ['class'] });
  keepDay();

  /* ---- which count icon is showing (star / heart / eye) ---------------------- */
  const kindOf = (key) => (window.STREAMS && window.STREAMS[key] && window.STREAMS[key].kind) || 'stars';
  document.addEventListener('gw:stream', (e) => { root.dataset.kind = kindOf(e.detail); });

  /* ---- small markup changes, once js/main.js has filled the page ---------- */
  function prepare() {
    // the icon of whichever stream is already selected
    const active = document.querySelector('.tile.is-active');
    root.dataset.kind = kindOf(active ? active.dataset.stream : 'cs');

    // fx-nocgi: mark the CGI row of the What I Love list, so look.css can take it out
    for (const dt of document.querySelectorAll('#feed dt')) {
      if (dt.textContent.trim().toUpperCase() !== 'CGI') continue;
      dt.classList.add('row-cgi');
      if (dt.nextElementSibling) dt.nextElementSibling.classList.add('row-cgi');
    }

    // fx-type: the bio becomes paragraphs, so the first can be the larger one
    const bio = document.querySelector('[data-fill="bio"]');
    if (bio && bio.parentNode) {
      const parts = bio.textContent.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
      if (parts.length > 1) {
        bio.textContent = parts[0];
        bio.classList.add('lead');
        let after = bio;
        for (const text of parts.slice(1)) {
          const p = document.createElement('p');
          p.textContent = text;
          after.after(p);
          after = p;
        }
      }
    }

    // fx-icons: the HUD's leading ▌ gets its own element
    const sys = document.querySelector('.hud--top .hud__l');
    if (sys && sys.textContent.charAt(0) === '▌') {
      const rest = sys.textContent.slice(1);
      sys.textContent = '';
      const bar = document.createElement('span');
      bar.className = 'g-bar';
      bar.textContent = '▌';
      sys.append(bar, rest);
    }

    // fx-icons: ● ○ ○ in the bottom HUD is mirrored as three square pips
    const dots = document.getElementById('hud-dots');
    if (dots) {
      const pips = document.createElement('span');
      pips.id = 'hud-pips';
      pips.className = 'hud__c';
      dots.after(pips);
      const mirror = () => {
        pips.innerHTML = dots.textContent.trim().split(/\s+/).map((c) => `<i class="pip${c === '●' ? ' is-on' : ''}"></i>`).join('');
      };
      mirror();
      new MutationObserver(mirror).observe(dots, { childList: true, characterData: true, subtree: true });
    }

    // fx-calm: mark the part of the page being read; only its cursor blinks
    const stops = [document.querySelector('.hero'), ...document.querySelectorAll('.page > .block')].filter(Boolean);
    let queued = false;
    const mark = () => {
      queued = false;
      const line = window.innerHeight * 0.45;
      let live = stops[0];
      for (const el of stops) if (el.getBoundingClientRect().top <= line) live = el;
      for (const el of stops) el.classList.toggle('is-live', el === live);
    };
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(mark); } }, { passive: true });
    window.addEventListener('resize', mark);
    mark();
  }

  // js/main.js fills the page on DOMContentLoaded; this listener is added after its own, so it runs after
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepare);
  else prepare();
})();
