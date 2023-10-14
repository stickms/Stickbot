const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
	.setName('ping')
	.setDescription('Replies with Pong!'),
        
	async execute(interaction) {
		const start = performance.now();
		const msg = await interaction.reply({ content: 'Pong!', fetchReply: true });
		await msg.edit(`Pong! ${Math.ceil(performance.now() - start)}ms`);	
	},
};