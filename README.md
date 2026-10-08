# StrafeTiers Discord application

One command: `/tier player:<Minecraft username>`. The public embed shows account badges, the player's portrait, region, best SMP Team and Solo seasons, and placeholders for Overall, Points and Practice. No tab switcher.

## How standings are selected

- Team and Solo independently select their highest **tier** across all seasons. Ties prefer more points, then better rank, then the current/latest season.
- Best results in the active season display `(Current)`; older results display the actual season name, such as `(Season 1)`.
- Tier bands follow the website's S/A/B/C/F population thresholds and minimum one entry per band. Rank is the leaderboard's shared rank when points tie; tier placement uses the entry's position.
- Team membership comes from explicitly published **season rosters**, never from membership inferred by name or today's team. In StrafeSMPCore, publish/update rosters using `/strafe tiers team push`. If no matching published roster exists, Team displays `Not ranked`.
- Missing solo results display `Not ranked`. Missing region displays `Unavailable`; this application does not invent a region. Account labels show Premium and/or Discord only when those flags are true. An account with neither displays `Not linked`.
- Banned tier profiles are hidden. Deleted current teams are excluded; completed seasons retain historical teams, matching the API's existing visibility rules.
- Portraits use the website's camera and walking pose. Premium players use their verified Minecraft UUID; non-premium players use the canonical SkinsRestorer texture hash mirrored into the API. Missing non-premium skins fall back to Steve.

Example, with illustrative data:

```text
Cerberooz's tiers on StrafeTiers                    [portrait]
Account
🎮 Premium | 💬 Discord

Overall            Points             Region
Coming Soon!       Coming Soon!        AS

SMP
🚩 Team                               ⚔️ Solo
S Tier #1 [3,240]                      A Tier #6 [2,460]
(Season 1)                            (Current)

Practice
Coming Soon!

Strafemc.net
```

The embed includes one plain `StrafeMC.net` footer and a clickable title. Discord chooses final field spacing and thumbnail placement, especially on mobile.

## API preparation

The sibling `WebApps/API-Server` adds `GET /v1/tiers/profile?name=Cerberooz`, requiring only `leaderboards:read`.

1. Apply pending API migrations, including `20261020000000_discord_tier_profiles.sql`, through the existing `pnpm migrate:prod` deployment workflow. For SQL Editor deployment, `pnpm migrate:prod --sql` exports the complete migration bundle without connecting.
2. Rebuild/restart the API service.
3. Generate a **separate read-only Strafe API key**:

   ```sh
   pnpm api-key:generate --label strafe-tiers-discord --scopes leaderboards:read
   ```

   Follow that command's instructions to insert the hashed key record into Supabase. Put the generated client token in this app's `API_SERVER_API_KEY`. The bot does not need Supabase credentials, account write permissions or moderation permissions.

The lookup returns public identity flags and season standings only, with no Discord IDs, session tokens or skin signatures. Names are matched case-insensitively. Ambiguous premium/offline identities with the same name return an explicit error instead of silently selecting one account.

## Discord setup

