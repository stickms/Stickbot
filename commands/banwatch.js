const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setBanwatch } = require('../database');

module.exports = {
	data: new SlashCommandBuilder()
    .setName('banwatch')
    .setDescription('Set the banwatch channel.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option => option
        .setName('channel')
        .setDescription('The channel where banwatch messages should be sent')
        .setRequired(true)
    ),
        
	async execute(interaction) {
        const channel = interaction.options.getChannel('channel');

        // Channels of type 0 are text channels
        if (channel.type != 0) {
            return await interaction.reply({ 
                content: '❌ Error: Must be a text channel.',
                ephemeral: true
            });
        }

        setBanwatch(interaction.guildId, channel.id);

        await interaction.reply({ 
            content: `\u2139\uFE0F Ban Watch logs will now be posted in <#${channel.id}>`
        });
	},
};