const { SlashCommandBuilder } = require('discord.js');
const { ProfileBuilder } = require('../profile-builder.js');

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
		let builder = await ProfileBuilder.create(interaction.options.getString('profile'));
		let embed = await builder.getProfileEmbed();
		if (!embed) {
			await interaction.reply({content: '❌ Error: Could not find profile.'});
		} 
		else {
			let comps = await builder.getProfileComponents();
			await interaction.reply({ embeds: embed, components: comps }); 
		}
	},
};