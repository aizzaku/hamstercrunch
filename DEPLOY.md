# Railway launch

The repository must contain the game source, assets, Dockerfile and server files. Never upload `.local/`, `.env` files or session databases. This project has no npm dependencies or build step. Docker pins the runtime to Node 24 and runs `node server.cjs`.

1. Publish the prepared source to https://github.com/aizzaku/hamstercrunch. Keep the repository public for Squeekchain Direct submission. Confirm existing repository content before merging or pushing; do not force push.
2. In Railway, choose New Project, then Deploy from GitHub repo. Connect GitHub if needed and select `aizzaku/hamstercrunch`. Railway should detect the Dockerfile.
3. Attach a persistent volume to the game service and set its mount path to `/data`. The database will be `/data/bakery.sqlite`. Keep one service replica when using this SQLite database.
4. Under service Variables, set `NODE_ENV=production` and `DATA_DIR=/data`. These are also Docker defaults. Railway supplies `PORT`; leave it automatic. No ElevenLabs API key is needed for playback of the bundled sound files.
5. Under deployment settings, use `/healthz` for the healthcheck path. The Docker start command is already configured.
6. Deploy the pending changes after the volume is attached. Check logs for `Hamster Crunch listening on 0.0.0.0:<port>`.
7. Under service Settings, Networking, Public Networking, generate a Railway domain. Visit the HTTPS URL. Configure the target port to Railway's assigned `PORT` if asked.
8. Test gameplay, a bake, profile reload and Rankings. Restart or redeploy the service and confirm the same browser profile remains. The volume is essential for persistence. Localhost browser cookies and local player records do not automatically move to the new domain.
9. Add a domain or subdomain you control in Railway's custom domain settings. Add exactly the DNS record Railway shows at your DNS provider, then wait for verification and HTTPS. Complete this before inviting players: browser session cookies are tied to the hostname.
10. Enable volume backups and monitor usage. Railway Free has limited monthly credit; observe usage before relying on it for continuous availability.

## Squeekchain Direct submission

Open https://squeekchain.com/genesis/code and use your Genesis profile's Direct submission flow. Provide the game name, live custom-domain URL, public repository URL and an accurate description of the Squeekchain integration.

When the flow supplies verification values, add the DNS record to the domain, page tag to `index.html`, and repository attribution line to `README.md` exactly as supplied. Redeploy the changed source. Verify the custom domain and repository, then press Verify in Squeekchain. Automatic checks and team review determine acceptance; verification is not guaranteed approval.

Suggested description:

> Hamster Crunch: Genesis Block is a cozy hamster brick-breaker with 21 levels across three bakery chapters. Players collect ingredients, discover 12 recipes and bake treats. The bakery market opens only while fresh hardware telemetry reports Squeektoshi running. Confirmed settlement data seeds market prices and a shared Special Batch challenge. Seven shared leaderboards track arcade and bakery progress. Points only; no token or transaction required. Arcade rankings use basic validation and remain beta records.

Keep the required Squeekchain verification records in place after approval. Do not invent verification values; obtain them from the actual submission flow.
