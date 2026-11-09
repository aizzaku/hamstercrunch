# Hamster Crunch: Genesis Block

squeekchain-project: 0f3f56a4-98d8-4946-8e75-5b7686e88eda

## Recipe Box: collection and baking

Open **Recipe Box** in the header for Recipes, Pantry, Orders, Collection and Profile. The starter pantry and Butter Paw recipe let you bake immediately. There are 20 recipes and 12 ingredients across Common, Uncommon, Rare and Epic tiers. Baking consumes exact ingredient quantities and produces treats; serving orders consumes treats and earns stamps and baker XP. Your first bake permanently collects the food card. Targeted restocking costs 3/6/12/30 stamps by ingredient rarity. Cosmetic baker titles unlock at 3, 10 and 25 served orders; they do not change campaign power.

Each destroyed food block has an independent 18% chance to release a falling ingredient. Catch it with the paddle; missed ingredients are not credited. Conditional rarity shares are Common 65%, Uncommon 25%, Rare 9% and Epic 1%, with uniform selection within a tier. No ingredient or recipe-scrap pity guarantees remain. A rewarded level clear grants 5 XP and an independent 5% recipe-scrap chance; two matching scraps unlock a recipe. Remaining recipe discoveries use rarity weights, renormalized across tiers with undiscovered recipes. Once the book is complete, successful scrap rolls grant stamps. The run basket appears between levels and in Profile. Caught loot saves immediately and survives run loss. Final ingredient drops get up to four seconds to fall before a clear; Space can skip this catch window.

Recipe progress lives in server-side SQLite at `.local/bakery.sqlite`, identified by an opaque HttpOnly browser cookie. Legacy browser saves preserve their name and remain local; resource/stat imports are blocked. Guest profiles return through the same browser cookie. Optional wallet sign-in links that bakery for recovery on another device. Back up the SQLite file for hosting. Existing inventories, recipe IDs, unlocks and orders remain intact; new ingredient and recipe slots start empty. New runs retain your pantry, food, recipes and orders. Roguelike upgrades are deferred.

The current visual theme is **Sunny Bakery**: illustrated biscuits, rolling-pin paddle, fluffy hamster, watercolor bakery backdrop and a strawberry-pink Burrow Radio. The arena still uses its original gameplay proportions and collision sizes. `bakery.css` and `bakery-render.js` provide the current theme; earlier styles remain as reference.

Rendering now sizes the canvas backing to its on-screen dimensions and device pixel ratio (up to 3×). Sprites preserve their source aspect ratios, rather than stretching into each collision box. The sprite art is raster, so infinite zoom is not supported.

Enable **Sound on** for the approved ElevenLabs ASMR cookie, cracker and chocolate clips, with food-specific playback profiles. Voice limiting and compression keep chain reactions controlled. Effects remain separate from Burrow Radio.

Artwork and music setup: [assets/README.md](assets/README.md). Burrow Radio includes 10 user-provided ElevenLabs tracks, a track selector, shuffle and saved volume. Gameplay checks and radio/asset checks run with `npm test`.

A 21-level browser arcade campaign for the Genesis Era. Original canvas-drawn tumbling hamster, six power-ups, armored bricks, steel barriers, moving obstacles, combos, optional synthesized arcade audio, run timing and level splits. Guest play is instant; optional wallet sign-in uses SIWE and the WalletConnect connector. Requires Node 24+ with built-in `node:sqlite`; the server reads the public Squeekchain API.

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

