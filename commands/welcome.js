const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setWelcome, getWelcome } = require('../database');

module.exports = {
	data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Settings for member join/leave messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
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
    ),
        
	async execute(interaction) {
		if (interaction.options.getSubcommand() == 'channel') {
            const channel = interaction.options.getChannel('channel');
            if (!channel || !channel.id || channel.type != 0) {
                return await interaction.reply({ 
                    content: '❌ Error: Must be a valid text channel.',
                    ephemeral: true
                });
            }

            setWelcome(interaction.guildId, channel.id);
            await interaction.reply(`\u2139\uFE0F Welcome messages will now be posted in <#${channel.id}>`);
        } else if (interaction.options.getSubcommand() == 'join') {
            const message = interaction.options.getString('message');
            if (!message || message.length > 256) {
                return await interaction.reply({ 
                    content: '❌ Error: Welcome message is too long (> 256 chars)',
                    ephemeral: true
                });
            }

            setWelcome(interaction.guildId, null, message);
            await interaction.reply(`✅ Set user welcome message successfully.`);
        } else if (interaction.options.getSubcommand() == 'leave') {
            const message = interaction.options.getString('message');
            if (!message || message.length > 256) {
                return await interaction.reply({ 
                    content: '❌ Error: Goodbye message is too long (> 256 chars)',
                    ephemeral: true
                });
            }

            setWelcome(interaction.guildId, null, null, message);
            await interaction.reply(`✅ Set user goodbye message successfully.`);
        }
	},
};