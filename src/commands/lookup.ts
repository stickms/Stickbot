import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder
} from 'discord.js';
import { createProfileEmbed } from '~/lib/steam-profile';
import { getSteamIdFromUrl } from '~/lib/utils';

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

  const profile = await createProfileEmbed(
    getSteamIdFromUrl(query),
    interaction.guildId
  );

  if (!profile) {
    return await interaction.editReply({
      content: '❌ Error: could not find profile'
    });
  }

  const { embeds, components } = profile;

  await interaction.editReply({ embeds, components });
}
