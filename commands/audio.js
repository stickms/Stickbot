const { SlashCommandBuilder } = require('discord.js');
const play = require('play-dl');

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
    if (!interaction.member.voice?.channel)  {
        await interaction.reply({ content: '❌ Error: Please join a voice channel first.' });
        return;
    }

    
}