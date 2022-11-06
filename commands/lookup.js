const { SlashCommandBuilder } = require('discord.js');
const { createProfile } = require('../profile-builder.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lookup')
		.setDescription('Lookup a Steam Profile!')
		.addStringOption(option => 
			option.setName('profile')
				.setDescription('Lookup this Profile')
				.setRequired(true)
			),
        
	async execute(interaction) {
		await interaction.deferReply();

		let builder = await createProfile(interaction.guildId, interaction.options.getString('profile'));
		let embed = await builder.getProfileEmbed();
		if (!embed) {
			await interaction.editReply({content: '❌ Error: Could not find profile.'});
		} 
		else {
			let comps = await builder.getProfileComponents();
			await interaction.editReply({ embeds: embed, components: comps }); 
		}
	},
};