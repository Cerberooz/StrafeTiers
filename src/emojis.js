import { readFile } from 'node:fs/promises';
import { REST } from 'discord.js';

export const APPLICATION_ICONS = [
  { key: 'premium', name: 'strafe_minecraft', fallback: '🎮' },
  { key: 'discord', name: 'strafe_discord', fallback: '💬' },
  { key: 'team', name: 'strafe_team', fallback: '🚩' },
  { key: 'solo', name: 'strafe_solo', fallback: '⚔️' }
];

const route = applicationId => `/applications/${applicationId}/emojis`;
function readItems(result) {
  if (!Array.isArray(result?.items)) throw new Error('Invalid application emoji response.');
  for (const item of result.items) {
    if (!/^\d{17,20}$/.test(item.id) || typeof item.name !== 'string') throw new Error('Invalid application emoji.');
  }
  return result.items;
}

/** Called by registration, not by /tier; reuse existing emojis without replacing their IDs. */
export async function uploadApplicationIcons(settings) {
  const rest = new REST({ version: '10', timeout: 15_000, retries: 2 }).setToken(settings.token);
  const endpoint = route(settings.applicationId);
  const items = readItems(await rest.get(endpoint));
  for (const icon of APPLICATION_ICONS) {
    let emoji = items.find(item => item.name === icon.name);
    if (!emoji) {
      const image = await readFile(new URL(`../assets/emojis/${icon.name}.png`, import.meta.url));
      if (image.length > 256 * 1024) throw new Error('Application emoji exceeds Discord size limit.');
      emoji = await rest.post(endpoint, { body: { name: icon.name, image: `data:image/png;base64,${image.toString('base64')}` } });
      console.log(`Uploaded application emoji :${icon.name}:`);
    } else console.log(`Using existing application emoji :${icon.name}:`);
  }
}

/** One read per startup; default/auto icons use the application's own emoji IDs. */
export async function resolveApplicationIcons(settings) {
  const rest = new REST({ version: '10', timeout: 15_000, retries: 2 }).setToken(settings.token);
  const items = readItems(await rest.get(route(settings.applicationId)));
  let found = 0;
  for (const icon of APPLICATION_ICONS) {
    if (settings.icons[icon.key] !== icon.fallback) continue; // Explicit custom overrides remain intact.
    const emoji = items.find(item => item.name === icon.name && item.available !== false);
    if (emoji) {
      settings.icons[icon.key] = `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
      found++;
    }
  }
  return found;
}
