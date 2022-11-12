const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription('Play a song from a search query or url!')
        .addStringOption(option => 
			option.setName('query')
				.setDescription('Search from YouTube')
				.setRequired(true)
			),
        
	async execute(interaction) {
        if (interaction.commandName == 'play') {
            commandPlay(interaction);
        }
	},
};

async function commandPlay(interaction) {
    console.log(interaction.commandName);
}