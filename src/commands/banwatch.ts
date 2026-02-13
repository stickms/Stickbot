import {
  ChannelType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { serversDB } from '~/lib/db';

export const data = new SlashCommandBuilder()
  .setName('banwatch')
  .setDescription('Set the banwatch channel')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('Where banwatch messages should be sent')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    return;
  }

  const channel = interaction.options.getChannel('channel', true);

  if (channel.type !== ChannelType.GuildText) {
    return await interaction.reply({
      content: '❌ Error: Must be a text channel.',
      flags: ['Ephemeral']
    });
  }

  await serversDB.updateOne(
    { _id: interaction.guildId },
    { $set: { banwatch: channel.id } },
    { upsert: true }
  );

  await interaction.reply({
    content: `\u2139\uFE0F Ban Watch logs will now be posted in <#${channel.id}>`,
    flags: ['Ephemeral']
  });
}
