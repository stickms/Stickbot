const { SlashCommandBuilder } = require('discord.js');
const { createProfile } = require('../profile-builder.js');

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

		let builder = await createProfile(interaction.options.getString('profile'), interaction.guildId);
		let embed = await builder.getProfileEmbed();

		if (!embed || embed.length == 0) {
			await interaction.editReply({ content: '❌ Error: Could not find profile.' });
		} 
		else {
			let comps = await builder.getProfileComponents();
			await interaction.editReply({ embeds: embed, components: comps }); 
		}
	},
};