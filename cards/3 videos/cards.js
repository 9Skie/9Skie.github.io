/* =========================================================================
   VIDEO stream  —  motion work (source: Bilibili / YouTube)
   -------------------------------------------------------------------------
   The cards are my real videos from both sites, pulled once a day by
   tools/sync_data.py (see cards/live.js), with their view counts and
   thumbnails (saved into ./images/live/).

   A video that is only on YouTube, or only on Bilibili, needs nothing
   special: every video shows once, tagged with the site it is on, and the
   big number adds the views from both sites together.

   Both sites only know when a video was UPLOADED. Where that is not when
   I made it, say so in `notes` below: take the // off the front of its
   line and put in the real date. js/card.js lists everything a note can
   say (made, archive, hide, title, desc, tags, cover).

   For a video that is on neither site, write a card by hand in `items`.
   Cover images/gifs go in ./images/.

       card({
         date:  "2025-04",
         title: "video title",
         desc:  "one line about it",
         tags:  ["tutorial", "webgl"],
         cover: "cards/3 videos/images/thumb.gif",   // optional
         url:   "https://example.com/video",
         count: 0,                                   // optional (views)
       }),
   ========================================================================= */

window.STREAMS.video = liveStream("video", {
  label: "Video",
  sub: "Bilibili / YouTube",
  kind: "views",
  aggregateLabel: "total views across videos",

  // the total is shown as YouTube + Bilibili
  splitBy: "source",
  parts: ["youtube", "bilibili"],

  // the same video posted on both sites the same day is one card, with both
  // view counts added and a link to each (js/card.js explains "pair")
  pair: { sources: ["youtube", "bilibili"], hours: 24 },

  // everything uploaded before the daily sync began sits below the OFF LIMITS line
  archiveBefore: "2026-11-26",

  notes: {
  },

  // cards written by hand, for videos that are on neither site
  items: [],

  // older videos, written by hand: they sit below the OFF LIMITS line.
  // Everything here is fixed; only the number (views / likes / stars) comes
  // in live every day, matched by the url.
  archive: [
    card({
      date:  "2025-04",
      title: "AI Week 6 (How ChatGPT came to be, and the future of AI?)",
      desc:  "This is a series of videos explaining the basics of AI's that I made for my high school club.",
      tags:  ["youtube"],
      cover: "cards/3 videos/images/youtube-oM_RziiG4gQ.jpg",
      url:   "https://www.youtube.com/watch?v=oM_RziiG4gQ",
    }),
    card({
      date:  "2025-04",
      title: "AI Week 5 (The evolution of Neural Networks in NLP)",
      desc:  "This is a series of videos explaining the basics of AI's that I made for my high school club.",
      tags:  ["youtube"],
      cover: "cards/3 videos/images/youtube-YhcTiMplEwY.jpg",
      url:   "https://www.youtube.com/watch?v=YhcTiMplEwY",
    }),
    card({
      date:  "2025-04",
      title: "AI Week 4 (Intro to Natural Language Processing)",
      desc:  "This is a series of videos explaining the basics of AI's that I made for my high school club.",
      tags:  ["youtube"],
      cover: "cards/3 videos/images/youtube-tj-t2dYNZcM.jpg",
      url:   "https://www.youtube.com/watch?v=tj-t2dYNZcM",
    }),
    card({
      date:  "2025-04",
      title: "AI Week 3 (How do neural networks learn? Gradient Descent)",
      desc:  "This is a series of videos explaining the basics of AI's that I made for my high school club.",
      tags:  ["youtube"],
      cover: "cards/3 videos/images/youtube-T3U-wrbCPXM.jpg",
      url:   "https://www.youtube.com/watch?v=T3U-wrbCPXM",
    }),
    card({
      date:  "2025-04",
      title: "AI Week 2 (How do neural networks learn? Backpropagation)",
      desc:  "This is a series of videos explaining the basics of AI's that I made for my high school club.",
      tags:  ["youtube"],
      cover: "cards/3 videos/images/youtube-lIxkvpowBcQ.jpg",
      url:   "https://www.youtube.com/watch?v=lIxkvpowBcQ",
    }),
    card({
      date:  "2025-04",
      title: "AI Week 1 (What is a neural network?)",
      desc:  "This is a series of videos explaining the basics of AI's that I made for my high school club.",
      tags:  ["youtube"],
      cover: "cards/3 videos/images/youtube-Sr3auABzycY.jpg",
      url:   "https://www.youtube.com/watch?v=Sr3auABzycY",
    }),
    card({
      date:  "2023-11",
      title: "学习如何学习",
      desc:  "接下来就一步一步创造那个未来吧",
      tags:  ["bilibili"],
      cover: "cards/3 videos/images/bilibili-BV1Pb4y1M74j.jpg",
      url:   "https://www.bilibili.com/video/BV1Pb4y1M74j",
    }),
    card({
      date:  "2022-11",
      title: "一个Oneshot的同人小游戏",
      desc:  "这个原本是跟着一个油管pygame教程（https://youtu.be/AY9MnQ4x3zk）做的新手跑酷游戏，然而我突然联想到了Oneshot里面的城市于是就把所有的美术与音乐替换成了相关的资源。",
      tags:  ["bilibili"],
      cover: "cards/3 videos/images/bilibili-BV1e24y1f7tA.jpg",
      url:   "https://www.bilibili.com/video/BV1e24y1f7tA",
    }),
  ],
});
