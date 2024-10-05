import {
  SlashCommandBuilder,
  InteractionContextType,
  CommandInteraction,
  ChatInputCommandInteraction
} from 'discord.js';
import SteamProfile from '../components/steam-profile.js';

export const data = new SlashCommandBuilder()
  .setName('lookup')
  .setDescription('Lookup a Steam Profile!')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((option) =>
    option
      .setName('profile')
      .setDescription('Lookup this Profile')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const query = interaction.options.getString('profile');

  const profile = await SteamProfile.create(query, interaction.guildId);
  if (!profile) {
    return await interaction.editReply({
      content: '❌ Error: Could not find profile.'
    });
  }

  await interaction.editReply({
    embeds: profile.embeds,
    components: profile.components,
    allowedMentions: { parse: [] }
  });
}
