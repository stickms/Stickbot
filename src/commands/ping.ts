import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!');

export async function execute(interaction: ChatInputCommandInteraction) {
  const reference = performance.now();
  await interaction.reply('...');

  const elapsed = performance.now() - reference;
  await interaction.editReply(`Pong! (${Math.round(elapsed)} ms)`);
}
