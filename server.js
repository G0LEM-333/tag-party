import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(path.join(__dirname, 'dist')));       // `npm run build` output

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

/** rooms: id -> { host: ws, guests: Map<cid, ws> } */
const rooms = new Map();
let nextCid = 1;
const tx = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };

wss.on('connection', ws => {
  ws.role = null;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }

    if (m.op === 'host') {
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
