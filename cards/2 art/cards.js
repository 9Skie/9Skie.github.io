/* =========================================================================
   ART stream  —  illustrations (source: Pixiv)
   -------------------------------------------------------------------------
   The cards are my real Pixiv artworks, pulled once a day by
   tools/sync_data.py (see cards/live.js), with their bookmark counts.
   While the account has no public works this stream is simply empty.

   Pixiv only knows when an artwork was UPLOADED. For a piece moved over
   from somewhere else, that is not when I made it: say so in `notes`
   below, one line per artwork, its Pixiv link first.

       "https://www.pixiv.net/artworks/123456789": { made: "2023-05" },

   js/card.js lists everything a note can say (made, archive, hide, title,
   desc, tags, cover).

   Older pieces, made before this site synced with Pixiv, are written by
   hand in `archive` (below the OFF LIMITS line) with the date I really
   made them. A hand-written card whose url is its Pixiv page is the one
   shown, and it still gets its like count from Pixiv every day. A new
   piece that is not on Pixiv at all goes in `items`, written the same
   way. Cover images go in ./images/.

       card({
         date:  "2025-03",
         title: "artwork name",
         desc:  "one line about it",
         tags:  ["study", "greyscale"],
         cover: "cards/2 art/images/artwork.png",   // optional
         url:   "https://example.com/artwork",
         count: 0,                                  // optional (likes)
       }),
   ========================================================================= */

window.STREAMS.art = liveStream("art", {
  label: "Art",
  sub: "Pixiv",
  kind: "likes",
  aggregateLabel: "total likes across works",

  // everything uploaded before the daily sync began sits below the OFF LIMITS line
  archiveBefore: "2026-11-26",

  notes: {
  },

  // new pieces that are not on Pixiv, written by hand
  items: [],

  // older pieces, written by hand: they sit below the OFF LIMITS line.
  // Moved over from ArtStation to Pixiv on 2026-11-26; `date` is when I really
  // made each one. Their url is their Pixiv page, so the like count still
  // comes from Pixiv every day.
  archive: [
    card({
      date:  "2025-08",
      title: "The Persistence of A Little Man",
      desc:  "I had once screamed, gradually, I lost my voice.",
      tags:  ["蛊真人", "reverendinsanity", "古月方源"],
      cover: "cards/2 art/images/the-persistence-of-a-little-man.jpg",
      url:   "https://www.pixiv.net/artworks/152535255",
    }),
    card({
      date:  "2025-06",
      title: "Every world",
      desc:  "Infinite desires, finite resources.",
      tags:  ["original"],
      cover: "cards/2 art/images/every-world.jpg",
      url:   "https://www.pixiv.net/artworks/152535200",
    }),
    card({
      date:  "2024-10",
      title: "Heathcliff, Salvation",
      desc:  "Wound answers wound, shadow follows shadow, lay down the weight of yesterday, and only then can we finally wa…",
      tags:  ["projectmoon", "limbuscompany", "limbus_company"],
      cover: "cards/2 art/images/heathcliff-salvation.jpg",
      url:   "https://www.pixiv.net/artworks/152535146",
    }),
    card({
      date:  "2024-04",
      title: "Heathcliff, Rain of Tears",
      desc:  "I’ll show you how much it hurts to have ragged broken ribs from a dumped umbrella jammed in you.",
      tags:  ["projectmoon", "limbuscompany", "limbus_company"],
      cover: "cards/2 art/images/heathcliff-rain-of-tears.jpg",
      url:   "https://www.pixiv.net/artworks/152535054",
    }),
    card({
      date:  "2023-07",
      title: "Dongrang, The Farmlands",
      desc:  "Please die, little dreams,",
      tags:  ["projectmoon", "limbus_company", "limbuscompany"],
      cover: "cards/2 art/images/dongrang-the-farmlands.jpg",
      url:   "https://www.pixiv.net/artworks/152534966",
    }),
    card({
      date:  "2023-05",
      title: "Angela, The Library of Bable",
      desc:  "So what if one day, all the knowledge in the world is exhausted, and the monkey types out Shakespeare's plays?",
      tags:  ["projectmoon", "library_of_ruina", "libraryofruina,"],
      cover: "cards/2 art/images/angela-the-library-of-bable.jpg",
      url:   "https://www.pixiv.net/artworks/152534724",
    }),
    card({
      date:  "2023-02",
      title: "Yan, Children of the City",
      desc:  "Children of the city see only the neon stars,",
      tags:  ["projectmoon", "library_of_ruina", "libraryofruina,"],
      cover: "cards/2 art/images/yan-children-of-the-city.jpg",
      url:   "https://www.pixiv.net/artworks/152534662",
    }),
    card({
      date:  "2023-01",
      title: "Philip, Son of Dawn",
      desc:  "The first full drawing that I've ever made completely.",
      tags:  ["projectmoon", "library_of_ruina", "libraryofruina,"],
      cover: "cards/2 art/images/philip-son-of-dawn.jpg",
      url:   "https://www.pixiv.net/artworks/152534391",
    }),
  ],
});
