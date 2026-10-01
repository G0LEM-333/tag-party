import Phaser from 'phaser';
import '@fontsource/lilita-one/400.css';      // self-hosted font (Google Fonts is blocked inside Discord)
import './style.css';
import { Peer } from './peer-shim.js';
import { setupDiscord } from './discord.js';

// game.js was written for <script> tags and expects these as globals
window.Phaser = Phaser;
window.Peer = Peer;

async function boot() {
  try { await setupDiscord(); } catch (e) { console.error('Discord SDK failed:', e); }
  await document.fonts.load('20px "Lilita One"').catch(() => {});
  await import('./game.js');                  // starts the Phaser game
}
boot();
