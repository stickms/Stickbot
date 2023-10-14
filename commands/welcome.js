const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { setWelcome } = require('../components/database');
const { EMBED_COLOR } = require('../components/bot-consts');

module.exports = {
	data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Settings for member join/leave messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand(cmd => cmd
      .setName('channel')
      .setDescription('Select channel for welcome messages to be sent')
      .addChannelOption(option => option
        .setName('channel')
        .setDescription('Channel of choice')
      )
    ).addSubcommand(cmd => cmd
      .setName('join')
      .setDescription('Set the message to be sent when a user joins')
      .addStringOption(option => option
        .setName('message')
        .setDescription('Customize the message to be sent')
      )
    ).addSubcommand(cmd => cmd
      .setName('leave')
      .setDescription('Set the message to be sent when a user leaves')
      .addStringOption(option => option
        .setName('message')
        .setDescription('Customize the message to be sent')
      )
    ).addSubcommand(cmd => cmd
      .setName('format')
      .setDescription('Shows Welcome message formatting info')
    ),
        
	async execute(interaction) {
    const sub = interaction.options.getSubcommand();

		if (sub == 'channel') {
      const channel = interaction.options.getChannel('channel');
      if (!channel || !channel.id || channel.type != 0) {
        return await interaction.reply({ 
          content: '❌ Error: Must be a valid text channel.',
          ephemeral: true
        });
      }

      setWelcome(interaction.guildId, channel.id);
      await interaction.reply(`\u2139\uFE0F Welcome messages will now be posted in <#${channel.id}>`);
    } else if (sub == 'join') {
      const message = interaction.options.getString('message');
      if (!message || message.length > 256) {
        return await interaction.reply({ 
          content: '❌ Error: Welcome message is too long (> 256 chars)',
          ephemeral: true
        });
      }

      setWelcome(interaction.guildId, null, message);
      await interaction.reply('✅ Set user welcome message successfully.');
    } else if (sub == 'leave') {
      const message = interaction.options.getString('message');
      if (!message || message.length > 256) {
        return await interaction.reply({ 
          content: '❌ Error: Goodbye message is too long (> 256 chars)',
          ephemeral: true
        });
      }

      setWelcome(interaction.guildId, null, null, message);
      await interaction.reply('✅ Set user goodbye message successfully.');
    } else if (sub == 'format') {
      let embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle('Welcome Message Formatting')
        .setDescription(`
        \`{server}\`/\`{guild}\` -> Current Server Name
        \`{name}\` -> User's Discord Username
        \`{nick}\` -> User's Server Nickanme (defaults to username)
        \`{mention}\` -> User Mention
        \`{disc}\` -> User's discriminator (e.g. #1234)
        \`{id}\` -> Discord User ID
        `);

      await interaction.reply({ embeds: [ embed ], ephemeral: true });
    }
	},
};