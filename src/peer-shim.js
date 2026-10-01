/* Drop-in replacement for the parts of PeerJS that game.js uses, but over a WebSocket to your own server.
 * (PeerJS = WebRTC + a third-party signalling server; Discord Activities block both.)
 * Supported: new Peer([id]) / new Peer(), peer.on('open'|'connection'|'error'), peer.connect(id), peer.destroy(),
 *            conn.send(), conn.on('open'|'data'|'close'), conn.open, conn.close()
 * Extras for speed (not in PeerJS):
 *   peer.sendPos(obj)  my position packet; the server relays it straight to everyone else (guests too, not just the host).
 *                      Dropped if the socket is backed up: a newer one is always coming. Received with peer.on('pos', fn).
 *   peer.sendAll(msg)  host only: ONE message that the server fans out to every guest.
 * The server only relays. The host stays authoritative for the rules, exactly as before. */
import { proxyBase } from './discord.js';

class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn) { (this._h[ev] ||= []).push(fn); return this; }
  emit(ev, ...a) { (this._h[ev] || []).slice().forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } }); }
}

class Conn extends Emitter {
  constructor(peer, cid) { super(); this.peer = peer; this.cid = cid; this.open = false; }
  send(m) { this.peer._tx(this.cid === 'host' ? { op: 'data', d: m } : { op: 'data', to: this.cid, d: m }); }
  close() {
    if (this.cid !== 'host') this.peer._tx({ op: 'kick', cid: this.cid });
    this._closed();
  }
  _closed() { if (this.open || !this._didClose) { this.open = false; this._didClose = true; this.emit('close'); } }
}

export class Peer extends Emitter {
  constructor(id) {
    super();
    this.id = id || null;
    this.conns = new Map();                      // host: cid -> Conn
    this.hostConn = null;                        // guest: the Conn to the host
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}${proxyBase}/ws`);
    this.ws.onopen = () => {
      if (this.id) this._tx({ op: 'host', id: this.id });   // hosting: claim the room id
      else this.emit('open');                                // guest: ready to connect()
    };
    this.ws.onmessage = ev => this._rx(JSON.parse(ev.data));
    this.ws.onerror = () => this.emit('error', { type: 'network' });
    this.ws.onclose = () => {
      this.conns.forEach(c => c._closed());
      if (this.hostConn) this.hostConn._closed();
    };
  }

  connect(id) {
    const c = this.hostConn = new Conn(this, 'host');
    this._tx({ op: 'join', id });
    return c;
  }

  destroy() { try { this.ws.close(); } catch (e) {} }

  _tx(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }

  sendPos(o) { if (this.ws.readyState === 1 && this.ws.bufferedAmount < 16384) this.ws.send(JSON.stringify({ op: 'p', ...o })); }
  sendAll(d) { this._tx({ op: 'all', d }); }

  _rx(m) {
    switch (m.op) {
      case 'hosting': this.emit('open', this.id); break;
      case 'joined': if (this.hostConn) { this.hostConn.open = true; this.hostConn.emit('open'); } break;
      case 'peer-join': {                        // host: a guest arrived
        const c = new Conn(this, m.cid); this.conns.set(m.cid, c);
        this.emit('connection', c);
        c.open = true; setTimeout(() => c.emit('open'), 0);   // listeners are attached inside the 'connection' handler
        break; }
      case 'peer-leave': { const c = this.conns.get(m.cid); if (c) { this.conns.delete(m.cid); c._closed(); } break; }
      case 'data':
        if (m.from != null) { const c = this.conns.get(m.from); if (c) c.emit('data', m.d); }   // host receives
        else if (this.hostConn) this.hostConn.emit('data', m.d);                                 // guest receives
        break;
      case 'p': this.emit('pos', m); break;
      case 'host-gone': if (this.hostConn) this.hostConn._closed(); break;
      case 'error': this.emit('error', { type: m.type }); break;
    }
  }
}
