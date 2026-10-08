import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';

export function tierCommand({ guildScoped = false } = {}) {
  const command = new SlashCommandBuilder().setName('tier').setDescription("View a player's best StrafeTiers seasons.")
    .addStringOption(option => option.setName('player').setDescription('Minecraft username').setRequired(true).setMinLength(1).setMaxLength(16));
  // Installation and interaction contexts are only supported for global commands.
  if (!guildScoped) {
    command.setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
      .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel);
  }
  return command;
}