- **Special Batch:** the latest safe nonzero-work settlement (transaction hash + settled round + chain ID) determines a shared tray and featured ingredient. Catch chance-based ingredients; the first rewarded clear grants +20 baker XP per seed. It remains playable while Squeektoshi rests, and never enters campaign records. Empty settlement rounds do not rotate it.
- **Live market:** fresh hardware ACTIVE telemetry with positive RPM opens the counter. IDLE closes it. Stale, missing, simulated or inconsistent telemetry pauses sales. Settlement data deterministically sets recipe demand and points per treat. Each sale rechecks the live API and current seed on the server, atomically deducts food and awards Bakery Points. Stamps remain the pantry-restock currency.
- **Persistence:** inventory, points, sale history and special claims are server-owned. The public API validates sequential client-reported arcade clears and elapsed times against server-created runs and a one-time legacy save import for this beta. These are not verified proof of play; add authentication, abuse controls and gameplay validation before competitive or valuable rewards. Bakery Points have no monetary redemption.
- **Hosting:** this version needs a persistent Node server and SQLite volume; a static-only Pages deployment is insufficient. The local server binds to `127.0.0.1:4173`. Configure production HTTPS, durable storage and session recovery before public launch. Never publish `.local/` or session data.

Reference: [official Squeekchain API docs](https://docs.squeekchain.com/developers/api/).


## 21-level Genesis campaign and global rankings

Three seven-level chapters: **Morning Crumbs**, **The Busy Kitchen**, **Midnight Feast**. Finales are levels 7, 14 and 21. Brick workload targets grow approximately 9% per level (24 to 135 total HP); ball speed rises gently from 325 to 464 and the paddle narrows from 124 to 94. Armor, steel and moving obstacles raise pressure while open side corridors preserve access. Explosive gifts, power-ups and Zoomies give aimed shots leverage against dense trays. These are tuning targets, not measured player difficulty; playtesting is still needed.

Open **Rankings** for seven boards across Arcade, Bakery and Collection:

- Genesis Champions: highest level cleared, fastest cumulative elapsed time breaks ties.
- Speed Bakers: fastest complete 21-level campaign.
- Special Batch: fastest clear of the current settlement tray. Replay to improve time within the shared daily run allowance; the 20 XP clear bonus remains once per settlement.
- Master Bakers: individual treats baked through new server-recorded actions.
- Busy Counter: individual treats sold through the live market.
- Bakery Fortune: lifetime Bakery Points earned, independent of future spending.
- Recipe Collectors: distinct recipes baked through new server-recorded actions.

Ranking rows show the profile’s baker name and an opaque public ID. Exact ties share a rank. Server-side SQLite keeps records across reloads and restarts. Legacy recipe imports retain inventory and collection cards, but do not inject imported cooking or collection totals into rankings. Existing server-owned sales and points count. The boards aggregate profiles on the same server; they become publicly shared when this server is deployed with persistent storage.

Campaign records are scoped to `genesis-21-v1`. Clears require the issued run ID, consecutive levels and plausible elapsed times bounded by server wall time. This catches duplicate, skipped, nonfinite and impossible future-time submissions; it is not authoritative physics replay and does not prevent a modified client from inventing plausible runs. The leaderboard UI labels arcade timings as beta client reports. Stronger verification and account identity are required before prize-based competition.


## First run, music and wallet saves

New players get three skippable prompts: move, launch and catch power-ups. The Burrow menu can replay the tutorial. The first rewarded clear shows a single baking nudge. Gameplay timers freeze while tutorial, profile, rankings or wallet dialogs are open.

Burrow Radio plays ten two-minute user-provided ElevenLabs MP3s from `assets/music`. Playback starts only on a player action. Tracks, shuffle and volume persist locally; previous follows listening history. MP3 endpoints support cached partial responses for seeking. Original files in the root `music` folder stay untouched and are excluded from the deploy context.

**Save bakery** offers browser-wallet or mobile/QR WalletConnect sign-in. Only a server-generated, domain-bound, expiring SIWE message can link a save. Nonces are single-use, failed signatures consume their challenge, login rotates cookies and signatures require no transaction or gas. A wallet already linked to another bakery requires explicit restore confirmation; saves never merge. Logout starts a fresh guest while retaining the wallet save. One active campaign run per bakery remains the concurrency model.

`site-config.json` holds the public Railway origin and public Reown project ID. `PUBLIC_ORIGIN` and `WALLETCONNECT_PROJECT_ID` override these defaults. Configure the production origin and Reown allowed domain together if the hostname changes. Browser extensions and WalletConnect support Ethereum EOA message signatures; smart contract wallet signature support has not been added. Wallet sign-in is identity/recovery, not proof of fair gameplay.

Run `npm ci`, `npm run check`, `npm test`. If the connector source changes, run `npm run build:wallet` and include the generated `walletconnect-provider.js`. Docker installs locked runtime dependencies; the generated browser bundle is already included. `node verify-deploy.cjs` runs an isolated production-mode HTTP test with synthetic wallet signatures and a temporary database.


## Live orders and bakery navigation

Main tabs are Live Bakery, Recipes, Orders, Collection and Profile. Pantry is a Recipes subview. The Recipe Box header button always starts at Recipes; the highlighted Live Bakery button opens the market. Every area has a short description. A one-time nonblocking save prompt appears for guests after the first saved level clear; wallet-linked players are not prompted.

Orders has Casual and Live views. Casual neighbor orders trade baked treats for stamps and XP. Live orders reserve a chosen quantity of treats for one automatic sale at the next verified opening. Reserved treats leave available stock immediately, so manual sales and casual orders cannot spend them. Canceling a still-pending order returns the treats exactly once. Limits are 24 pending orders per bakery and 1,000 treats per order.

A server worker checks the wheel every 30 seconds only while reservations exist. Sales require fresh hardware telemetry plus confirmed settlement prices. Orders created during an existing opening wait until the worker observes fresh resting telemetry followed by fresh running telemetry; a new settlement seed during the same continuous run does not release them. An outage or unknown state never counts as resting. Missed short openings are not reconstructed later. Pending reservations and receipts survive process restarts and wallet recovery.

Live order cards show the price formula’s possible per-treat range, the most recent actual sale price, and an estimated total range for the selected quantity. These are not guaranteed quotes. Receipts record the real quantity, unit price and points at execution; both manual and queued sales update the same sold/earned totals and global rankings. The latest 30 receipts and last sale for each recipe are retained.

Offline execution requires the Node service to remain running with a persistent volume. Railway sleep, exhausted credit or deployment downtime can delay sales or miss an opening. Keep one service replica, monitor usage and use an always-available hosting plan for reliable offline fulfillment. No financial tokens or real-money sales are involved.

## Daily rewarded runs and automation limits

Each verified wallet gets five rewarded launches per UTC day, shared across campaign and Special Batch. Launching consumes a slot; losing a life or moving to the next level does not. After five launches, play continues as practice. Guests also play practice. Practice clears grant no ingredients, XP, Special Batch claim, or global arcade ranking. A rewarded run admitted before midnight stays rewarded if completed after midnight. Sign-in restores the same canonical bakery and its allowance across devices.

The game HUD and Profile show the remaining allowance or Practice mode. Daily limits use the server clock and SQLite transactions, not browser storage. New browser resource/stat imports are blocked; the original local save and existing server bakeries remain intact.

This is a reward rate limit, not proof of human play. Client-reported clears still lack server-verified physics or input replays, and one person can control multiple wallets. Suspicious timing or repetitive inputs can support review but cannot reliably distinguish a skilled player, accessibility tooling, and a bot. Do not automatically ban players on score or precision alone. A stronger next step is server-issued run seeds with deterministic input-replay validation and replay/overlap rejection; this validates gameplay, not humanity.

## Server-issued ingredient drops

Each campaign level and Special Batch gets one persistent loot plan at launch, containing scoped random pickup IDs tied to brick indices. Preparing a level is idempotent, including zero-drop plans. Tokens are bound to player, run, level and mode; invented, duplicate, cross-player, stale and practice claims cannot credit inventory. Plans expire after six hours without rerolling. Claims have a 750ms minimum age; this is not proof that the paddle physically caught an item. Client-reported gameplay still needs future replay validation for stronger automation resistance.

Special Batch drops use the same odds and rarity shares. Within the featured ingredient's existing tier, it gets a 50% preference before uniform selection; this never promotes its tier or guarantees a drop. The first rewarded clear per round grants 20 XP, with no guaranteed ingredient bundle. Rarity-weighted ingredient values affect settlement-seeded food prices. All 12 ingredient images are served locally from assets/ingredients; high-resolution source art is retained separately under output.
