import { SlashCommandBuilder } from 'discord.js';

export function tierCommand() {
  return new SlashCommandBuilder().setName('tier').setDescription("View a player's best StrafeTiers seasons.")
    .addStringOption(option => option.setName('player').setDescription('Minecraft username').setRequired(true).setMinLength(1).setMaxLength(16));
}
