import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ChatInputCommandInteraction
} from 'discord.js';

import Database from '../components/database.js';

export const data = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Settings for member join/leave messages')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((cmd) =>
    cmd
      .setName('channel')
      .setDescription('Select channel for welcome messages to be sent')
      .addChannelOption((option) =>
        option.setName('channel').setDescription('Channel of choice')
      )
  )
  .addSubcommand((cmd) =>
    cmd
      .setName('join')
      .setDescription('Set the message to be sent when a user joins')
      .addStringOption((option) =>
        option
          .setName('message')
          .setDescription('Customize the message to be sent')
      )
  )
  .addSubcommand((cmd) =>
    cmd
      .setName('leave')
      .setDescription('Set the message to be sent when a user leaves')
      .addStringOption((option) =>
        option
          .setName('message')
          .setDescription('Customize the message to be sent')
      )
  )
  .addSubcommand((cmd) =>
    cmd
      .setName('format')
      .setDescription('Shows Welcome message formatting info')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub == 'channel') {
    const channel = interaction.options.getChannel('channel');

    if (!channel || channel.type != 0) {
      return await interaction.reply({
        content: '❌ Error: Must be a valid text channel.',
        ephemeral: true
      });
    }

    await Database.setWelcomeChannel(interaction.guildId, channel.id);

    await interaction.reply(
      `\u2139\uFE0F Welcome messages will now be posted in <#${channel.id}>`
    );
  } else if (sub == 'join') {
    const message = interaction.options.getString('message');
    if (!message || message.length > 256) {
      return await interaction.reply({
        content: '❌ Error: Welcome message is too long (> 256 chars)',
        ephemeral: true
      });
    }

    await Database.setWelcomeJoin(interaction.guildId, message);

    await interaction.reply('✅ Set user welcome message successfully.');
  } else if (sub == 'leave') {
    const message = interaction.options.getString('message');
    if (!message || message.length > 256) {
      return await interaction.reply({
        content: '❌ Error: Goodbye message is too long (> 256 chars)',
        ephemeral: true
      });
    }

    await Database.setWelcomeLeave(interaction.guildId, message);

    await interaction.reply('✅ Set user goodbye message successfully.');
  } else if (sub == 'format') {
    let embed = new EmbedBuilder()
      .setColor(0x3297a8)
      .setTitle('Welcome Message Formatting').setDescription(`
      \`{server}\`/\`{guild}\` -> Current Server Name
      \`{name}\` -> User's Discord Username
      \`{nick}\` -> User's Server Nickanme (defaults to username)
      \`{mention}\` -> User Mention
      \`{id}\` -> Discord User ID
      `);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
