const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioResource, createAudioPlayer, getVoiceConnection, NoSubscriberBehavior, AudioPlayerStatus } = require('@discordjs/voice')
const play = require('play-dl');

let queue = {};

module.exports = {
	data: [ 
		new SlashCommandBuilder()
		.setName('play')
		.setDescription('Play a song from a search query or url!')
		.addStringOption(option => 
			option.setName('query')
				.setDescription('Search from YouTube')
				.setRequired(true)
			),
		new SlashCommandBuilder()
		.setName('leave')
		.setDescription('Forces the bot to leave the current voice channel.')		 
	],

	async execute(interaction) {
		if (interaction.commandName == 'play') {
			commandPlay(interaction);
		} else if (interaction.commandName == 'leave') {
			commandLeave(interaction);
		}
	}
};

async function playAudio(guildId, url) {
	if (!url) return;

	const connection = getVoiceConnection(guildId);
	if (!connection) return;

	let stream = await play.stream(url);

	let resource = createAudioResource(stream.stream, { inputType: stream.type });
	let player = createAudioPlayer({
		behaviors: { noSubscriber: NoSubscriberBehavior.Play }
	});

	player.on(AudioPlayerStatus.Playing, () => {
		console.log('The audio player has started playing!');
		// TODO: Send a message to server about the currently playing song
	});	

	player.on(AudioPlayerStatus.Idle, () => {
		queue[guildId].shift();
		playAudio(guildId, queue[guildId][0]); // Play next song in queue
	});	

	player.play(resource);
	connection.subscribe(player);
}

async function commandPlay(interaction) {
	if (!interaction.member.voice?.channel)  {
		await interaction.reply({ content: '❌ Error: Please join a voice channel first.' });
		return;
	}

	let connection = getVoiceConnection(interaction.guildId);
	if (!connection) {
		connection = joinVoiceChannel({
			channelId: interaction.member.voice.channel.id,
			guildId: interaction.guildId,
			adapterCreator: interaction.guild.voiceAdapterCreator
		});
	}

	let search = await play.search(interaction.options.getString('query'), { limit: 1 });

	queue[guildId].append(search[0].url);
	if (queue[guildId].length == 1) {
		await playAudio(interaction.guildId, search[0].url);
	}
}

async function commandLeave(interaction) {
	const connection = getVoiceConnection(interaction.guildId);
	connection.destroy();
}