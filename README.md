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

## Player colours + player-count slider
- **Colours.** Everyone picks their own colour (12 to choose from, one player per colour). The host picks theirs on the CHOOSE MAP screen (under the players slider) and can change it in the lobby; guests pick in the lobby, in the row of little cats at the bottom. A colour someone else has is faded and crossed out and can't be clicked. A guest starts on the first free colour. If two people click the same colour at the same moment the host gives it to the first one and everyone's screen settles on that.
- **Colours are locked when the round starts** and stay with the player for every round after (also on the results screen and in the score row). When someone leaves between rounds, their colour and win count are dropped and everyone else keeps theirs.
- **Players slider** on CHOOSE MAP (2-12), under the maps. It is the only place to set the player count (GAME SETTINGS now only has ROUND TIME and POWER-UPS).
- How it works: `G.colors[slot]` (in `src/game.js`) holds each player's colour; `colorOf(slot)` is used everywhere a player is drawn or named. Guests send `{ t: 'color', c }` to the host, the host answers everyone with `{ t: 'lobby', colors }`, and the round-start message carries the final list. No change to `server.js` (it only relays), but redeploy the front-end together with it as usual.

## Game modes
The host picks the mode on the CHOOSE MODE screen (HOST GAME -> BOMB PANIC or FLAG HUNT), then the map. It is no longer a setting under GAME SETTINGS. Guests get the mode automatically when the round starts.
- **BOMB PANIC** - run away from the bomb. The carrier chases and passes the bomb on by touching someone. At zero it explodes: the carrier and everyone within `BLAST_R` of them lose (a shield protects you). Cues: a bomb with a sparking fuse above the carrier, red screen edges when the bomb is close, timer turns red for the last 5 seconds. The blast radius is not drawn on screen.
- **FLAG HUNT** - catch the flag holder. Everyone else chases them and touches to steal the flag. Whoever holds the flag at zero wins the round (only they score). Cues: a waving flag above the holder, faint green screen edges as you get near.

**Round result screen.** Every player gets their own verdict banner (YOU WIN! / YOU LOSE / IT'S A TIE), a one-line reason, and a tile per player showing how they ended (blew up, blasted, survived, winner...) with their win count. The host presses SPACE to play again (it unlocks about a second after the banner, so a jump at the buzzer can't skip it).
**Blast rule.** In BOMB PANIC everyone inside `BLAST_R` of the carrier at zero loses with them (a shield still protects you). If nobody connected survives, the round is a TIE and nobody scores: with 2 players that means both were inside the blast.

Each mode also shows a role line under the timer (e.g. RUN FROM THE BOMB! / CATCH THE FLAG!) and a short intro at the start of the round.
Modes live in the `MODES` table near the top of `src/game.js` (rename them there and in the CHOOSE MODE cards in `index.html`; `BLAST_R` is the bomb's blast radius, 0 = only the carrier loses).

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

## Seamless ramps (no more breaks in the platforms)
Ramps used to be drawn as a rotated rectangle, so where one met a platform its end was a slanted cut and the platform's rounded corner left a wedge-shaped hole (visible on WINTER, DESERT and UNDERWATER; the ramps on MEADOW were fine).
Now a ramp is drawn as a slab with the same vertical thickness as the platforms (`rampBand`, `SLAB` in `src/game.js`), ramps are drawn *before* the platforms so the joint is covered, and `platCorners(i)` squares off the platform's rounded corner on any side a ramp attaches to.
It is all worked out from the map's `plats` / `ramps` data, so **new maps and new ramps join up automatically** (a ramp end within `JOIN` px of a platform edge counts as attached). Only the art changed; ramp collision (`rampY`) is untouched.
MEADOW's first ramp deliberately ends in mid-air above the floor, so its end is still a free end.

## Windows that are not in front (hidden, minimised, behind another app)
**Before:** the browser stops sending animation frames to a hidden window, and Phaser also paused / slowed its own clock whenever the window lost focus. So the player froze for everybody else (no position packets), a *host* who tabbed away froze the whole round (tags, power-ups, timer), and the clocks of different players drifted apart.
**Now** (`keepRunning` near the bottom of `src/game.js`, plus `src/ticker.js`):
- Phaser's hidden / visible / blur / focus handlers are switched off. (It still lets go of the keys on blur, so an away player simply stands still and can be tagged.)
- A tiny **Web Worker** (`src/ticker.js`) ticks ~60 times a second even when the page is hidden. Whenever no frame has been drawn for `STALL_MS` (100 ms) the page runs a normal game step *without drawing*: physics, rules and position packets all keep going. When frames are flowing the ticker does nothing, so there is no double-stepping.
- The **host's round timer is wall-clock**: the round ends at a fixed real time (`endAt`) instead of being counted down frame by frame, so a slow or background host can no longer stretch the round.
- Guests anchor their countdown to the **least-delayed host snapshot** (`G.endEst`) instead of re-anchoring on every snapshot, so the timer no longer jitters with network lag and agrees between players.
- Fallback: if the browser/Discord blocks Web Workers, a plain `setInterval` is used instead (it still helps, but browsers slow those down to ~1 per second in a hidden window).

No change to `server.js`. Rebuild and redeploy the front-end as usual (`npm run build`; the worker is emitted as a small `assets/ticker-*.js`).
