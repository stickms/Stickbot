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
		let profile = await ProfileBuilder.create(interaction.options.getString('profile'));
		let embed = await profile.getProfileEmbed();
		if (embed == null) {
			await interaction.reply({content: '❌ Error: Could not find profile.'});
		} 
		else {
			let comps = await profile.getProfileComponents();
			await interaction.reply({ embeds: [ embed ], components: comps }); 
		}
	},
};