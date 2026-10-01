import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(path.join(__dirname, 'dist')));       // `npm run build` output

const server = createServer(app);
// perMessageDeflate off: compressing tiny packets only adds delay. maxPayload: nothing legitimate is bigger than a snapshot.
const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: false, maxPayload: 16 * 1024 });

/** rooms: id -> { host: ws, guests: Map<cid, ws> } */
const rooms = new Map();
let nextCid = 1;
const tx = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
const BACKLOG = 64 * 1024;       // a client this far behind is skipped for position packets (a newer one replaces them anyway), so lag never piles up

wss.on('connection', (ws, req) => {
  try { req.socket.setNoDelay(true); } catch { }                // send every packet immediately (no Nagle batching)
  ws.role = null;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }

    if (m.op === 'p') {
      // Position packet: sent as-is to everyone ELSE in the room, no re-encoding, no round trip through the host.
      // (Guest -> host + the other guests. Host -> all guests.) The host still decides every rule; this is only "where am I".
      const room = rooms.get(ws.roomId); if (!room || raw.length > 256) return;
      const fwd = c => { if (c !== ws && c.readyState === 1 && c.bufferedAmount < BACKLOG) c.send(raw, { binary: false }); };
      if (ws.role === 'guest') fwd(room.host);
      room.guests.forEach(fwd);

    } else if (m.op === 'all') {
      // Host -> every guest in ONE message (the server does the fan-out instead of the host sending N copies).
      if (ws.role !== 'host') return;
      const room = rooms.get(ws.roomId); if (!room) return;
      const out = JSON.stringify({ op: 'data', d: m.d });
      room.guests.forEach(g => { if (g.readyState === 1) g.send(out); });

    } else if (m.op === 'host') {
      if (typeof m.id !== 'string' || m.id.length > 40) return;
      if (rooms.has(m.id)) return tx(ws, { op: 'error', type: 'unavailable-id' });
      rooms.set(m.id, { host: ws, guests: new Map() });
      ws.role = 'host'; ws.roomId = m.id;
      tx(ws, { op: 'hosting' });

    } else if (m.op === 'join') {
      const room = rooms.get(m.id);
      if (!room) return tx(ws, { op: 'error', type: 'peer-unavailable' });
      const cid = nextCid++;
      ws.role = 'guest'; ws.roomId = m.id; ws.cid = cid;
      room.guests.set(cid, ws);
      tx(ws, { op: 'joined' });
      tx(room.host, { op: 'peer-join', cid });

    } else if (m.op === 'data') {
      const room = rooms.get(ws.roomId); if (!room) return;
      if (ws.role === 'guest') tx(room.host, { op: 'data', from: ws.cid, d: m.d });
      else if (ws.role === 'host') { const g = room.guests.get(m.to); if (g) tx(g, { op: 'data', d: m.d }); }

    } else if (m.op === 'kick' && ws.role === 'host') {
      const room = rooms.get(ws.roomId); const g = room && room.guests.get(m.cid);
      if (g) { tx(g, { op: 'host-gone' }); room.guests.delete(m.cid); }
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomId); if (!room) return;
    if (ws.role === 'host') {                                 // host left: drop the room, tell everyone
      room.guests.forEach(g => tx(g, { op: 'host-gone' }));
      rooms.delete(ws.roomId);
    } else if (ws.role === 'guest') {
      room.guests.delete(ws.cid);
      tx(room.host, { op: 'peer-leave', cid: ws.cid });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Tag Party server on :${PORT}`));