1. Create an application named **StrafeTiers** in the [Discord Developer Portal](https://discord.com/developers/applications), create its bot, and copy the bot token and application ID.
2. Under **Installation → Installation Contexts**, enable **User Install** and **Guild Install** and save. Choose **Discord Provided Link**. Under **Default Install Settings**, select only `applications.commands` for User Install; select `bot` and `applications.commands` for Guild Install, with **Send Messages** and **Embed Links** permissions. No privileged intents, message-content access, member access or administrator permission are required. Leave Interactions Endpoint URL empty: this app handles interactions through the Gateway.
3. Copy `.env.example` to `.env` and fill `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID`, `API_SERVER_BASE_URL` and `API_SERVER_API_KEY`. Leave `DISCORD_GUILD_ID` empty for user installation. Setting it registers a guild-only development command instead.
4. Leave the four icon settings as `auto` to use the application's own website icons. The previous defaults (🎮, 💬, 🚩, ⚔️) also automatically adopt the application emojis. Other Unicode/custom emoji values remain explicit overrides.

After registering and starting the app, share the **Install Link** from the Installation page. Individual players select **Add to My Apps** to install it on their account. Global `/tier` supports user and server installations and can be used in server channels, the bot's DM, and other DMs/group DMs, subject to Discord's permissions. Players do not need to add the bot to a server to install it on their account.

For an existing deployment, enable both installation contexts in the portal first, clear `DISCORD_GUILD_ID` in `.env`, then run the usual build, registration and container replacement commands. Only this bot needs redeploying. Reference: [Discord user-installable apps](https://docs.discord.com/developers/tutorials/developing-a-user-installable-app).

### Application-owned emojis

The registration command now uploads the website's **Team**, **Solo**, **Minecraft grass block**, and **Discord symbol** as application emojis named `strafe_team`, `strafe_solo`, `strafe_minecraft`, and `strafe_discord`. They belong to the StrafeTiers application, so Discord identifies them as emojis “from the StrafeTiers app”, with no emoji-storage server required.

The bundled images in `assets/emojis` are transparent 128×128 PNG conversions of the existing website artwork. To regenerate them after updating the website icons, run `npm run emojis:prepare` locally with development dependencies installed, then commit the generated PNGs. An optional first argument specifies a different website design directory. Deployment uses the bundled PNGs and needs neither the website checkout nor the image conversion library.

Your existing `node scripts/register.mjs` Docker deployment step uploads any missing named emoji and reuses existing IDs on later deployments. It does not replace or delete existing application emojis. The bot resolves their IDs once at startup and uses them automatically in profile embeds. If you deliberately replace an icon, manage that emoji in Developer Portal → your application → Emojis, then restart the bot. If lookup fails, the bot logs a fallback notice and uses ordinary Unicode icons.

You can also upload the four PNGs manually in that Emojis page using the exact names above. The app reads them by name at startup; no manual IDs are required. To override one icon explicitly, set e.g. `TEAM_ICON=<:my_team:123456789012345678>` in `.env`.

Reference: [Discord application-owned emoji](https://docs.discord.com/developers/resources/emoji#application-owned-emoji). Only the bot needs redeploying for this emoji change; no new API migration or website deployment is required.

## Docker deployment

In this directory, with Docker running:

```sh
docker compose build
docker compose --profile setup run --rm register
docker compose up -d strafe-tiers
docker compose logs --tail=50 strafe-tiers
```

Registration upserts only `/tier` and preserves other application commands. Run registration when the command definition changes, rather than on every restart. Avoid registering both guild and global copies for the same guild; Discord may show both while propagating updates.

The runtime runs as a non-root user, has a read-only filesystem, a 256 MiB memory limit and a 0.5 CPU limit. Logs rotate. No host port, inbound webhook, shared database or persistent volume is needed. `/healthz` on the private container port reports Gateway readiness; it does not claim the upstream API is reachable. Docker health status reports connectivity but does not itself restart an unhealthy running process; fatal startup errors exit for the configured restart policy.

Default controls: 5-second per-user cooldown and at most 10 accepted requests per user in a rolling 60-second window, 8 concurrent distinct API lookups, 32 active interactions, a 10-second API timeout, and a 30-second cache bounded to 512 profiles / 8 MiB serialized data. Rate-limited requests receive a private reply with the remaining wait in seconds. Limits follow the user's Discord ID across servers and DMs; cached lookups and failed profile lookups also count. Rejected attempts do not extend the wait. The limiter stores at most 4096 users and resets on container restart. Simultaneous requests for the same player share one lookup. API failures are not cached as successful profiles, and cached data expires normally. API moderation/profile changes can take up to the configured cache duration to appear.

`USER_COOLDOWN_SECONDS` defaults to 5 and has a minimum effective value of 5, including older `.env` files that still specify 3. `USER_REQUESTS_PER_MINUTE` defaults to 10 when absent and may be set lower. No `.env` changes are required to adopt these limits.

For an API running on the host, use `http://host.docker.internal:5000` during local development. In production use its public HTTPS origin, or configure the deployment network deliberately; `localhost` inside this container refers to this bot container.

## Local development

```sh
npm ci
npm run build
npm run register
npm start
```

The build checks JavaScript syntax. Live Discord registration and API/database behavior require configured credentials and deployment; no automatic tests or migrations run during a Docker build.

References: [Discord embeds](https://docs.discord.com/developers/resources/message#embed-object), [Discord interactions](https://docs.discord.com/developers/interactions/receiving-and-responding), [Skin Render identifiers](https://skinrender.dev/docs/).
