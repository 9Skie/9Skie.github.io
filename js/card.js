/* =========================================================================
   card.js  —  shared card factory
   =========================================================================
   Used by every cards/<stream>/cards.js. Keeps card shape consistent and
   gives every field a sane default.

     card({
       date:  "2025",
       title: "project name",
       desc:  "one line about it",
       tags:  ["js", "webgl"],
       cover: "cards/1 cs/images/cover.gif",   // optional image/gif for the front
       url:   "https://github.com/9skie/repo",
       count: 1234,                          // optional; auto-fetched later
     })
   ========================================================================= */

function card({ date, title, desc = "", tags = [], url = "#", cover = "", count }) {
  return { date, title, desc, tags, url, cover, count: count ?? null };
}

/* -------------------------------------------------------------------------
   liveStream("cs" | "art" | "video", { …the stream… })
   Fills a stream with my real works. They are pulled from my accounts once
   a day by tools/sync_data.py into cards/live.js (window.LIVE); this turns
   them into cards and puts them, newest first, together with any cards
   written by hand in the stream's own file.

   The accounts only know when something was UPLOADED, and nothing about
   what I think of it. The stream's `notes` say the rest, one line per work
   that needs it. The line starts with the work's link (copied from the
   browser is fine), then any of:

       made:    "2023-05"    when I really made it; also "2023" or "~2022, maybe?"
       archive: true         put it below the OFF LIMITS line
       hide:    true         leave it off the site
       noCard:  "special"    no card, but its number still counts, shown as its own
                             part of the sum (here "special") once it is above 0
       title:   "…"          say it differently than the account does
       desc:    "…"
       tags:    ["…", "…"]
       cover:   "cards/…"    a picture of my own choosing
       pair:    "<link>"     this is the same video as that one on the other site (see pair below)
       pair:    false        never pair this one with anything

   A work with no note simply shows what its account says.

   The big total can be shown as a sum, "4 = 1 projects + 3 courses":
       splitBy: "group"                    what tells the parts apart ("group" or "source")
       parts:   ["projects", "courses"]    the parts, in the order to show them
       offPage: ["courses"]                parts that count toward the total but get no cards

   archiveBefore: "2026-11-26" sends everything uploaded before that day below
   the OFF LIMITS line: the works from before the daily sync existed. A note
   with archive: false keeps one above the line.

   pair: { sources: ["youtube", "bilibili"], hours: 24 } — the same video
   posted on both sites becomes ONE card: an upload on the first site and one
   on the second that went up within `hours` of each other are a pair (each
   pairs with at most one, the closest in time first). The card takes the
   first site's title, text and picture, adds the two numbers together, and
   links to both. Each number still goes to its own side of the big sum.
   Only works from archiveBefore on are paired; older ones are written by hand.

   Older works can also be written out in full as a card by hand, in the
   stream's `items`. If the card's url is the work's link, that card is the
   one shown — the automatic one steps aside, so nothing appears twice —
   and it still gets its real, daily number from the account.
   ------------------------------------------------------------------------- */

