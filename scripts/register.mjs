import { REST, Routes } from 'discord.js';
import { registrationConfig } from '../src/config.js';
import { tierCommand } from '../src/command.js';

const settings = registrationConfig();
const route = settings.guildId ? Routes.applicationGuildCommands(settings.applicationId, settings.guildId)
  : Routes.applicationCommands(settings.applicationId);
try {
  // Upsert just /tier; never bulk-replace other commands belonging to the application.
  await new REST({ version: '10' }).setToken(settings.token).post(route, { body: tierCommand().toJSON() });
  console.log(`/tier registered ${settings.guildId ? 'in the configured guild' : 'globally'}.`);
} catch { console.error('Command registration failed. Check the application ID, bot token, and guild installation.'); process.exitCode = 1; }
