const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class ProfileError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function validate(profile) {
  if (!profile || !UUID.test(profile.playerId) || !/^[A-Za-z0-9_]{1,16}$/.test(profile.playerName)
    || typeof profile.premium !== 'boolean' || typeof profile.linked !== 'boolean'
    || typeof profile.currentSeason !== 'string' || !Array.isArray(profile.standings)
    || profile.region !== null && !['AS', 'EU', 'NA', 'SA', 'OC', 'AF'].includes(profile.region)) throw new ProfileError('invalid_response');
  for (const row of profile.standings) {
    if (!['smp-teams', 'smp-solo'].includes(row.mode) || !UUID.test(row.subjectId)
      || ![row.points, row.rank, row.position, row.total].every(Number.isSafeInteger)
      || row.points < 0 || row.rank < 1 || row.position < 1 || row.position > row.total
      || row.region !== null && !['AS', 'EU', 'NA', 'SA', 'OC', 'AF'].includes(row.region)
      || typeof row.season !== 'string' || typeof row.seasonName !== 'string' || !row.seasonName
      || !Number.isFinite(Date.parse(row.seasonStartedAt))) throw new ProfileError('invalid_response');
  }
  return profile;
}

async function limitedJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new ProfileError('invalid_response');
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 256 * 1024) { await reader.cancel(); throw new ProfileError('invalid_response'); }
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}

export class ProfileClient {
  #cache = new Map();
  #cacheBytes = 0;
  #inFlight = new Map();
  constructor(settings) { this.settings = settings; }
  async get(name) {
    if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) throw new ProfileError('invalid_name');
    const key = name.toLowerCase();
    const cached = this.#cache.get(key);
    if (cached && cached.until > Date.now()) return cached.profile;
    const pending = this.#inFlight.get(key);
    if (pending) return pending;
    if (this.#inFlight.size >= this.settings.maximum) throw new ProfileError('busy');
    const request = this.#load(name).then(profile => {
      this.#evict(key);
      const bytes = Buffer.byteLength(JSON.stringify(profile));
      while (this.#cache.size >= 512 || this.#cacheBytes + bytes > 8 * 1024 * 1024)
        this.#evict(this.#cache.keys().next().value);
      this.#cache.set(key, { profile, bytes, until: Date.now() + this.settings.cacheMs });
      this.#cacheBytes += bytes;
      return profile;
    }).finally(() => this.#inFlight.delete(key));
    this.#inFlight.set(key, request);
    return request;
  }
  #evict(key) {
    const previous = this.#cache.get(key);
    if (previous) { this.#cacheBytes -= previous.bytes; this.#cache.delete(key); }
  }
  async #load(name) {
    const url = new URL('/v1/tiers/profile', this.settings.apiBase);
    url.searchParams.set('name', name);
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${this.settings.apiKey}` }, signal: AbortSignal.timeout(10_000), redirect: 'error' });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 404) return this.#missingProfile(name);
        throw new ProfileError(response.status === 409 ? 'ambiguous' : response.status === 429 ? 'busy' : 'unavailable');
      }
      return validate(await limitedJson(response));
    } catch (error) { if (error instanceof ProfileError) throw error; throw new ProfileError('unavailable'); }
  }

  async #missingProfile(name) {
    // A missing tier profile can still belong to a premium Minecraft username.
    // This public lookup deliberately has no Strafe API authorization header.
    const profile = { playerName: name, premium: false, playerId: null, standings: [], notFound: true };
    try {
      const response = await fetch(`https://api.minecraftservices.com/minecraft/profile/lookup/name/${encodeURIComponent(name)}`,
        { signal: AbortSignal.timeout(3000), redirect: 'error' });
      if (!response.ok) { await response.body?.cancel(); return profile; }
      const account = await limitedJson(response);
      if (/^[a-f0-9]{32}$/i.test(account.id || '') && /^[A-Za-z0-9_]{1,16}$/.test(account.name || '')
        && account.name.toLowerCase() === name.toLowerCase()) {
        profile.playerName = account.name;
        profile.playerId = account.id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
        profile.premium = true;
      }
    } catch { /* A failed optional portrait lookup still produces the no-tiers embed with Steve. */ }
    return profile;
  }
}
