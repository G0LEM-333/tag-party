import { DiscordSDK } from '@discord/embedded-app-sdk';

/** True when the page is running inside Discord's Activity iframe (Discord adds ?frame_id=...). */
export const inDiscord = new URLSearchParams(location.search).has('frame_id');

/** Prefix for requests to your own server. Discord's proxy strips "/.proxy" before it reaches you. */
export const proxyBase = inDiscord ? '/.proxy' : '';

export let discordSdk = null;

/** Handshake with the Discord client. Outside Discord (normal browser tab) this does nothing, so the game still works as a website. */
export async function setupDiscord() {
  if (!inDiscord) return null;
  discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
  await discordSdk.ready();           // required: tells Discord the Activity has loaded
  return discordSdk;
}

/* OPTIONAL - only if you want the player's Discord name/avatar. Needs a /api/token endpoint on the server
 * that swaps the code for a token using your CLIENT SECRET (never put the secret in front-end code).
 *
 * const { code } = await discordSdk.commands.authorize({
 *   client_id: import.meta.env.VITE_DISCORD_CLIENT_ID, response_type: 'code',
 *   state: '', prompt: 'none', scope: ['identify'] });
 * const r = await fetch('/.proxy/api/token', { method: 'POST',
 *   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
 * const { access_token } = await r.json();
 * const auth = await discordSdk.commands.authenticate({ access_token });
 */
