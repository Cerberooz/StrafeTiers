import { EmbedBuilder, escapeMarkdown } from 'discord.js';

// Same minimum-one-per-band/population thresholds as WebApp tierColumns().
export function tierFor(position, total) {
  if (!Number.isSafeInteger(position) || !Number.isSafeInteger(total) || position < 1 || position > total)
    throw new Error('Invalid leaderboard position.');
  const bands = [{ name: 'S', top: 0.001 }, { name: 'A', top: 0.01 }, { name: 'B', top: 0.05 }, { name: 'C', top: 0.2 }];
  let start = 0;
  for (const [index, band] of bands.entries()) {
    if (total <= index) continue;
    const end = Math.min(Math.max(start + 1, total - (5 - index - 1)), Math.max(start + 1, Math.ceil(total * band.top)));
    if (position <= end) return band.name;
    start = end;
  }
  return 'F';
}

const order = { S: 0, A: 1, B: 2, C: 3, F: 4 };
export function bestStanding(profile, mode) {
  const rows = profile.standings.filter(row => row.mode === mode).map(row => ({ ...row, tier: tierFor(row.position, row.total) }));
  rows.sort((a, b) => order[a.tier] - order[b.tier] || b.points - a.points || a.rank - b.rank
    || Number(b.season === profile.currentSeason) - Number(a.season === profile.currentSeason)
    || Date.parse(b.seasonStartedAt) - Date.parse(a.seasonStartedAt) || a.subjectId.localeCompare(b.subjectId));
  return rows[0] || null;
}

export function portraitUrl(profile) {
  let identifier = 'steve';
  if (profile.premium) identifier = profile.playerId;
  else if (/^[a-f0-9]{40,64}$/.test(profile.skin?.textureHash || '') && ['classic', 'slim'].includes(profile.skin?.model))
    identifier = `texture:${profile.skin.textureHash}`;
  const url = new URL(`/render/${identifier}/body`, 'https://skinrender.dev');
  for (const [key, value] of Object.entries({ size: '256', width: '256', yaw: '20', pitch: '10', zoom: '1.7', offsetY: '0.36', pose: 'walk', frame: '0.08', leftArmPitch: '20', rightArmPitch: '-20' })) url.searchParams.set(key, value);
  if (!profile.premium && identifier !== 'steve') url.searchParams.set('model', profile.skin.model);
  return url.href;
}

function standingText(row, current) {
  if (!row) return 'Not ranked';
  const season = row.season === current ? 'Current' : escapeMarkdown(row.seasonName.slice(0, 80));
  return `**${row.tier} Tier #${row.rank.toLocaleString('en-US')} [${row.points.toLocaleString('en-US')}]**\n(${season})`;
}

export function profileEmbed(profile, settings) {
  const team = bestStanding(profile, 'smp-teams');
  const solo = bestStanding(profile, 'smp-solo');
  const account = [];
  if (profile.premium) account.push(`${settings.icons.premium} Premium`);
  if (profile.linked) account.push(`${settings.icons.discord} Discord`);
  return new EmbedBuilder().setColor(0x7DF9FF)
    .setTitle(`${escapeMarkdown(profile.playerName)}'s tiers on StrafeTiers`)
    .setURL(new URL('/tiers', settings.website).href)
    .setThumbnail(portraitUrl(profile))
    .addFields(
      { name: 'Account', value: account.join(' | ') || 'Not linked' },
      { name: 'Overall', value: 'Coming Soon!', inline: true },
      { name: 'Points', value: 'Coming Soon!', inline: true },
      { name: 'Region', value: profile.region || solo?.region || team?.region || 'Unavailable', inline: true },
      { name: 'SMP', value: '\u200B' },
      { name: `${settings.icons.team} Team`, value: standingText(team, profile.currentSeason), inline: true },
      { name: `${settings.icons.solo} Solo`, value: standingText(solo, profile.currentSeason), inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: 'Practice', value: 'Coming Soon!' },
      { name: '\u200B', value: `[Strafemc.net](${settings.website})` }
    ).setFooter({ text: 'Strafemc.net' });
}
