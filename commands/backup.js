const { SlashCommandBuilder } = require('discord.js');
const { exportDB } = require('../database.js'); 

module.exports = {
	data: new SlashCommandBuilder()
	.setName('backup')
	.setDescription('Uploads playerlist data to Discord'),

	dev_guild: true,
        
	async execute(interaction) {
		const file = {
			attachment: Buffer.from(JSON.stringify(exportDB(), null, 4)),
			name: 'playerlist.json'
		};

		await interaction.reply({
			content: '✅ Backup exported and uploaded!',
			files: [ file ]
		});
	},
};