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
  The host only referees the rules (who is IT, tags, timer, power-up orbs) and relays positions. server.js is unchanged.
- Screen fit: the map is always 16:9 and as big as the window allows (never stretched). On other window shapes the leftover space is a framed bezel tinted by the map's sky.
