import { REST, Routes } from 'discord.js';
import { registrationConfig } from '../src/config.js';
import { tierCommand } from '../src/command.js';
import { uploadApplicationIcons } from '../src/emojis.js';

const settings = registrationConfig();
const route = settings.guildId ? Routes.applicationGuildCommands(settings.applicationId, settings.guildId)
  : Routes.applicationCommands(settings.applicationId);
try {
  await uploadApplicationIcons(settings);
  // Upsert just /tier; never bulk-replace other commands belonging to the application.
  await new REST({ version: '10' }).setToken(settings.token).post(route, { body: tierCommand({ guildScoped: Boolean(settings.guildId) }).toJSON() });
  console.log(`/tier registered ${settings.guildId ? 'in the configured guild' : 'globally'}.`);
} catch { console.error('Application emoji setup or command registration failed. Check the application ID, bot token, and installation settings (enable User Install and Guild Install for global /tier).'); process.exitCode = 1; }