/* any way of writing a work's link -> one name for that work */
function workKey(link) {
  const text = String(link || "").trim();
  let m;
  if ((m = text.match(/github\.com\/[^/\s]+\/([^/?#\s]+)/i))) return "github:" + m[1].toLowerCase();
  if ((m = text.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{6,})/i))) return "youtube:" + m[1];
  if ((m = text.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+)/i))) return "bilibili:" + m[1];
  if ((m = text.match(/pixiv\.net\/(?:[a-z]{2}\/)?artworks\/(\d+)/i))) return "pixiv:" + m[1];
  return text.replace(/\/+$/, "").toLowerCase();
}

/* "2024-05", "2024", "2024-05-19T…", "~2022, maybe?" -> something to put in order */
function dateOrder(text) {
  const m = String(text || "").match(/(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
  return m ? m[1] + String(m[2] || 0).padStart(2, "0") + String(m[3] || 0).padStart(2, "0") : "00000000";
}

/* the same video on two sites -> one work (see `pair` above) */
function pairUp(live, def, notes) {
  const [main, other] = def.pair.sources;
  const within = (def.pair.hours || 24) * 3600 * 1000;
  const by = def.splitBy || "source";
  const time = (w) => Date.parse(w.when || w.date) || 0;
  const noteOf = (w) => notes[workKey(w.url)] || {};
  const recent = (w) => !def.archiveBefore || dateOrder(w.when || w.date) >= dateOrder(def.archiveBefore);
  const A = live.filter((w) => w[by] === main && recent(w));
  const B = live.filter((w) => w[by] === other && recent(w));
  const used = new Set(), pairs = [];
  const take = (a, b) => { if (!used.has(a) && !used.has(b)) { pairs.push([a, b]); used.add(a); used.add(b); } };

  // pinned by hand: a note pair: "<link of the other one>", on either of the two
  for (const a of A) for (const b of B) {
    const pa = noteOf(a).pair, pb = noteOf(b).pair;
    if ((typeof pa === "string" && workKey(pa) === workKey(b.url)) ||
        (typeof pb === "string" && workKey(pb) === workKey(a.url))) take(a, b);
  }
  // the rest: uploads close together in time, closest first
  const auto = (w) => !used.has(w) && noteOf(w).pair === undefined;
  const options = [];
  for (const a of A) for (const b of B) {
    if (!auto(a) || !auto(b)) continue;
    const gap = Math.abs(time(a) - time(b));
    if (gap <= within) options.push([gap, a, b]);
  }
  options.sort((x, y) => x[0] - y[0]);
  for (const [, a, b] of options) take(a, b);
  if (!pairs.length) return live;

  const merged = pairs.map(([a, b]) => ({
    ...a,
    cover: a.cover || b.cover,
    tags: [...new Set([...(a.tags || []), ...(b.tags || [])])],
    count: (a.count || 0) + (b.count || 0),
    counts: { [main]: a.count || 0, [other]: b.count || 0 },
    links: [{ label: main, url: a.url }, { label: other, url: b.url }],
    also: b.url,
  }));
  // back in upload order, newest first (same-day cards keep their exact order)
  return live.filter((w) => !used.has(w)).concat(merged).sort((x, y) => time(y) - time(x));
}

function liveStream(stream, def) {
  const notes = {};
  for (const [link, note] of Object.entries(def.notes || {})) notes[workKey(link)] = note || {};
  let live = window.LIVE && Array.isArray(window.LIVE[stream]) ? window.LIVE[stream] : [];
  if (def.pair) live = pairUp(live, def, notes);
  // a merged work answers to either of its two links
  const noteFor = (w) => notes[workKey(w.url)] || (w.also && notes[workKey(w.also)]) || null;
  const items = [], archive = [], off = {};

  // a card written by hand for a work the accounts also list: mine is the one shown
  // (so it never appears twice), and it still gets its real number from the account
  const byHand = {};
  for (const c of [...(def.items || []), ...(def.archive || [])]) byHand[workKey(c.url)] = c;

  for (const work of live) {
    const part = def.splitBy ? work[def.splitBy] : null;
    if (part && (def.offPage || []).includes(part)) {          // counted in the total, not shown as a card
      off[part] = (off[part] || 0) + (work.count || 0);
      continue;
    }
    const quiet = (noteFor(work) || {}).noCard;
    if (quiet) {                                                // counted in the total, no card
      const k = typeof quiet === "string" ? quiet : "other";
      off[k] = (off[k] || 0) + (work.count || 0);
      continue;
    }
    const mine = byHand[workKey(work.url)] || (work.also && byHand[workKey(work.also)]);
    if (mine) {
      mine.part = part;
      mine.count = work.count;
      if (work.counts) { mine.counts = work.counts; mine.links = work.links; }
      if (!mine.cover) mine.cover = work.cover;
      continue;
    }
    const note = noteFor(work) || {};
    if (note.hide) continue;
    const c = card({
      date:  note.made  || work.date,
      title: note.title || work.title,
      desc:  note.desc  ?? work.desc,
      tags:  note.tags  || work.tags,
      cover: note.cover || work.cover,
      url:   work.url,
      count: work.count,
    });
    c.part = part;
    if (work.counts) { c.counts = work.counts; c.links = work.links; }
    c.order = dateOrder(note.made || work.when || work.date);
    // uploaded before the daily sync existed: it belongs below the OFF LIMITS line, unless a note says otherwise
    const early = !!def.archiveBefore && dateOrder(work.when || work.date) < dateOrder(def.archiveBefore);
    ((note.archive ?? (work.archive || early)) ? archive : items).push(c);
  }
  for (const c of def.items || [])   { c.order = dateOrder(c.date); items.push(c); }
  for (const c of def.archive || []) { c.order = dateOrder(c.date); archive.push(c); }

  const newestFirst = (a, b) => (a.order < b.order ? 1 : a.order > b.order ? -1 : 0);
  return { ...def, items: items.sort(newestFirst), archive: archive.sort(newestFirst), offPageCounts: off };
}
