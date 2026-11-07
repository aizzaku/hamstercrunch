# Hamster Crunch: Genesis Block

## Recipe Box: collection and baking

Open **Recipe Box** in the header for Recipes, Pantry, Orders, Collection and Profile. The starter pantry and Butter Paw recipe let you bake immediately. There are 12 recipes and 8 ingredients. Baking consumes exact ingredient quantities and produces treats; serving orders consumes treats and earns stamps and baker XP. Your first bake permanently collects the food card. Stamps can restock a chosen ingredient (3 stamps each). Cosmetic baker titles unlock at 3, 10 and 25 served orders; they do not change campaign power.

Each cleared level grants one basic ingredient, plus an independent 25% bonus-ingredient roll and 5% recipe-scrap roll. A bonus ingredient is guaranteed on the third dry clear; a scrap on the eighth. Two scraps reveal a recipe; missing recipes are selected to avoid useless duplicates. After the recipe book is complete, scrap drops grant stamps instead. Bonus ingredients favor recipe shortages. The run basket appears between levels and in Profile. Loot saves on each clear and survives run loss. Run/level receipts prevent duplicate or skipped-level rewards.

Recipe progress now lives in server-side SQLite at `.local/bakery.sqlite`, identified by an opaque HttpOnly browser cookie. The existing `hamster-crunch-recipe-box-v1` browser save imports once and remains preserved locally. Keep the session cookie to return to the same profile; there is no cross-device account or recovery flow yet. Back up the SQLite file for hosting. New runs retain your pantry, food, recipes and orders. Roguelike upgrades are deferred.

The current visual theme is **Sunny Bakery**: illustrated biscuits, rolling-pin paddle, fluffy hamster, watercolor bakery backdrop and a strawberry-pink Burrow Radio. The arena still uses its original gameplay proportions and collision sizes. `bakery.css` and `bakery-render.js` provide the current theme; earlier styles remain as reference.

Rendering now sizes the canvas backing to its on-screen dimensions and device pixel ratio (up to 3×). Sprites preserve their source aspect ratios, rather than stretching into each collision box. The sprite art is raster, so infinite zoom is not supported.

Enable **Sound on** for the approved ElevenLabs ASMR cookie, cracker and chocolate clips, with food-specific playback profiles. Voice limiting and compression keep chain reactions controlled. Effects remain separate from Burrow Radio.

Artwork and music setup: [assets/README.md](assets/README.md). Radio controls are ready, but no music tracks have been supplied yet. Gameplay checks and radio/asset checks run with `npm test`.

A 21-level browser arcade campaign for the Genesis Era. Original canvas-drawn tumbling hamster, six power-ups, armored bricks, steel barriers, moving obstacles, combos, optional synthesized arcade audio, run timing and level splits. No npm dependencies or wallet. Requires Node 24+ with built-in `node:sqlite`; the server reads the public Squeekchain API.

Run `npm start`, then open http://127.0.0.1:4173.

- Move: arrows, A/D, mouse, or touch.
- Launch: Space or tap the game.
- Pause/resume: P or the pause button. Switching tabs pauses automatically.
- Restart: R or the restart button.
- Clear all 21 levels before losing your lives. Paddle impact position controls the bounce angle.
- Catch falling pickups: wide paddle (14s), slow motion (12s), multiball (up to 5), fireball (10s), one-use safety net, extra life (maximum 5).
- Pickups drop every fourth destroyed brick in a fixed order. Temporary effects reset between levels and after losing all active hamsters.
- The run timer starts after the server accepts a new run, then includes first launch, includes relaunch waiting, and excludes pauses and level transition screens.
- Local records persist in this browser and rank by cleared levels descending, then run time ascending. The separate global rankings use accepted campaign clears and server-recorded bakery activity. Local records from the original ten-level version remain under their old browser key and are not mixed into the new campaign.
- Restarting a started run records it before starting over.

Run `npm run check` for JavaScript syntax checks and `npm test` for gameplay, audio, recipe, chain, server and client checks. There is no build step. The original MVP remains in `game.js` and `verify.cjs` as reference; the game now runs `levels.js` and `engine.js`.

## Immersive arcade update

