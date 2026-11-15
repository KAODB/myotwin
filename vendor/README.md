# Third-party code

Files in this folder are not written by the team. Each is used unchanged.

| File | What it is | Version | Licence | Source |
|---|---|---|---|---|
| `anime.umd.min.js` | Anime.js, a JavaScript animation library by Julian Garnier | 4.5.0 | MIT (see `anime-LICENSE.md`) | npm package `animejs@4.5.0`, file `dist/bundles/anime.umd.min.js`; https://animejs.com |

SHA-256 of `anime.umd.min.js`: `8d5b3a58a1f64023a04a4cedeef135a2263b18da04b35177ac13438a0bad033b`
(`test/page.test.js` checks this hash, so the file cannot change unnoticed).

The page uses it only through `js/motion.js`. Without the file, or when the
reader asks for reduced motion, the page works the same with no animation.
