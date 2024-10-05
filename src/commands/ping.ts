import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong!');

export async function execute(interaction: ChatInputCommandInteraction) {
  const start = performance.now();

  const msg = await interaction.reply({
    content: 'Pong!',
    fetchReply: true
  });

  await msg.edit(`Pong! ${Math.ceil(performance.now() - start)}ms`);
}