- Arena fits the available viewport while retaining its 800:560 proportions. Compact HUD; instructions, power-up guide, splits and local rankings live in the Menu. Fullscreen is available where supported by the browser.
- Space launches/resumes when waiting and activates Zoomies during play. A touch/mouse Zoomies button is also available.
- Direct brick hits charge Zoomies by 10%. A full meter grants five seconds of piercing. Blast damage and active Zoomies do not charge it. Charge carries between levels; a new run resets it.
- Orange seed crates destroy neighboring bricks, including armor, and chain through adjacent crates. Steel is unaffected.
- At three remaining bricks or fewer, paddle returns aim at the nearest remaining brick. Steel can still intercept the hamster.
- Opening Menu pauses active play and freezes the timer even when waiting to relaunch. Closing it resumes play if the menu paused it.

Next scope: tune the 21 levels with real play, introduce roguelike mode, expand toward 100 levels, and harden run verification and account recovery for public launch. No deployment or submission has been performed.


## Squeektoshi’s bakery integration

Open **Live Bakery** from the header or Recipe Box. The server reads the official public `/v1/status` and `/v1/settlements` endpoints at `https://api.squeekchain.com`. Current chain data identifies Sepolia testnet, shown in the interface. No tokens, transactions or wallet connection are involved.

- **Special Batch:** the latest safe nonzero-work settlement (transaction hash + settled round + chain ID) determines a shared tray and featured ingredient. Clear it for 3 ingredients +20 baker XP once per seed. It remains playable while Squeektoshi rests, and never enters campaign records. Empty settlement rounds do not rotate it.
- **Live market:** fresh hardware ACTIVE telemetry with positive RPM opens the counter. IDLE closes it. Stale, missing, simulated or inconsistent telemetry pauses sales. Settlement data deterministically sets recipe demand and points per treat. Each sale rechecks the live API and current seed on the server, atomically deducts food and awards Bakery Points. Stamps remain the pantry-restock currency.
- **Persistence:** inventory, points, sale history and special claims are server-owned. The public API validates sequential client-reported arcade clears and elapsed times against server-created runs and a one-time legacy save import for this beta. These are not verified proof of play; add authentication, abuse controls and gameplay validation before competitive or valuable rewards. Bakery Points have no monetary redemption.
- **Hosting:** this version needs a persistent Node server and SQLite volume; a static-only Pages deployment is insufficient. The local server binds to `127.0.0.1:4173`. Configure production HTTPS, durable storage and session recovery before public launch. Never publish `.local/` or session data.

Reference: [official Squeekchain API docs](https://docs.squeekchain.com/developers/api/).


## 21-level Genesis campaign and global rankings

Three seven-level chapters: **Morning Crumbs**, **The Busy Kitchen**, **Midnight Feast**. Finales are levels 7, 14 and 21. Brick workload targets grow approximately 9% per level (24 to 135 total HP); ball speed rises gently from 325 to 464 and the paddle narrows from 124 to 94. Armor, steel and moving obstacles raise pressure while open side corridors preserve access. Explosive gifts, power-ups and Zoomies give aimed shots leverage against dense trays. These are tuning targets, not measured player difficulty; playtesting is still needed.

Open **Rankings** for seven boards across Arcade, Bakery and Collection:

- Genesis Champions: highest level cleared, fastest cumulative elapsed time breaks ties.
- Speed Bakers: fastest complete 21-level campaign.
- Special Batch: fastest clear of the current settlement tray. Replay to improve time; ingredients and XP remain once per settlement.
- Master Bakers: individual treats baked through new server-recorded actions.
- Busy Counter: individual treats sold through the live market.
- Bakery Fortune: lifetime Bakery Points earned, independent of future spending.
- Recipe Collectors: distinct recipes baked through new server-recorded actions.

Ranking rows show the profile’s baker name and an opaque public ID. Exact ties share a rank. Server-side SQLite keeps records across reloads and restarts. Legacy recipe imports retain inventory and collection cards, but do not inject imported cooking or collection totals into rankings. Existing server-owned sales and points count. The boards aggregate profiles on the same server; they become publicly shared when this server is deployed with persistent storage.

Campaign records are scoped to `genesis-21-v1`. Clears require the issued run ID, consecutive levels and plausible elapsed times bounded by server wall time. This catches duplicate, skipped, nonfinite and impossible future-time submissions; it is not authoritative physics replay and does not prevent a modified client from inventing plausible runs. The leaderboard UI labels arcade timings as beta client reports. Stronger verification and account identity are required before prize-based competition.
