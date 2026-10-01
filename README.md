# Tag Party - Discord Activity setup

## Run it locally
```bash
npm install
cp .env.example .env        # put your Application ID in it
npm run server              # terminal 1: game server on :3001
npm run dev                 # terminal 2: Vite on :5173
cloudflared tunnel --url http://localhost:5173    # terminal 3 (gives you https://xxxx.trycloudflare.com)
```
Developer Portal -> your app -> Activities -> URL Mappings: set `/` to the tunnel hostname (no https://).
Then in Discord (Developer Mode on): join a voice channel -> Activities (rocket) -> launch your app.

## Deploy
```bash
npm run build && npm start    # serves dist/ and the /ws relay on one port
```
Host it anywhere that supports WebSockets (Render, Railway, Fly.io...), then change the `/` URL Mapping to that domain.

## What changed from the original
- Added the Discord SDK handshake (src/discord.js). Outside Discord the game still runs as a normal website.
- Phaser and the font are bundled by Vite instead of loaded from jsdelivr / Google Fonts (blocked in Activities).
- PeerJS (WebRTC + third-party server) replaced by src/peer-shim.js + server.js (WebSocket relay).
  game.js is untouched; the host is still authoritative.
- Lag fix: every player now moves their OWN character locally and just shares where it is, so controls never wait on the host's PC.
  The host only referees the rules (who is IT, tags, timer, power-up orbs).
- Screen fit: the map is always 16:9 and as big as the window allows (never stretched). On other window shapes the leftover space is a framed bezel tinted by the map's sky.

## Game modes
Pick one under HOST GAME -> GAME SETTINGS -> GAME MODE (guests get it automatically when the round starts).
- **CLASSIC TAG** - the original. Whoever is IT when time runs out loses.
- **BOMB PANIC** - run away from the bomb. The carrier chases and passes the bomb on by touching someone. At zero it explodes: the carrier and everyone inside the red blast ring lose (a shield protects you). Cues: red glow, bomb with a sparking fuse, a red keep-out ring with waves pushing outward, red screen edges when the bomb is close, timer turns red for the last 5 seconds.
- **FLAG HUNT** - catch the flag holder. Everyone else chases them and touches to steal the flag. Whoever holds the flag at zero wins the round (only they score). Cues: green glow, waving flag, green rings closing in, faint green screen edges as you get near.

Each mode also shows a role line under the timer (e.g. RUN FROM THE BOMB! / CATCH THE FLAG!) and a short intro at the start of the round.
Modes live in the `MODES` table near the top of `src/game.js` (rename them there; `BLAST_R` is the bomb's blast radius, 0 = only the carrier loses).

## Network speed (instant movement)
Before, a friend's move went friend -> server -> HOST -> (wait for the next 20/s snapshot) -> server -> you, and was then eased in twice (~45 ms each).
Now:
- **Direct relay.** Every player sends their position straight to the server, which forwards it to everyone else at once (`op: 'p'` in server.js). One hop instead of two, and it no longer waits on the host's PC.
- **60-80 packets a second** per player (was ~30), with velocity, so other screens can predict a few ms ahead (`followRemote`). A slow heartbeat when you stand still.
- **Lighter smoothing:** 20 ms instead of 45 ms (`REMOTE_SMOOTH`).
- **Rules are sent the moment they change** (tag / bomb / flag changing hands, power-ups, freezes) instead of waiting for the next snapshot; otherwise a ~10/s heartbeat. The guest timer counts down locally in between.
- **Host sends one message** that the server fans out to all guests (`op: 'all'`) instead of one copy per guest.
- **No lag build-up:** a client whose connection is backed up is skipped for position packets (a newer one replaces them anyway), TCP_NODELAY is on, compression is off.
All the knobs are the constants under "Netcode tuning" at the top of `src/game.js`.

**You must restart / redeploy server.js** together with the new front-end: the new client talks to the new server ops, and an old server would not relay positions at all.
