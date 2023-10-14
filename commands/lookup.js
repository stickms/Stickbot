const { SlashCommandBuilder } = require('discord.js');
const { resolveSteamID } = require('../components/bot-helpers.js');
const { getProfile } = require('../components/profile-builder.js');

module.exports = {
	data: new SlashCommandBuilder()
	.setName('lookup')
	.setDescription('Lookup a Steam Profile!')
	.setDMPermission(false)
	.addStringOption(option => option
		.setName('profile')
		.setDescription('Lookup this Profile')
		.setRequired(true)
	),
    
	async execute(interaction) {
		await interaction.deferReply();

		const query = interaction.options.getString('profile');
		const steamid = await resolveSteamID(query);

		if (!steamid) {
			return await interaction.editReply({
				content: '❌ Error: Could not find profile.'
			});
		}

		const profile = await getProfile(steamid.getSteamID64(), interaction.guildId);
		if (!profile?.getEmbed()) {
			return await interaction.editReply({
				content: '❌ Error: Could not load profile data.'
			});
		}

		await interaction.editReply({
			embeds: profile.getEmbed(),
			components: profile.getComponents()
		});
	},
};