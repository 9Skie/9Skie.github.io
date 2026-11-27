/* =========================================================================
   CS stream  —  code projects (source: GitHub)
   -------------------------------------------------------------------------
   The cards are my real public repositories, pulled once a day by
   tools/sync_data.py (see cards/live.js). Forks are left out.

   GitHub only knows when a repository was UPLOADED. Where that is not when
   I made the thing, say so in `notes` below: take the // off the front of
   its line and put in the real date. js/card.js lists everything a note
   can say (made, archive, hide, title, desc, tags, cover).

   For something that is not on GitHub at all, write a card by hand in
   `items`. Cover images/gifs go in ./images/.

       card({
         date:  "2025-03",
         title: "project name",
         desc:  "one line about it",
         tags:  ["js", "webgl"],
         cover: "cards/1 cs/images/my-project.gif",   // optional
         url:   "https://example.com/project",
         count: 0,                                    // optional
       }),
   ========================================================================= */

window.STREAMS.cs = liveStream("cs", {
  label: "CS",
  sub: "GitHub",
  kind: "stars",
  aggregateLabel: "total stars across repos",

  // the total is shown as projects + courses. Course notes count, but get no cards here.
  splitBy: "group",
  parts: ["projects", "courses", "special"],
  offPage: ["courses"],

  // everything uploaded before the daily sync began sits below the OFF LIMITS line
  archiveBefore: "2026-11-26",

  notes: {
    // the site itself and the index of my projects: no cards, but their stars count
    "https://github.com/9Skie/My-Projects":     { noCard: "special" },
    "https://github.com/9Skie/9Skie.github.io": { noCard: "special" },
    // current projects: automatic cards above the OFF LIMITS line
    "https://github.com/9Skie/EduVid":          { archive: false },
    "https://github.com/9Skie/AttnAdam":        { archive: false },
  },

  // cards written by hand, for things that are not on GitHub
  items: [],

  // older projects, written by hand: they sit below the OFF LIMITS line.
  // Everything here is fixed; only the number (views / likes / stars) comes
  // in live every day, matched by the url.
  archive: [
    card({
      date:  "2024-02",
      title: "StockNet",
      desc:  "Neural network stock price predictor [EPQ project]",
      tags:  ["jupyter notebook", "projects"],
      cover: "",
      url:   "https://github.com/9Skie/StockNet",
    }),
    card({
      date:  "2022-11",
      title: "Niko-Niko-Ni",
      desc:  "A small Pygame runner that uses OneShot assets.",
      tags:  ["python"],
      cover: "",
      url:   "https://github.com/9Skie/Niko-Niko-Ni",
    }),
    card({
      date:  "2024-07",
      title: "DebtCheck",
      desc:  "BERT-style Transformer for credit card default prediction [AmEx Kaggle competition]",
      tags:  ["jupyter notebook", "projects"],
      cover: "",
      url:   "https://github.com/9Skie/DebtCheck",
    }),
    card({
      date:  "2025-04",
      title: "SelfDrive",
      desc:  "TD3 reinforcement learning agent for autonomous driving in the CARLA simulator",
      tags:  ["python", "projects"],
      cover: "",
      url:   "https://github.com/9Skie/SelfDrive",
    }),
  ],
});
