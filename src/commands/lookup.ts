import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder
} from 'discord.js';
import { createProfileEmbed } from '~/lib/steam-profile';

export const data = new SlashCommandBuilder()
  .setName('lookup')
  .setDescription('Lookup a Steam Profile!')
  .addStringOption((option) =>
    option
      .setName('query')
      .setDescription('Steam profile ID or URL')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('query', true);

  await interaction.deferReply();

  const profile = await createProfileEmbed(query, interaction.guildId);

  await interaction.editReply({ embeds: [profile] });
}
