import { createServer } from 'node:http';
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { config } from './config.js';
import { ProfileClient, ProfileError } from './api.js';
import { profileEmbed } from './profile.js';

const settings = config();
const api = new ProfileClient(settings);
const client = new Client({ intents: [GatewayIntentBits.Guilds], allowedMentions: { parse: [] } });
const cooldowns = new Map();
let active = 0;
let stopping = false;
const log = event => console.log(JSON.stringify({ event, time: new Date().toISOString() }));

const errors = {
  invalid_name: 'Please enter a Minecraft username (letters, numbers, and underscores, up to 16 characters).',
  not_found: 'No public StrafeTiers profile was found for that player. They may need to join StrafeMC first.',
  ambiguous: 'More than one Minecraft account uses that name. Please contact a StrafeMC administrator.',
  busy: 'StrafeTiers is handling a lot of requests. Please try again shortly.',
  unavailable: 'StrafeTiers is temporarily unavailable. Please try again later.',
  invalid_response: 'StrafeTiers is temporarily unavailable. Please try again later.'
};

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'tier') return;
  try {
    const player = interaction.options.getString('player', true).trim();
    if (!/^[A-Za-z0-9_]{1,16}$/.test(player)) {
      await interaction.reply({ content: errors.invalid_name, flags: MessageFlags.Ephemeral }); return;
    }
    const now = Date.now();
    if ((cooldowns.get(interaction.user.id) || 0) > now) {
      await interaction.reply({ content: 'Please wait a few seconds before using /tier again.', flags: MessageFlags.Ephemeral }); return;
    }
    if (stopping || active >= 32) {
      await interaction.reply({ content: errors.busy, flags: MessageFlags.Ephemeral }); return;
    }
    cooldowns.delete(interaction.user.id);
    if (cooldowns.size >= 4096) cooldowns.delete(cooldowns.keys().next().value);
    cooldowns.set(interaction.user.id, now + settings.cooldownMs);
    active++;
    try {
      // Acknowledge immediately; database and portrait work never delay Discord's deadline.
      await interaction.deferReply();
      const profile = await api.get(player);
      await interaction.editReply({ embeds: [profileEmbed(profile, settings)], allowedMentions: { parse: [] } });
    } finally { active--; }
  } catch (error) {
    const code = error instanceof ProfileError ? error.code : 'unavailable';
    log(`tier_request_${code}`); // Never print SDK errors, request headers, or credentials.
    try {
      const content = errors[code] || errors.unavailable;
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content, embeds: [] });
      else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    } catch { log('discord_reply_failed'); }
  }
});

client.on(Events.ClientReady, () => {
  if (client.application.id !== settings.applicationId) {
    log('discord_application_id_mismatch'); shutdown(1); return;
  }
  log('discord_ready');
});
client.on(Events.Error, () => log('discord_client_error'));
client.on(Events.ShardError, () => log('discord_gateway_error'));
client.on(Events.ShardDisconnect, () => log('discord_gateway_disconnected'));

const health = createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/healthz') { response.writeHead(404); response.end(); return; }
  const ready = client.isReady() && !stopping;
  response.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify({ ready }));
});
health.on('error', () => { log('health_server_error'); shutdown(1); });
health.listen(settings.healthPort, '0.0.0.0');

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(code), 10_000);
  deadline.unref();
  const drain = setInterval(() => {
    if (active > 0) return;
    clearInterval(drain);
    client.destroy();
    health.close(() => process.exit(code));
  }, 100);
}
process.once('SIGTERM', () => shutdown());
process.once('SIGINT', () => shutdown());

try { await client.login(settings.token); }
catch { log('discord_login_failed'); shutdown(1); }
