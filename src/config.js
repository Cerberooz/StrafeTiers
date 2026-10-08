export function required(name) {
  const value = process.env[name]?.trim();
  if (!value || /^(replace|your_|example)/i.test(value)) throw new Error(`Set ${name} in .env.`);
  return value;
}

export function integer(name, fallback, min, max) {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max)
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return Number(value);
}

export function registrationConfig() {
  const applicationId = required('DISCORD_APPLICATION_ID');
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || null;
  if (!/^\d{17,20}$/.test(applicationId) || guildId && !/^\d{17,20}$/.test(guildId))
    throw new Error('Discord application/guild IDs must be valid numeric IDs.');
  return { token: required('DISCORD_TOKEN'), applicationId, guildId };
}

export function config() {
  const apiBase = new URL(required('API_SERVER_BASE_URL'));
  if (!['https:', 'http:'].includes(apiBase.protocol) || apiBase.username || apiBase.password || apiBase.search || apiBase.hash)
    throw new Error('API_SERVER_BASE_URL must be a plain HTTP(S) origin.');
  const local = ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'].includes(apiBase.hostname);
  if (apiBase.protocol !== 'https:' && !local) throw new Error('Use HTTPS for the API outside local development.');
  const website = new URL(process.env.PUBLIC_WEBSITE_URL || 'https://strafemc.net');
  if (website.protocol !== 'https:' || website.username || website.password) throw new Error('PUBLIC_WEBSITE_URL must use HTTPS.');
  const icon = (name, fallback) => {
    const value = process.env[name]?.trim();
    return (!value || value.toLowerCase() === 'auto' ? fallback : value).slice(0, 80);
  };
  return {
    ...registrationConfig(), apiBase: apiBase.origin, apiKey: required('API_SERVER_API_KEY'), website: website.origin,
    cacheMs: integer('PROFILE_CACHE_SECONDS', 30, 0, 300) * 1000,
    cooldownMs: integer('USER_COOLDOWN_SECONDS', 3, 1, 60) * 1000,
    maximum: integer('MAX_CONCURRENT_LOOKUPS', 8, 1, 32),
    healthPort: integer('HEALTH_PORT', 3000, 1024, 65535),
    icons: { premium: icon('PREMIUM_ICON', '🎮'), discord: icon('DISCORD_ICON', '💬'), team: icon('TEAM_ICON', '🚩'), solo: icon('SOLO_ICON', '⚔️') }
  };
}
