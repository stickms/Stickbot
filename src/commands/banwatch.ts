import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ChatInputCommandInteraction
} from 'discord.js';

import Database, { DatabaseServerEntry } from '../components/database.js';

export const data = new SlashCommandBuilder()
  .setName('banwatch')
  .setDescription('Set the banwatch channel.')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('The channel where banwatch messages should be sent')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel');

  // Channels of type 0 are text channels
  if (channel.type != 0) {
    return await interaction.reply({
      content: '❌ Error: Must be a text channel.',
      ephemeral: true
    });
  }

  const result = await Database.setBanwatch(interaction.guildId, channel.id);

  if (!result) {
    await interaction.reply({
      content: `❌ Error: Could not update Ban Watch channel.`
    });

    return;
  }

  await interaction.reply({
    content: `\u2139\uFE0F Ban Watch logs will now be posted in <#${channel.id}>`
  });
}
