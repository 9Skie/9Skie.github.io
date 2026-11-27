/* =========================================================================
   data.js  —  identity + roots
   =========================================================================
   Page-level personalization only. Per-stream card data has moved into
   modular files:
       cards/1 cs/cards.js
       cards/2 art/cards.js
       cards/3 videos/cards.js

   Each builds window.STREAMS.<key>. The card() factory they share lives
   in js/card.js.
   ========================================================================= */

/* -------------------------------------------------------------------------
   IDENTITY
   ------------------------------------------------------------------------- */
const IDENTITY = {
  name: "9skie",   // shown in the intro "hi, I'm ___"
  handle: "9skie", // @handle in footer
  github: "9skie", // GitHub username — drives the LIVE CS stream
  bio: "I’m interested in three distinct directions: AI infrastructure, anime art, and educational videos.\n\nI’m trying to break out of student syndrome by converting theoretical knowledge into visible output.",
};

/* -------------------------------------------------------------------------
   ROOTS / INFLUENCES  (the origin story on the landing page)
   Each row: category label -> the names that shaped you.
   ------------------------------------------------------------------------- */
const ROOTS = [
  ["Music", "Wowaka, Mili"],
  ["Vocaloid", "初音ミク, 洛天依"],
  ["Artists", "Rella, Suke"],
  ["Games", "Library of Ruina, Limbus Company"],
  ["Creators", "3Blue1Brown, Welch Labs"],
  ["AI", "ChatGPT, Stable Diffusion"],
  ["CGI", "countless works"],
];

/* expose to other scripts (STREAMS is assembled by the cards/<stream>/cards.js files) */
window.IDENTITY = IDENTITY;
window.ROOTS = ROOTS;
window.STREAMS = {};
